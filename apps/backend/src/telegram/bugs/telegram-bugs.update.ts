import { Logger, UseGuards } from '@nestjs/common';
import { Action, Ctx, Update } from 'nestjs-telegraf';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { SessionContext } from '../telegram.types';
import { TelegramBaseHandler } from '../telegram-base.handler';
import { BugReportService } from '../../bug-reports/bug-report.service';
import { TelegramBugsPresenter } from './telegram-bugs.presenter';

/**
 * /bug files whatever the user types, as typed. The text often carries figures
 * ("el /convert usó la tasa de ayer"), so the reply is matched by the question
 * it answers and never reaches the freeform transaction reader.
 */
@Update()
export class TelegramBugsUpdate {
  private readonly logger = new Logger(TelegramBugsUpdate.name);

  constructor(
    private readonly bugReportService: BugReportService,
    private readonly presenter: TelegramBugsPresenter,
    private readonly baseHandler: TelegramBaseHandler,
  ) {}

  /** `/bug el convert usa la tasa de ayer` files in one go; `/bug` alone asks. */
  async handleBug(ctx: SessionContext): Promise<void> {
    const args = this.baseHandler.getCommandArgs(ctx);
    this.baseHandler.clearSession(ctx);

    if (args) {
      await this.file(ctx, args);
      return;
    }

    const prompt = await this.baseHandler.askForReply(
      ctx,
      '🐞 What went wrong? Describe it however you want — it gets stored as typed.',
    );
    ctx.session.bugReportReply = { promptMessageId: prompt.message_id };
  }

  async handleBugs(ctx: SessionContext): Promise<void> {
    try {
      const bugs = await this.bugReportService.findOpen();
      await ctx.reply(this.presenter.openList(bugs), { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error(`Listing bugs failed: ${error.message}`);
      await ctx.reply('❌ Error reading the bug list. Please try again.');
    }
  }

  /** True when the message answers the question /bug is waiting on. */
  isAwaitedReply(ctx: SessionContext): boolean {
    const awaited = ctx.session.bugReportReply;
    if (!awaited || !ctx.message || !('reply_to_message' in ctx.message)) return false;

    return ctx.message.reply_to_message?.message_id === awaited.promptMessageId;
  }

  async handleReply(ctx: SessionContext): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) return;

    ctx.session.bugReportReply = undefined;
    await this.file(ctx, ctx.message.text.trim());
  }

  @Action(/^bug_discard:(\d+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleDiscard(@Ctx() ctx: SessionContext) {
    const data = ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
    const id = Number(data.split(':')[1]);

    try {
      await ctx.answerCbQuery();
      await this.baseHandler.removeButtons(ctx);
      await this.bugReportService.discard(id);
      await ctx.editMessageText('🚫 Bug report discarded.');
    } catch (error) {
      this.logger.error(`Discarding bug ${id} failed: ${error.message}`);
      await ctx.reply('❌ Error discarding the report. Please try again.');
    }
  }

  private async file(ctx: SessionContext, text: string): Promise<void> {
    if (!text) {
      await ctx.reply('❌ Nothing to file. Send /bug with a description.');
      return;
    }

    try {
      const bug = await this.bugReportService.report(text);
      const { text: message, keyboard } = this.presenter.filed(bug);
      await ctx.reply(message, { parse_mode: 'HTML', reply_markup: keyboard });
    } catch (error) {
      this.logger.error(`Filing bug failed: ${error.message}`);
      await ctx.reply('❌ Error filing the report. Please try again.');
    }
  }
}
