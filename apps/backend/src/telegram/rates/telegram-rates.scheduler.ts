import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { TelegramRatesService } from './telegram-rates.service';

@Injectable()
export class TelegramRatesScheduler {
  private readonly logger = new Logger(TelegramRatesScheduler.name);
  private readonly chatId: string;

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly ratesService: TelegramRatesService,
  ) {
    // Get chatId from environment variable (same as notification listener)
    this.chatId = process.env.TELEGRAM_ALLOWED_USERS?.split(',')[0] || '';

    if (!this.chatId) {
      this.logger.warn('No TELEGRAM_ALLOWED_USERS configured - scheduled rates messages will not be sent');
    }
  }

  /**
   * Send daily exchange rates at 9 AM Venezuela time (13:00 UTC)
   * Venezuela is UTC-4, so 9 AM VET = 1 PM UTC
   * Cron expression: '0 13 * * *' runs at 13:00 UTC every day
   */
  @Cron('0 13 * * *', {
    timeZone: 'UTC',
  })
  async sendDailyRates() {
    try {
      if (!this.chatId) {
        this.logger.warn('No TELEGRAM_ALLOWED_USERS configured - skipping scheduled rates message');
        return;
      }

      this.logger.log('Sending scheduled daily exchange rates...');

      const message = await this.ratesService.getRatesMessage();

      await this.bot.telegram.sendMessage(this.chatId, message, {
        parse_mode: 'HTML',
      });

      this.logger.log(`✅ Daily exchange rates sent successfully to chat ${this.chatId}`);
    } catch (error) {
      this.logger.error(`Failed to send scheduled daily rates: ${error.message}`);
    }
  }
}
