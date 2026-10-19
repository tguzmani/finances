import { Update, Ctx } from 'nestjs-telegraf';
import { Logger } from '@nestjs/common';
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

  async handleTextInput(@Ctx() ctx: SessionContext) {
    if (!ctx.message || !('text' in ctx.message)) return;

    ctx.session.reconcileWaiting = false;

    try {
      const report = await this.baseHandler.withTyping(ctx, () =>
        this.reconcileService.reconcileText((ctx.message as { text: string }).text),
      );

      await ctx.reply(this.presenter.formatReport(report), { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error(`Statement check failed: ${error.message}`);
      await ctx.reply('❌ Error reading that statement. Please try again with /reconcile.');
    }
  }
}
