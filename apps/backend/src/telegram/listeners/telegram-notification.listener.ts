import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { NewTransactionsEvent } from '../../transactions/events/new-transactions.event';
import { ExchangesCompletedEvent } from '../../exchanges/events/exchanges-completed.event';
import { ExchangeRateService } from '../../exchanges/exchange-rate.service';
import { ExchangesService } from '../../exchanges/exchanges.service';
import { JournalEntryService } from '../../journal-entry/journal-entry.service';
import { TelegramTransactionsPresenter } from '../transactions/telegram-transactions.presenter';

@Injectable()
export class TelegramNotificationListener {
  private readonly logger = new Logger(TelegramNotificationListener.name);
  private readonly chatId: string;

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly transactionsPresenter: TelegramTransactionsPresenter,
    private readonly exchangesService: ExchangesService,
    private readonly journalEntryService: JournalEntryService,
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

  @OnEvent('exchanges.completed')
  async handleCompletedExchanges(event: ExchangesCompletedEvent) {
    if (!this.chatId) return;

    try {
      const { exchanges } = event;

      // 1. Calculate WAVG and metrics
      const metrics = this.exchangesService.calculateRegisterMetrics(exchanges);
      const { wavg, sumFormula, totalAmount, terminalList } = metrics;
      const exchangeIds = exchanges.map(e => e.id);

      // 2. Create journal entry in Google Sheets
      await this.journalEntryService.createExchangeJournalEntry(sumFormula, wavg);

      // 3. Register exchanges (mark as REGISTERED + save rate in DB + update Sheets)
      await this.exchangesService.registerExchanges(exchangeIds, wavg);

      // 4. Build notification message
      const exchangeLines = exchanges.map(e => {
        const amountGross = Number(e.amountGross).toFixed(2);
        const unitPrice = Number(e.exchangeRate).toFixed(2);
        const fiatAmount = Number(e.fiatAmount).toFixed(2);
        return `  ${amountGross} USDT @ ${unitPrice} = ${fiatAmount} VES`;
      }).join('\n');

      const message =
        `<b>Exchanges Auto-Registered</b>\n\n` +
        `${exchanges.length} exchange(s) registered:\n` +
        `${exchangeLines}\n\n` +
        `<b>WAVG Rate:</b> ${wavg} VES/USD\n` +
        `<b>Total:</b> ${totalAmount.toFixed(2)} USD\n` +
        `<b>Terminal:</b> ${terminalList}\n\n` +
        `Journal entry created.\n` +
        `Exchange rate saved: ${wavg} VES/USD`;

      // 5. Send notification with "Update Banesco Balance" inline button
      const keyboard = {
        inline_keyboard: [
          [
            {
              text: 'Update Banesco Balance',
              callback_data: 'accounts_update_banesco',
            },
          ],
        ],
      };

      await this.bot.telegram.sendMessage(this.chatId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });

      this.logger.log(
        `Auto-registered ${exchangeIds.length} exchanges with WAVG ${wavg}`,
      );
    } catch (error) {
      this.logger.error(`Failed to auto-register exchanges: ${error.message}`);

      try {
        await this.bot.telegram.sendMessage(
          this.chatId,
          `Failed to auto-register exchanges: ${error.message}`,
        );
      } catch {
        // Ignore notification failure
      }
    }
  }
}
