import { Update, Ctx, Command, Action } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { SessionContext } from '../telegram.types';
import { TelegramRatesService } from './telegram-rates.service';
import {
  ExchangeRateChartService,
  RatesChartMode,
} from '../../exchanges/exchange-rate-chart.service';

const CHART_DAYS = 30;

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

      const { chartBuffer, caption, keyboard } = await this.buildChartMessage('absolute');

      // Send chart with rates message as caption
      await ctx.replyWithPhoto(
        { source: chartBuffer },
        { caption, parse_mode: 'HTML', ...keyboard }
      );
    } catch (error) {
      this.logger.error(`Error in /rates command: ${error.message}`);
      await ctx.reply('Error fetching rates. Please try again later.');
    }
  }

  @Action(/^rates_chart_(absolute|discount)$/)
  @UseGuards(TelegramAuthGuard)
  async handleChartModeSwitch(@Ctx() ctx: SessionContext) {
    const match = (ctx as any).match as RegExpMatchArray;
    const mode = match[1] as RatesChartMode;

    try {
      this.logger.log(`Switching rates chart to ${mode} mode`);

      await ctx.answerCbQuery('⏳ Generating chart...');

      const { chartBuffer, caption, keyboard } = await this.buildChartMessage(mode);

      await ctx.editMessageMedia(
        {
          type: 'photo',
          media: { source: chartBuffer },
          caption,
          parse_mode: 'HTML',
        },
        keyboard
      );
    } catch (error) {
      this.logger.error(`Error switching rates chart to ${mode}: ${error.message}`);
      await ctx.answerCbQuery('Error generating chart. Please try again.');
    }
  }

  /**
   * Build the chart, its caption and the button that toggles to the other mode
   */
  private async buildChartMessage(mode: RatesChartMode) {
    const [caption, chartBuffer] = await Promise.all([
      this.ratesService.getRatesMessage(),
      this.chartService.generateRatesChart(CHART_DAYS, mode),
    ]);

    const keyboard =
      mode === 'absolute'
        ? Markup.inlineKeyboard([
            [Markup.button.callback('📉 Show discount %', 'rates_chart_discount')],
          ])
        : Markup.inlineKeyboard([
            [Markup.button.callback('📈 Show absolute rates', 'rates_chart_absolute')],
          ]);

    return { chartBuffer, caption, keyboard };
  }
}
