import { Update, Ctx, Action } from 'nestjs-telegraf';
import { Logger, UseGuards } from '@nestjs/common';
import { Markup } from 'telegraf';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { SessionContext } from '../telegram.types';
import { TelegramBaseHandler } from '../telegram-base.handler';
import { TelegramReconcileService } from './telegram-reconcile.service';
import { RECONCILE_PROMPT, TelegramReconcilePresenter } from './telegram-reconcile.presenter';

@Update()
export class TelegramReconcileUpdate {
  private readonly logger = new Logger(TelegramReconcileUpdate.name);

  constructor(
    private readonly reconcileService: TelegramReconcileService,
    private readonly presenter: TelegramReconcilePresenter,
    private readonly baseHandler: TelegramBaseHandler,
  ) {}

  /**
   * `/reconcile` reads a page of the bank's own movements and says which of
   * them the bot has and which it does not.
   *
   * Asking one amount at a time is what /find is for. This is the other
   * question: everything the bank charged over a few days, against everything
   * that reached the bot, in one answer.
   */
  async handleReconcile(@Ctx() ctx: SessionContext) {
    this.baseHandler.clearSession(ctx);
    ctx.session.reconcileWaiting = true;

    await this.baseHandler.askForReply(ctx, RECONCILE_PROMPT);
  }

  /**
   * A statement runs over several pages, so the flow stays open after each
   * report and reads the next paste as more of the same statement. Until the
   * user leaves it, typed text belongs to the check and not to a new
   * transaction.
   */
  async handleTextInput(@Ctx() ctx: SessionContext) {
    if (!ctx.message || !('text' in ctx.message)) return;

    try {
      const report = await this.baseHandler.withTyping(ctx, () =>
        this.reconcileService.reconcileText((ctx.message as { text: string }).text),
      );

      await ctx.reply(this.presenter.formatReport(report), {
        parse_mode: 'HTML',
        ...this.exitKeyboard(),
      });
    } catch (error) {
      this.logger.error(`Statement check failed: ${error.message}`);
      await ctx.reply(
        '❌ Error reading that statement. Paste it again, or leave the check below.',
        this.exitKeyboard(),
      );
    }
  }

  @Action('reconcile_exit')
  @UseGuards(TelegramAuthGuard)
  async handleExit(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Cancelled');
      await this.baseHandler.removeButtons(ctx);
      this.baseHandler.clearSession(ctx);
      await ctx.reply('🚫 Reconcile cancelled.');
    } catch {
      await ctx.answerCbQuery('Error');
    }
  }

  private exitKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.callback('🚪 Exit reconcile', 'reconcile_exit')],
    ]);
  }
}
