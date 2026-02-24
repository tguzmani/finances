import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { EquityService } from '../../equity/equity.service';
import { EquityChartService } from '../../equity/equity-chart.service';
import { TelegramEquityService } from './telegram-equity.service';

@Injectable()
export class TelegramEquityScheduler {
  private readonly logger = new Logger(TelegramEquityScheduler.name);
  private readonly chatId: string;

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly equityService: EquityService,
    private readonly chartService: EquityChartService,
    private readonly telegramEquityService: TelegramEquityService,
  ) {
    this.chatId = process.env.TELEGRAM_ALLOWED_USERS?.split(',')[0] || '';

    if (!this.chatId) {
      this.logger.warn(
        'No TELEGRAM_ALLOWED_USERS configured - scheduled equity snapshots will not be sent',
      );
    }
  }

  /**
   * Capture equity snapshots and send notification at 4 AM UTC (12 AM Venezuela time)
   * Venezuela is UTC-4, so 12 AM VET = 4 AM UTC
   */
  @Cron('0 4 * * *', { timeZone: 'UTC' })
  async captureAndSendEquity() {
    try {
      if (!this.chatId) {
        this.logger.warn(
          'No TELEGRAM_ALLOWED_USERS configured - skipping equity capture',
        );
        return;
      }

      this.logger.log('Capturing daily equity snapshots...');
      await this.equityService.captureAllSnapshots();

      const [message, chartBuffer] = await Promise.all([
        this.telegramEquityService.getEquityMessage(),
        this.chartService.generateEquityChart(30),
      ]);

      await this.bot.telegram.sendPhoto(
        this.chatId,
        { source: chartBuffer },
        { caption: message, parse_mode: 'HTML' },
      );

      this.logger.log(
        `Daily equity snapshot captured and sent to chat ${this.chatId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to capture/send equity snapshots: ${error.message}`,
      );
    }
  }
}
