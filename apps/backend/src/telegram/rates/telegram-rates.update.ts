import { Update, Ctx, Command } from 'nestjs-telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { SessionContext } from '../telegram.types';
import { TelegramRatesService } from './telegram-rates.service';
import { ExchangeRateChartService } from '../../exchanges/exchange-rate-chart.service';

@Update()
export class TelegramRatesUpdate {
  private readonly logger = new Logger(TelegramRatesUpdate.name);

  constructor(
    private readonly ratesService: TelegramRatesService,
    private readonly chartService: ExchangeRateChartService,
  ) {}

  @Command('rates')
  @UseGuards(TelegramAuthGuard)
  async handleRates(@Ctx() ctx: SessionContext) {
    try {
      this.logger.log('Handling /rates command');

      // Send "fetching" message
      await ctx.reply('⏳ Fetching rates and generating chart...');

      // Generate chart and message in parallel
      const [message, chartBuffer] = await Promise.all([
        this.ratesService.getRatesMessage(),
        this.chartService.generateRatesChart(30),
      ]);

      // Send chart with rates message as caption
      await ctx.replyWithPhoto(
        { source: chartBuffer },
        { caption: message, parse_mode: 'HTML' }
      );
    } catch (error) {
      this.logger.error(`Error in /rates command: ${error.message}`);
      await ctx.reply('Error fetching rates. Please try again later.');
    }
  }
}
