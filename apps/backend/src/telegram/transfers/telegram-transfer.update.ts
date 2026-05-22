import { Update, Ctx } from 'nestjs-telegraf';
import { Logger } from '@nestjs/common';
import { SessionContext } from '../telegram.types';
import { TelegramBaseHandler } from '../telegram-base.handler';
import { TelegramTransferService } from './telegram-transfer.service';

@Update()
export class TelegramTransferUpdate {
  private readonly logger = new Logger(TelegramTransferUpdate.name);

  constructor(
    private readonly transferService: TelegramTransferService,
    private readonly baseHandler: TelegramBaseHandler,
  ) {}

  async handleTransfer(@Ctx() ctx: SessionContext) {
    this.baseHandler.clearSession(ctx);

    ctx.session.transferState = 'waiting_amount';

    await ctx.reply(
      '🔄 <b>Transfer</b>\n\nEnter the amount (USD):',
      { parse_mode: 'HTML' },
    );
  }

  async handleTextInput(@Ctx() ctx: SessionContext) {
    if (!('text' in ctx.message)) return;

    const text = ctx.message.text.trim();

    try {
      switch (ctx.session.transferState) {
        case 'waiting_amount':
          await this.handleAmount(ctx, text);
          break;
        case 'waiting_debit':
          await this.handleDebit(ctx, text);
          break;
        case 'waiting_credit':
          await this.handleCredit(ctx, text);
          break;
        case 'waiting_description':
          await this.handleDescription(ctx, text);
          break;
      }
    } catch (error) {
      this.logger.error(`Error in transfer flow: ${error.message}`);
      await ctx.reply(
        'Error processing transfer. Please try again with /transfer.',
      );
      this.baseHandler.clearSession(ctx);
    }
  }

  private async handleAmount(ctx: SessionContext, text: string) {
    const amount = parseFloat(text.replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('Invalid amount. Please enter a positive number.');
      return;
    }

    ctx.session.transferAmount = amount;
    ctx.session.transferState = 'waiting_debit';

    await ctx.reply(
      `🔄 <b>Transfer</b>\n\n` +
        `Amount: $${amount.toFixed(2)}\n\n` +
        `Type the <b>debit</b> account name:`,
      { parse_mode: 'HTML' },
    );
  }

  private async handleDebit(ctx: SessionContext, text: string) {
    const matched = await this.transferService.matchAccount(text);
    if (!matched) {
      await ctx.reply('❌ Account not found. Please try again.');
      return;
    }

    ctx.session.transferDebitAccount = matched;
    ctx.session.transferState = 'waiting_credit';

    await ctx.reply(
      `🔄 <b>Transfer</b>\n\n` +
        `Amount: $${ctx.session.transferAmount!.toFixed(2)}\n` +
        `Debit: ${matched}\n\n` +
        `Type the <b>credit</b> account name:`,
      { parse_mode: 'HTML' },
    );
  }

  private async handleCredit(ctx: SessionContext, text: string) {
    const matched = await this.transferService.matchAccount(text);
    if (!matched) {
      await ctx.reply('❌ Account not found. Please try again.');
      return;
    }

    if (matched === ctx.session.transferDebitAccount) {
      await ctx.reply(
        '❌ Credit account must be different from debit. Please try again.',
      );
      return;
    }

    ctx.session.transferCreditAccount = matched;

    const rule = this.transferService.findTransferRule(
      ctx.session.transferDebitAccount!,
      matched,
    );

    if (rule) {
      const amount = ctx.session.transferAmount!;
      await this.transferService.applyCellUpdate(rule, amount);

      await ctx.reply(
        `✅ <b>Transfer Registered!</b>\n\n` +
          `Amount: $${amount.toFixed(2)}\n` +
          `Debit: ${ctx.session.transferDebitAccount}\n` +
          `Credit: ${matched}\n` +
          `Rule: ${rule.name}\n\n` +
          `Cell ${rule.cell} updated in Google Sheets.`,
        { parse_mode: 'HTML' },
      );

      this.baseHandler.clearSession(ctx);
      return;
    }

    ctx.session.transferState = 'waiting_description';

    await ctx.reply(
      `🔄 <b>Transfer</b>\n\n` +
        `Amount: $${ctx.session.transferAmount!.toFixed(2)}\n` +
        `Debit: ${ctx.session.transferDebitAccount}\n` +
        `Credit: ${matched}\n\n` +
        `Enter a <b>description</b> for this transfer:`,
      { parse_mode: 'HTML' },
    );
  }

  private async handleDescription(ctx: SessionContext, text: string) {
    const amount = ctx.session.transferAmount!;
    const debitAccount = ctx.session.transferDebitAccount!;
    const creditAccount = ctx.session.transferCreditAccount!;

    await this.transferService.createJournalEntry(
      amount,
      debitAccount,
      creditAccount,
      text,
    );

    await ctx.reply(
      `✅ <b>Transfer Registered!</b>\n\n` +
        `Amount: $${amount.toFixed(2)}\n` +
        `Debit: ${debitAccount}\n` +
        `Credit: ${creditAccount}\n` +
        `Description: ${text}\n\n` +
        `Journal entry created in Google Sheets.`,
      { parse_mode: 'HTML' },
    );

    this.baseHandler.clearSession(ctx);
  }
}
