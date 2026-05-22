import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { NewTransactionsEvent } from '../../transactions/events/new-transactions.event';
import { NewExchangesEvent } from '../../exchanges/events/new-exchanges.event';
import { ExchangeRateService } from '../../exchanges/exchange-rate.service';
import { TelegramTransactionsPresenter } from '../transactions/telegram-transactions.presenter';

@Injectable()
export class TelegramNotificationListener {
  private readonly logger = new Logger(TelegramNotificationListener.name);
  private readonly chatId: string;

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly transactionsPresenter: TelegramTransactionsPresenter,
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

  @OnEvent('transactions.auto-registered')
  async handleAutoRegisteredTransactions(event: NewTransactionsEvent) {
    if (!this.chatId) return;

    try {
      for (const transaction of event.transactions) {
        const amount = Number(transaction.amount).toFixed(2);
        const message =
          `✅ <b>Auto-Registered</b>\n` +
          `<b>${transaction.description}</b>\n\n` +
          `${transaction.currency} ${amount}\n` +
          `Status: Registered (sheet updated)`;

        await this.bot.telegram.sendMessage(this.chatId, message, {
          parse_mode: 'HTML',
        });

        this.logger.log(`Sent auto-registration notification for transaction ${transaction.id}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send auto-registration notification: ${error.message}`);
    }
  }

  @OnEvent('exchanges.new')
  async handleNewExchanges(event: NewExchangesEvent) {
    if (!this.chatId) return;

    try {
      const { exchanges } = event;

      // Send notification for each exchange
      for (const exchange of exchanges) {
        const amountGross = Number(exchange.amountGross).toFixed(2);
        const unitPrice = Number(exchange.exchangeRate).toFixed(2);
        const fiatAmount = Number(exchange.fiatAmount).toFixed(2);

        const message =
          `💱 Sold ${amountGross} USDT for ${unitPrice} VES/USDT ` +
          `for a total ${fiatAmount} VES`;

        await this.bot.telegram.sendMessage(this.chatId, message, {
          parse_mode: 'HTML',
        });

        this.logger.log(`Sent notification for exchange ${exchange.orderNumber} to chat ${this.chatId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send exchange notification: ${error.message}`);
    }
  }
}
