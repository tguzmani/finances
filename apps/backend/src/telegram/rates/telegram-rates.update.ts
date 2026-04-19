import { Update, Ctx, Command, Action } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { SessionContext } from '../telegram.types';
import { TelegramRatesService } from './telegram-rates.service';
import { ExchangeRateChartService } from '../../exchanges/exchange-rate-chart.service';

@Update()
export class TelegramRatesUpdate {
  private readonly logger = new Logger(TelegramRatesUpdate.name);

  static readonly BINANCE_COMPARISON_KEYBOARD = Markup.inlineKeyboard([
    [Markup.button.callback('💹 vs Binance', 'rates_vs_binance')],
  ]);

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

      // Send chart with rates message as caption and inline button
      await ctx.replyWithPhoto(
        { source: chartBuffer },
        {
          caption: message,
          parse_mode: 'HTML',
          ...TelegramRatesUpdate.BINANCE_COMPARISON_KEYBOARD,
        }
      );
    } catch (error) {
      this.logger.error(`Error in /rates command: ${error.message}`);
      await ctx.reply('Error fetching rates. Please try again later.');
    }
  }

  @Action('rates_vs_binance')
  @UseGuards(TelegramAuthGuard)
  async handleBinanceComparison(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();

      const message = await this.ratesService.getBinanceComparisonMessage();

      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error(`Error in vs Binance action: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error fetching Binance comparison. Please try again later.');
    }
  }
}
