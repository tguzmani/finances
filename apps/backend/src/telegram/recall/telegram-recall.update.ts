import { Logger, UseGuards } from '@nestjs/common';
import { Action, Ctx, Update } from 'nestjs-telegraf';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { SessionContext } from '../telegram.types';
import { TelegramBaseHandler } from '../telegram-base.handler';
import { TransactionsService } from '../../transactions/transactions.service';
import { ExchangeRateService } from '../../exchanges/exchange-rate.service';
import { TransactionPlatform, TransactionType } from '../../transactions/transaction.types';
import { TransactionManualCreatedEvent } from '../../transactions/events/transaction-manual-created.event';
import { parseWrittenAmount } from '../../common/written-amount';
import { RecallExtractionService, RecalledDraft } from './recall-extraction.service';
import { TelegramRecallPresenter } from './telegram-recall.presenter';

/**
 * /recall registers transactions the user remembers days later, several per
 * message: "hicimos mercado por casi 63000 y Esther me dio 40000, luego otro
 * por 22000...". The LLM splits the recollection into entries; each one is
 * confirmed on its own before anything is written.
 *
 * A hedged amount is saved with `isEstimate` and the sentence it came from, so
 * the figure is in the ledger today and still traceable when the receipt shows
 * up. A figure nobody wrote down is worth more in the ledger, marked, than in a
 * note nobody reads.
 */
@Update()
export class TelegramRecallUpdate {
  private readonly logger = new Logger(TelegramRecallUpdate.name);

  constructor(
    private readonly extractionService: RecallExtractionService,
    private readonly presenter: TelegramRecallPresenter,
    private readonly transactionsService: TransactionsService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly baseHandler: TelegramBaseHandler,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** `/recall <text>` reads it straight away; `/recall` alone asks for it. */
  async handleRecall(ctx: SessionContext): Promise<void> {
    const args = this.baseHandler.getCommandArgs(ctx);
    this.baseHandler.clearSession(ctx);

    if (args) {
      await this.readRecollection(ctx, args);
      return;
    }

    const prompt = await this.baseHandler.askForReply(
      ctx,
      '🧠 What do you remember? Several transactions in one message is fine — ' +
      'amounts can be rough, they get marked as estimates.',
    );
    ctx.session.recall = { waitingPromptMessageId: prompt.message_id };
  }

  /** True when the message answers a question this flow is waiting on. */
  isAwaitedReply(ctx: SessionContext): boolean {
    const recall = ctx.session.recall;
    if (!recall || !ctx.message || !('reply_to_message' in ctx.message)) return false;

    const repliedTo = ctx.message.reply_to_message?.message_id;
    return (
      repliedTo !== undefined &&
      (repliedTo === recall.waitingPromptMessageId || repliedTo === recall.amountPromptMessageId)
    );
  }

  async handleReply(ctx: SessionContext): Promise<void> {
    const recall = ctx.session.recall;
    if (!recall || !ctx.message || !('text' in ctx.message)) return;

    const text = ctx.message.text.trim();

    if (recall.amountPromptMessageId) {
      await this.applyCorrectedAmount(ctx, text);
      return;
    }

    recall.waitingPromptMessageId = undefined;
    await this.readRecollection(ctx, text);
  }

  @Action(/^recall_save:(\d+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleSave(@Ctx() ctx: SessionContext) {
    await this.decide(ctx, async (draft) => {
      await this.save(ctx, draft);
      await this.advance(ctx);
    });
  }

  @Action(/^recall_amount:(\d+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleAmount(@Ctx() ctx: SessionContext) {
    await this.decide(ctx, async (draft) => {
      const prompt = await this.baseHandler.askForReply(
        ctx,
        `✏️ What was the real amount for "${draft.description ?? 'this entry'}"? ` +
        `Send the figure in ${draft.currency ?? 'the same currency'}.`,
      );
      ctx.session.recall!.amountPromptMessageId = prompt.message_id;
    });
  }

  @Action(/^recall_skip:(\d+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleSkip(@Ctx() ctx: SessionContext) {
    await this.decide(ctx, async () => {
      const recall = ctx.session.recall!;
      recall.skipped = (recall.skipped ?? 0) + 1;
      await this.advance(ctx);
    });
  }

  @Action(/^recall_cancel:(\d+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleCancel(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Cancelled');
      await this.baseHandler.removeButtons(ctx);
      const saved = ctx.session.recall?.saved ?? 0;
      this.baseHandler.clearSession(ctx);

      const kept = saved > 0 ? ` ${saved} already saved ${saved === 1 ? 'entry stays' : 'entries stay'}.` : '';
      await ctx.reply(`🚫 Recall cancelled.${kept}`);
    } catch (error) {
      this.logger.error(`Cancelling recall failed: ${error.message}`);
    }
  }

  private async readRecollection(ctx: SessionContext, text: string): Promise<void> {
    let drafts: RecalledDraft[];
    try {
      drafts = await this.baseHandler.withTyping(ctx, () => this.extractionService.extract(text));
    } catch (error) {
      this.logger.error(`Recall extraction failed: ${error.message}`);
      await ctx.reply('⚠️ Could not read that. Please try again, or add one transaction at a time.');
      return;
    }

    // An entry with no amount or no account cannot be written, and guessing
    // either one is exactly what this flow must not do
    const usable = drafts.filter((draft) => draft.amount && draft.platform);
    const unusable = drafts.length - usable.length;

    if (unusable > 0) {
      await ctx.reply(this.presenter.unusable(unusable), { parse_mode: 'HTML' });
    }

    if (usable.length === 0) {
      this.baseHandler.clearSession(ctx);
      await ctx.reply(this.presenter.notATransaction());
      return;
    }

    ctx.session.recall = {
      sourceText: text,
      drafts: usable,
      index: 0,
      saved: 0,
      skipped: 0,
    };

    await this.showCard(ctx);
  }

  private async showCard(ctx: SessionContext): Promise<void> {
    const recall = ctx.session.recall!;
    const index = recall.index ?? 0;
    const draft = recall.drafts![index];

    const internalRate = await this.getInternalRate(draft.currency);
    const { text, keyboard } = this.presenter.card(
      draft,
      index,
      recall.drafts!.length,
      internalRate,
    );

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
  }

  private async applyCorrectedAmount(ctx: SessionContext, text: string): Promise<void> {
    const recall = ctx.session.recall!;
    // Both "63.000,50" and "63,000.50" are typed here, so the shared reader settles it
    const amount = parseWrittenAmount(text);

    if (amount === null || amount <= 0) {
      await ctx.reply('❌ Invalid amount. Please send a positive number.');
      return;
    }

    recall.amountPromptMessageId = undefined;
    const draft = recall.drafts![recall.index ?? 0];
    // Typed by hand against the real figure, so it is no longer a recollection
    draft.amount = amount;
    draft.approximate = false;

    await this.save(ctx, draft);
    await this.advance(ctx);
  }

  private async save(ctx: SessionContext, draft: RecalledDraft): Promise<void> {
    const recall = ctx.session.recall!;
    const platform = draft.platform as TransactionPlatform;
    const date = draft.date ? new Date(draft.date) : undefined;

    const transaction = await this.transactionsService.createManualTransaction({
      type: (draft.type ?? 'EXPENSE') as TransactionType,
      platform,
      currency: draft.currency ?? this.transactionsService.getCurrencyForPlatform(platform),
      amount: draft.amount!,
      description: draft.description ?? 'Recalled transaction',
      method: draft.method as any,
      date: date && !isNaN(date.getTime()) ? date : undefined,
      isEstimate: draft.approximate,
      sourceNote: recall.sourceText,
    });

    recall.saved = (recall.saved ?? 0) + 1;

    const marker = draft.approximate ? '≈ ' : '';
    await ctx.reply(
      `✅ Saved: <b>${draft.description}</b> — ${marker}${transaction.currency} ` +
      `${Number(transaction.amount).toFixed(2)}`,
      { parse_mode: 'HTML' },
    );

    // Sheet update and auto-registration run off the same event as every other
    // manual entry, so a recalled transaction lands in the ledger the same way
    this.eventEmitter.emit(
      'transaction.manual.created',
      new TransactionManualCreatedEvent(transaction),
    );
  }

  private async advance(ctx: SessionContext): Promise<void> {
    const recall = ctx.session.recall!;
    const next = (recall.index ?? 0) + 1;

    if (next < recall.drafts!.length) {
      recall.index = next;
      await this.showCard(ctx);
      return;
    }

    const { saved, skipped } = { saved: recall.saved ?? 0, skipped: recall.skipped ?? 0 };
    this.baseHandler.clearSession(ctx);
    await ctx.reply(this.presenter.summary(saved, skipped), { parse_mode: 'HTML' });
  }

  /**
   * Answers the tap, strips the buttons and hands over the entry it refers to.
   * A tap on an older card is ignored: the queue has moved on, and acting on a
   * stale index would save the wrong entry.
   */
  private async decide(
    ctx: SessionContext,
    work: (draft: RecalledDraft) => Promise<void>,
  ): Promise<void> {
    const data = ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
    const index = Number(data.split(':')[1]);
    const recall = ctx.session.recall;

    if (!recall?.drafts || index !== (recall.index ?? 0)) {
      await ctx.answerCbQuery('That entry was already decided');
      await this.baseHandler.removeButtons(ctx);
      return;
    }

    try {
      await ctx.answerCbQuery();
      await this.baseHandler.removeButtons(ctx);
      await work(recall.drafts[index]);
    } catch (error) {
      this.logger.error(`Recall action failed: ${error.message}`);
      await ctx.reply('❌ Error saving the entry. Please try again.');
    }
  }

  /** Latest internal rate, only for VES, so the card can show the USD figure. */
  private async getInternalRate(currency?: string | null): Promise<number | undefined> {
    if (currency !== 'VES') return undefined;

    try {
      const rate = await this.exchangeRateService.findLatest();
      const value = rate ? Number(rate.value) : 0;
      return value > 0 ? value : undefined;
    } catch (error) {
      this.logger.error(`Could not fetch internal exchange rate: ${error.message}`);
      return undefined;
    }
  }
}
