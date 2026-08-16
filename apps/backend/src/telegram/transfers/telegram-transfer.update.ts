import { Update, Ctx, Action } from 'nestjs-telegraf';
import { Logger, UseGuards } from '@nestjs/common';
import { SessionContext } from '../telegram.types';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { TelegramBaseHandler } from '../telegram-base.handler';
import { TelegramTransferService } from './telegram-transfer.service';
import { TransferDraft, TransferExtractionService } from './transfer-extraction.service';

const PROMPT =
  '🔄 <b>Transfer</b>\n\n' +
  'Describe the transfer in one message, for example:\n' +
  '<i>pasé 200 de bofa a binance</i>\n' +
  '<i>pagué 320.50 de la tdc con bofa</i>';

@Update()
export class TelegramTransferUpdate {
  private readonly logger = new Logger(TelegramTransferUpdate.name);

  constructor(
    private readonly transferService: TelegramTransferService,
    private readonly extractionService: TransferExtractionService,
    private readonly baseHandler: TelegramBaseHandler,
  ) {}

  /**
   * `/transfer` reads the whole transfer from one sentence, the same way a plain
   * message is read as a transaction. Anything the sentence leaves out is asked
   * for afterwards, so a complete description never costs more than one message.
   */
  async handleTransfer(@Ctx() ctx: SessionContext) {
    this.baseHandler.clearSession(ctx);

    const inline = this.getCommandArgs(ctx);

    if (!inline) {
      ctx.session.transferState = 'waiting_input';
      await ctx.reply(PROMPT, { parse_mode: 'HTML' });
      return;
    }

    await this.extractAndResume(ctx, inline);
  }

  /** Text typed after the command itself, as in "/transfer 200 de bofa a binance". */
  private getCommandArgs(ctx: SessionContext): string | null {
    if (!ctx.message || !('text' in ctx.message)) return null;

    const args = ctx.message.text.replace(/^\/transfer(@\S+)?/i, '').trim();
    return args.length > 0 ? args : null;
  }

  async handleTextInput(@Ctx() ctx: SessionContext) {
    if (!ctx.message || !('text' in ctx.message)) return;

    const text = ctx.message.text.trim();

    try {
      switch (ctx.session.transferState) {
        case 'waiting_input':
          await this.extractAndResume(ctx, text);
          break;
        case 'waiting_amount':
          await this.handleAmount(ctx, text);
          break;
        case 'waiting_debit':
          await this.handleAccount(ctx, text, 'debit');
          break;
        case 'waiting_credit':
          await this.handleAccount(ctx, text, 'credit');
          break;
        case 'waiting_description':
          // Reached only from the Name button, which registers straight away
          ctx.session.transferDescription = text;
          await this.registerTransfer(ctx);
          break;
      }
    } catch (error) {
      this.logger.error(`Error in transfer flow: ${error.message}`);
      await ctx.reply('Error processing transfer. Please try again with /transfer.');
      this.baseHandler.clearSession(ctx);
    }
  }

  private async extractAndResume(ctx: SessionContext, text: string) {
    let draft: TransferDraft;

    try {
      draft = await this.baseHandler.withTyping(ctx, () => this.extractionService.extract(text));
    } catch (error) {
      this.logger.error(`Transfer extraction failed: ${error.message}`);
      ctx.session.transferState = 'waiting_input';
      await ctx.reply('⚠️ Could not understand that. Try again, for example: <i>pasé 200 de bofa a binance</i>', {
        parse_mode: 'HTML',
      });
      return;
    }

    if (draft.amount) ctx.session.transferAmount = draft.amount;
    if (draft.debitAccount) ctx.session.transferDebitAccount = draft.debitAccount;
    if (draft.creditAccount) ctx.session.transferCreditAccount = draft.creditAccount;
    if (draft.description) ctx.session.transferDescription = draft.description;

    await this.resumeAtFirstMissingField(ctx);
  }

  private async handleAmount(ctx: SessionContext, text: string) {
    const amount = parseFloat(text.replace(/,/g, ''));

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('Invalid amount. Please enter a positive number.');
      return;
    }

    ctx.session.transferAmount = amount;
    await this.resumeAtFirstMissingField(ctx);
  }

  private async handleAccount(ctx: SessionContext, text: string, side: 'debit' | 'credit') {
    // Account matching falls back to the LLM, so it is worth the same feedback
    const matched = await this.baseHandler.withTyping(ctx, () =>
      this.transferService.matchAccount(text),
    );

    if (!matched) {
      await ctx.reply('❌ Account not found. Please try again.');
      return;
    }

    const other =
      side === 'debit' ? ctx.session.transferCreditAccount : ctx.session.transferDebitAccount;

    if (matched === other) {
      await ctx.reply('❌ Both sides cannot be the same account. Please try again.');
      return;
    }

    if (side === 'debit') {
      ctx.session.transferDebitAccount = matched;
    } else {
      ctx.session.transferCreditAccount = matched;
    }

    await this.resumeAtFirstMissingField(ctx);
  }

  /** Asks only for what the message did not carry, then confirms. */
  private async resumeAtFirstMissingField(ctx: SessionContext) {
    const s = ctx.session;
    const header = `🔄 <b>Transfer</b>\n\n${this.buildSummary(ctx)}`;

    if (!s.transferAmount) {
      s.transferState = 'waiting_amount';
      await ctx.reply(`${header}\nEnter the amount (USD):`, { parse_mode: 'HTML' });
      return;
    }

    if (!s.transferCreditAccount) {
      s.transferState = 'waiting_credit';
      await ctx.reply(`${header}\nWhich account does the money come <b>from</b>?`, {
        parse_mode: 'HTML',
      });
      return;
    }

    if (!s.transferDebitAccount) {
      s.transferState = 'waiting_debit';
      await ctx.reply(`${header}\nWhich account does the money go <b>to</b>?`, {
        parse_mode: 'HTML',
      });
      return;
    }

    await this.showConfirmation(ctx);
  }

  private buildSummary(ctx: SessionContext): string {
    const s = ctx.session;
    const lines: string[] = [];

    if (s.transferAmount) lines.push(`Amount: $${s.transferAmount.toFixed(2)}`);
    if (s.transferCreditAccount) lines.push(`From: ${s.transferCreditAccount}`);
    if (s.transferDebitAccount) lines.push(`To: ${s.transferDebitAccount}`);
    if (s.transferDescription) lines.push(`Description: ${s.transferDescription}`);

    return lines.length > 0 ? `${lines.join('\n')}\n` : '';
  }

  private async showConfirmation(ctx: SessionContext) {
    ctx.session.transferState = 'waiting_confirmation';

    const rule = this.transferService.findTransferRule(
      ctx.session.transferDebitAccount!,
      ctx.session.transferCreditAccount!,
    );

    const summary = this.buildSummary(ctx);
    const ruleLine = rule ? `Rule: ${rule.name}\n` : '';

    // A rule writes to a fixed cell and never stores the description, so
    // renaming would have no effect on what gets saved
    const actions = [{ text: '✅ Accept', callback_data: 'transfer_confirm' }];
    if (!rule) {
      actions.push({ text: '✏️ Name', callback_data: 'transfer_rename' });
    }

    await ctx.reply(`🔄 <b>Confirm Transfer</b>\n\n${summary}${ruleLine}\nIs this correct?`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [actions, [{ text: '❌ Cancel', callback_data: 'transfer_cancel' }]],
      },
    });
  }

  @Action('transfer_rename')
  @UseGuards(TelegramAuthGuard)
  async handleRename(@Ctx() ctx: SessionContext) {
    await ctx.answerCbQuery();
    await this.baseHandler.removeButtons(ctx);
    ctx.session.transferState = 'waiting_description';
    await ctx.reply('✏️ Enter a <b>description</b> for this transfer:', { parse_mode: 'HTML' });
  }

  @Action('transfer_confirm')
  @UseGuards(TelegramAuthGuard)
  async handleConfirm(@Ctx() ctx: SessionContext) {
    await ctx.answerCbQuery();
    await this.baseHandler.removeButtons(ctx);
    await this.registerTransfer(ctx);
  }

  /** Writes the transfer to Sheets, whichever button got us here. */
  private async registerTransfer(ctx: SessionContext) {
    try {
      const amount = ctx.session.transferAmount;
      const debitAccount = ctx.session.transferDebitAccount;
      const creditAccount = ctx.session.transferCreditAccount;

      if (!amount || !debitAccount || !creditAccount) {
        await ctx.reply('Transfer is incomplete. Please start again with /transfer.');
        this.baseHandler.clearSession(ctx);
        return;
      }

      const rule = this.transferService.findTransferRule(debitAccount, creditAccount);

      if (rule) {
        await this.transferService.applyCellUpdate(rule, amount);
        await ctx.reply(
          `✅ <b>Transfer Registered!</b>\n\n` +
            `Amount: $${amount.toFixed(2)}\n` +
            `From: ${creditAccount}\n` +
            `To: ${debitAccount}\n` +
            `Rule: ${rule.name}\n\n` +
            `Cell ${rule.cell} updated in Google Sheets.`,
          { parse_mode: 'HTML' },
        );
      } else {
        const description = ctx.session.transferDescription!;
        await this.transferService.createJournalEntry(
          amount,
          debitAccount,
          creditAccount,
          description,
        );
        await ctx.reply(
          `✅ <b>Transfer Registered!</b>\n\n` +
            `Amount: $${amount.toFixed(2)}\n` +
            `From: ${creditAccount}\n` +
            `To: ${debitAccount}\n` +
            `Description: ${description}\n\n` +
            `Journal entry created in Google Sheets.`,
          { parse_mode: 'HTML' },
        );
      }

      this.baseHandler.clearSession(ctx);
    } catch (error) {
      this.logger.error(`Error registering transfer: ${error.message}`);
      await ctx.reply('Error registering transfer. Please try again with /transfer.');
      this.baseHandler.clearSession(ctx);
    }
  }

  @Action('transfer_cancel')
  @UseGuards(TelegramAuthGuard)
  async handleCancel(@Ctx() ctx: SessionContext) {
    await ctx.answerCbQuery();
    await this.baseHandler.removeButtons(ctx);
    this.baseHandler.clearSession(ctx);
    await ctx.reply('🚫 Transfer cancelled.');
  }
}
