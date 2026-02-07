import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { NewTransactionsEvent } from '../../transactions/events/new-transactions.event';
import { NewExchangesEvent } from '../../exchanges/events/new-exchanges.event';
import { ExchangeRateService } from '../../exchanges/exchange-rate.service';
import { TelegramTransactionsPresenter } from '../transactions/telegram-transactions.presenter';
import { TelegramExchangesPresenter } from '../exchanges/telegram-exchanges.presenter';

@Injectable()
export class TelegramNotificationListener {
  private readonly logger = new Logger(TelegramNotificationListener.name);
  private readonly chatId: string;

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly transactionsPresenter: TelegramTransactionsPresenter,
    private readonly exchangesPresenter: TelegramExchangesPresenter,
  ) {
    // Get chatId from environment variable
    this.chatId = process.env.TELEGRAM_ALLOWED_USERS?.split(',')[0] || '';

    if (!this.chatId) {
      this.logger.warn('No TELEGRAM_ALLOWED_USERS configured - notifications will not be sent');
    }
  }

  @OnEvent('transactions.new')
  async handleNewTransactions(event: NewTransactionsEvent) {
    if (!this.chatId) return;

    try {
      const { transactions } = event;

      // Get latest exchange rate for USD conversion
      const latestRate = await this.exchangeRateService.findLatest();
      const exchangeRate = latestRate ? Number(latestRate.value) : undefined;

      // Send ONE message PER transaction
      for (const transaction of transactions) {
        // Format message with transaction details
        const message = this.transactionsPresenter.formatForNotification(transaction, exchangeRate);

        // Add inline keyboard with Name and Reject buttons
        const keyboard = {
          inline_keyboard: [
            [
              {
                text: '✏️ Name',
                callback_data: `notification_tx_name_${transaction.id}`
              },
              {
                text: '❌ Reject',
                callback_data: `notification_tx_reject_${transaction.id}`
              }
            ]
          ]
        };

        await this.bot.telegram.sendMessage(this.chatId, message, {
          parse_mode: 'HTML',
          reply_markup: keyboard
        });

        this.logger.log(`Sent notification for transaction ${transaction.id} to chat ${this.chatId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send transaction notification: ${error.message}`);
    }
  }

  @OnEvent('exchanges.new')
  async handleNewExchanges(event: NewExchangesEvent) {
    if (!this.chatId) return;

    try {
      const { exchanges } = event;

      // Send ONE message PER exchange
      for (const exchange of exchanges) {
        // Format message with exchange details
        const message = this.exchangesPresenter.formatForNotification(exchange);

        // Add inline keyboard with Accept and Reject buttons
        const keyboard = {
          inline_keyboard: [
            [
              {
                text: '✅ Accept',
                callback_data: `notification_ex_accept_${exchange.id}`
              },
              {
                text: '❌ Reject',
                callback_data: `notification_ex_reject_${exchange.id}`
              }
            ]
          ]
        };

        await this.bot.telegram.sendMessage(this.chatId, message, {
          parse_mode: 'HTML',
          reply_markup: keyboard
        });

        this.logger.log(`Sent notification for exchange ${exchange.id} to chat ${this.chatId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send exchange notification: ${error.message}`);
    }
  }
}
