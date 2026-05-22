import { Update, Ctx, Command, Action } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { SessionContext } from '../telegram.types';
import { TelegramExpensesService } from './telegram-expenses.service';

@Update()
export class TelegramExpensesUpdate {
  private readonly logger = new Logger(TelegramExpensesUpdate.name);

  constructor(private readonly expensesService: TelegramExpensesService) {}

  @Command('expenses')
  @UseGuards(TelegramAuthGuard)
  async handleExpenses(@Ctx() ctx: SessionContext) {
    try {
      this.logger.log('Handling /expenses command');

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Overview', 'expenses_overview')],
        [Markup.button.callback('Detailed', 'expenses_detailed')],
      ]);

      await ctx.reply('<b>Expenses</b>\n\nSelect a view:', {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } catch (error) {
      this.logger.error(`Error in /expenses command: ${error.message}`);
      await ctx.reply('Error loading expenses menu. Please try again.');
    }
  }

  @Action('expenses_overview')
  @UseGuards(TelegramAuthGuard)
  async handleOverview(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      const loadingMsg = await ctx.reply('Fetching expenses overview...');

      const message = await this.expensesService.getOverviewMessage();
      const sentMsg = await ctx.reply(message, { parse_mode: 'HTML' });

      try {
        await ctx.telegram.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id);
      } catch (e) { /* loading message may already be deleted */ }

      setTimeout(async () => {
        try {
          await ctx.telegram.deleteMessage(sentMsg.chat.id, sentMsg.message_id);
        } catch (e) { /* message may already be deleted */ }
      }, 60_000);
    } catch (error) {
      this.logger.error(`Error fetching expenses overview: ${error.message}`);
      await ctx.reply('Error fetching expenses overview. Please try again.');
    }
  }

  @Action('expenses_detailed')
  @UseGuards(TelegramAuthGuard)
  async handleDetailed(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      const loadingMsg = await ctx.reply('Generating expenses report...');

      const [chart, message] = await Promise.all([
        this.expensesService.getExpensesChart(),
        this.expensesService.getDetailedMessage(),
      ]);

      await ctx.replyWithPhoto({ source: chart });
      await ctx.reply(message, { parse_mode: 'HTML' });

      try {
        await ctx.telegram.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id);
      } catch (e) { /* loading message may already be deleted */ }
    } catch (error) {
      this.logger.error(`Error fetching expenses details: ${error.message}`);
      await ctx.reply('Error fetching expenses details. Please try again.');
    }
  }
}
