import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { OpenRouterService } from '../common/open-router.service';

@Injectable()
export class TelegramScheduler {
  private readonly logger = new Logger(TelegramScheduler.name);
  private readonly chatId: string;

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly openRouterService: OpenRouterService,
  ) {
    this.chatId = process.env.TELEGRAM_ALLOWED_USERS?.split(',')[0] || '';

    if (!this.chatId) {
      this.logger.warn('No TELEGRAM_ALLOWED_USERS configured - scheduled messages will not be sent');
    }
  }

  /**
   * Check OpenRouter balance daily at 9 AM Venezuela time (13:00 UTC)
   */
  @Cron('0 13 * * *', {
    timeZone: 'UTC',
  })
  async checkOpenRouterBalance() {
    try {
      if (!this.chatId) {
        return;
      }

      const { balance, isLow } = await this.openRouterService.checkBalance();

      if (isLow) {
        this.logger.warn(`OpenRouter balance is low: $${balance.toFixed(2)}`);

        await this.bot.telegram.sendMessage(
          this.chatId,
          `⚠️ <b>Low OpenRouter Balance</b>\n\n` +
          `Current balance: <b>$${balance.toFixed(2)}</b>\n\n` +
          `Please add credits to avoid service interruption.`,
          { parse_mode: 'HTML' }
        );
      } else {
        this.logger.log(`OpenRouter balance OK: $${balance.toFixed(2)}`);
      }
    } catch (error) {
      this.logger.error(`Failed to check OpenRouter balance: ${error.message}`);
    }
  }
}
