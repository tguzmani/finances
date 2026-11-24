import { Logger, UseGuards } from '@nestjs/common';
import { Action, Ctx, Update } from 'nestjs-telegraf';
import { ClosingOutcome } from '@prisma/client';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { SessionContext } from '../telegram.types';
import { TelegramBaseHandler } from '../telegram-base.handler';
import { BookkeepingService } from '../../bookkeeping/bookkeeping.service';
import { TelegramBookkeepingService } from './telegram-bookkeeping.service';
import { TelegramBookkeepingPresenter } from './telegram-bookkeeping.presenter';

@Update()
export class TelegramBookkeepingUpdate {
  private readonly logger = new Logger(TelegramBookkeepingUpdate.name);

  constructor(
    private readonly bookkeepingService: BookkeepingService,
    private readonly telegramBookkeepingService: TelegramBookkeepingService,
    private readonly presenter: TelegramBookkeepingPresenter,
    private readonly baseHandler: TelegramBaseHandler,
  ) {}

  async handleDone(ctx: SessionContext): Promise<void> {
    this.baseHandler.clearSession(ctx);
    await this.startClosing(ctx);
  }

  @Action(/^cl_out:(\d+):(ALL_GOOD|SOME_ISSUES|BAD)$/)
  @UseGuards(TelegramAuthGuard)
  async handleOutcome(@Ctx() ctx: SessionContext) {
    const [closingId, outcome] = this.callbackArgs(ctx);

    try {
      await ctx.answerCbQuery();
      await this.bookkeepingService.setClosingOutcome(closingId, outcome as ClosingOutcome);

      // The outcome buttons give way to Skip, since the reply box below cannot
      // carry a button of its own.
      await ctx.editMessageReplyMarkup(this.presenter.skipNoteKeyboard(closingId));

      const prompt = await this.baseHandler.askForReply(ctx, '✏️ Why? Reply here, or tap Skip.');
      ctx.session.bookkeepingReply = {
        id: closingId,
        promptMessageId: prompt.message_id,
        skipMessageId: ctx.callbackQuery?.message?.message_id,
      };
    } catch (error) {
      this.logger.error(`Saving closing outcome failed: ${error.message}`);
      await ctx.reply('❌ Error saving the outcome. Please try again.');
    }
  }

  @Action(/^cl_skip:(\d+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleSkipNote(@Ctx() ctx: SessionContext) {
    await this.decide(ctx, async () => {
      ctx.session.bookkeepingReply = undefined;
      await ctx.reply('👍 Done for today.');
    });
  }

  /** True when the message answers the note question this flow is waiting on. */
  isAwaitedReply(ctx: SessionContext): boolean {
    const awaited = ctx.session.bookkeepingReply;
    if (!awaited || !ctx.message || !('reply_to_message' in ctx.message)) return false;

    return ctx.message.reply_to_message?.message_id === awaited.promptMessageId;
  }

  async handleReply(ctx: SessionContext): Promise<void> {
    const awaited = ctx.session.bookkeepingReply;
    if (!awaited || !ctx.message || !('text' in ctx.message)) return;

    const note = ctx.message.text.trim();
    ctx.session.bookkeepingReply = undefined;

    try {
      await this.bookkeepingService.setClosingNote(awaited.id, note);
      if (awaited.skipMessageId && ctx.chat) {
        await ctx.telegram
          .editMessageReplyMarkup(ctx.chat.id, awaited.skipMessageId, undefined, undefined)
          .catch(() => undefined); // The note is saved regardless of the stale button
      }
      await ctx.reply('📝 Note saved. Done for today.');
    } catch (error) {
      this.logger.error(`Saving bookkeeping note failed: ${error.message}`);
      await ctx.reply('❌ Error saving the note. Please try again.');
    }
  }

  private async startClosing(ctx: SessionContext): Promise<void> {
    try {
      const { text, keyboard } = await this.baseHandler.withTyping(ctx, () =>
        this.telegramBookkeepingService.close(),
      );

      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    } catch (error) {
      this.logger.error(`Closing failed: ${error.message}`);
      await ctx.reply('❌ Error closing the day. Please try again.');
    }
  }

  /** Answers the tap and strips the buttons, so the decision cannot be taken twice. */
  private async decide(ctx: SessionContext, work: () => Promise<void>): Promise<void> {
    try {
      await ctx.answerCbQuery();
      await this.baseHandler.removeButtons(ctx);
      await work();
    } catch (error) {
      this.logger.error(`Bookkeeping action failed: ${error.message}`);
      await ctx.reply('❌ Error saving the answer. Please try again.');
    }
  }

  /** The id and, when present, the choice encoded in the button's callback data. */
  private callbackArgs(ctx: SessionContext): [number, string] {
    const data = ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
    const [, id, choice] = data.split(':');
    return [Number(id), choice];
  }
}
