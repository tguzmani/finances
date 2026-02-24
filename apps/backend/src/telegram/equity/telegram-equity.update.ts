import { Update, Ctx, Command } from 'nestjs-telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { SessionContext } from '../telegram.types';
import { TelegramEquityService } from './telegram-equity.service';
import { EquityChartService } from '../../equity/equity-chart.service';

@Update()
export class TelegramEquityUpdate {
  private readonly logger = new Logger(TelegramEquityUpdate.name);

  constructor(
    private readonly equityService: TelegramEquityService,
    private readonly chartService: EquityChartService,
  ) {}

  @Command('equity')
  @UseGuards(TelegramAuthGuard)
  async handleEquity(@Ctx() ctx: SessionContext) {
    try {
      this.logger.log('Handling /equity command');

      const loadingMsg = await ctx.reply('Fetching equity data and generating chart...');

      const [message, chartBuffer] = await Promise.all([
        this.equityService.getEquityMessage(),
        this.chartService.generateEquityChart(30),
      ]);

      const sentMsg = await ctx.replyWithPhoto(
        { source: chartBuffer },
        { caption: message, parse_mode: 'HTML' },
      );

      try {
        await ctx.telegram.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id);
      } catch (e) { /* loading message may already be deleted */ }

      setTimeout(async () => {
        try {
          await ctx.telegram.deleteMessage(sentMsg.chat.id, sentMsg.message_id);
        } catch (e) { /* message may already be deleted */ }
      }, 60_000);
    } catch (error) {
      this.logger.error(`Error in /equity command: ${error.message}`);
      await ctx.reply('Error fetching equity data. Please try again later.');
    }
  }
}
