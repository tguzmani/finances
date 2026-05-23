import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { TransactionManualCreatedEvent } from '../../transactions/events/transaction-manual-created.event';
import { SheetUpdateService } from '../../journal-entry/sheet-update.service';
import { AutoRegistrationService } from '../../journal-entry/auto-registration.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { ExchangeRateService } from '../../exchanges/exchange-rate.service';
import { TransactionGroupsService } from '../../transaction-groups/transaction-groups.service';
import { TransactionStatus } from '../../transactions/transaction.types';

@Injectable()
export class ManualTransactionPostListener {
  private readonly logger = new Logger(ManualTransactionPostListener.name);
  private readonly chatId: string;

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly sheetUpdateService: SheetUpdateService,
    private readonly autoRegistrationService: AutoRegistrationService,
    private readonly transactionsService: TransactionsService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly transactionGroupsService: TransactionGroupsService,
  ) {
    this.chatId = process.env.TELEGRAM_ALLOWED_USERS?.split(',')[0] || '';
  }

  @OnEvent('transaction.manual.created')
  async handle(event: TransactionManualCreatedEvent) {
    if (!this.chatId) return;

    const transaction = event.transaction;
    const description = transaction.description || '(no description)';

    try {
      const sheetResult = await this.sheetUpdateService.trySheetUpdate(transaction);
      if (sheetResult) {
        await this.transactionsService.update(transaction.id, {
          status: TransactionStatus.REGISTERED,
        });
        await this.sendRegisteredMessage(transaction, description);
        return;
      }
    } catch (error) {
      this.logger.error(`Sheet update error for tx ${transaction.id}: ${error.message}`);
      await this.bot.telegram.sendMessage(
        this.chatId,
        `⚠️ <b>${description}</b>\n\nSheet update failed: ${error.message}`,
        { parse_mode: 'HTML' },
      );
    }

    try {
      const autoResult = await this.autoRegistrationService.tryAutoRegister(transaction);
      if (autoResult) {
        await this.transactionsService.update(transaction.id, {
          status: TransactionStatus.REGISTERED,
        });
        await this.sendRegisteredMessage(transaction, description, autoResult);
        return;
      }
    } catch (error) {
      this.logger.error(`Auto-registration error for tx ${transaction.id}: ${error.message}`);
    }

    // Not auto-registered — offer to connect to an existing group if any candidates exist.
    await this.maybeOfferGrouping(transaction);
  }

  private async maybeOfferGrouping(transaction: any) {
    try {
      const allTransactions = await this.transactionsService.findAll({});
      const otherReviewed = allTransactions.filter(t =>
        t.status === 'REVIEWED' && t.id !== transaction.id && t.groupId === null,
      );
      const existingGroups = await this.transactionGroupsService.findGroupsForRegistration();

      if (otherReviewed.length === 0 && existingGroups.length === 0) return;

      await this.bot.telegram.sendMessage(
        this.chatId,
        `📎 Want to connect this transaction to a group?`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📎 Connect to Group', callback_data: `manual_connect_group_${transaction.id}` }],
            ],
          },
        },
      );
    } catch (error) {
      this.logger.error(`Group-offer error for tx ${transaction.id}: ${error.message}`);
    }
  }

  private async sendRegisteredMessage(
    transaction: any,
    description: string,
    autoResult?: { debitAccount: string; creditAccount: string; rule: { category: string; subcategory: string } },
  ) {
    let amountLine = `Amount: ${transaction.currency} ${Number(transaction.amount).toFixed(2)}`;
    if (transaction.currency === 'VES') {
      try {
        const latestRate = await this.exchangeRateService.findLatest();
        if (latestRate) {
          const usd = Number(transaction.amount) / Number(latestRate.value);
          amountLine += ` (${usd.toFixed(2)} USD)`;
        }
      } catch (e) { /* rate unavailable */ }
    }

    let message =
      `✅ <b>Transaction Auto-Registered!</b>\n\n` +
      `<b>${description}</b>\n\n` +
      `${amountLine}\n`;

    if (autoResult) {
      message +=
        `Journal: ${autoResult.debitAccount} / ${autoResult.creditAccount}\n` +
        `Category: ${autoResult.rule.category} / ${autoResult.rule.subcategory}\n`;
    }

    message += `Status: Registered`;

    await this.bot.telegram.sendMessage(this.chatId, message, { parse_mode: 'HTML' });
  }
}
