import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { NewTransactionsEvent } from '../../transactions/events/new-transactions.event';
import { NewExchangesEvent } from '../../exchanges/events/new-exchanges.event';
import { ExchangeRateService } from '../../exchanges/exchange-rate.service';

@Injectable()
export class TelegramNotificationListener {
  private readonly logger = new Logger(TelegramNotificationListener.name);
  private readonly chatId: string;

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly exchangeRateService: ExchangeRateService,
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
      const { transactions, totalAmount, currency } = event;
      const count = transactions.length;
      const plural = count > 1 ? 's' : '';

      // Get latest exchange rate for USD conversion
      let usdAmount = '';
      if (currency === 'VES') {
        const latestRate = await this.exchangeRateService.findLatest();
        if (latestRate) {
          const exchangeRate = Number(latestRate.value);
          const usd = totalAmount / exchangeRate;
          usdAmount = ` (USD ${usd.toFixed(2)})`;
        }
      }

      const message =
        `💰 Got ${count} new transfer${plural} for ` +
        `${currency} ${totalAmount.toFixed(2)}${usdAmount}`;

      await this.bot.telegram.sendMessage(this.chatId, message, {
        parse_mode: 'HTML',
      });

      this.logger.log(`Sent notification for ${count} new transactions to chat ${this.chatId}`);
    } catch (error) {
      this.logger.error(`Failed to send transaction notification: ${error.message}`);
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
