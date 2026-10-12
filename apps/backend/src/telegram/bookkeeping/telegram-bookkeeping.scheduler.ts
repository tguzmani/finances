import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CheckInTrigger } from '@prisma/client';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { TelegramBookkeepingService } from './telegram-bookkeeping.service';

@Injectable()
export class TelegramBookkeepingScheduler {
  private readonly logger = new Logger(TelegramBookkeepingScheduler.name);
  private readonly chatId: string;

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly bookkeepingService: TelegramBookkeepingService,
  ) {
    this.chatId = process.env.TELEGRAM_ALLOWED_USERS?.split(',')[0] || '';

    if (!this.chatId) {
      this.logger.warn('No TELEGRAM_ALLOWED_USERS configured - daily check-ins will not be sent');
    }
  }

  /**
   * Daily check-in at 9 PM Venezuela time, weekends included.
   * Venezuela is UTC-4, so 9 PM VET = 01:00 UTC the next day.
   */
  @Cron('0 1 * * *', { timeZone: 'UTC' })
  async sendDailyCheckIn() {
    if (!this.chatId) return;

    try {
      const { text, keyboard } = await this.bookkeepingService.openCheckIn(CheckInTrigger.SCHEDULED);

      await this.bot.telegram.sendMessage(this.chatId, text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });

      this.logger.log('Daily check-in sent');
    } catch (error) {
      this.logger.error(`Failed to send daily check-in: ${error.message}`);
    }
  }
}
