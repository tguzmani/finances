import { Injectable, Logger } from '@nestjs/common';
import { Transaction, TransactionGroup } from '@prisma/client';
import { TransactionsService } from '../../transactions/transactions.service';
import { ExchangeRateService } from '../../exchanges/exchange-rate.service';
import { TransactionGroupsService } from '../../transaction-groups/transaction-groups.service';
import { TelegramTransactionsPresenter } from './telegram-transactions.presenter';
import { TransactionStatus, TransactionType } from '../../transactions/transaction.types';

@Injectable()
export class TelegramTransactionsService {
  private readonly logger = new Logger(TelegramTransactionsService.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly transactionGroupsService: TransactionGroupsService,
    private readonly presenter: TelegramTransactionsPresenter,
  ) {}

  async getNextForReview() {
    try {
      const transactions = await this.transactionsService.findAll({});
      return transactions.find(t => t.status === TransactionStatus.NEW);
    } catch (error) {
      this.logger.error(`Failed to get next review transaction: ${error.message}`);
      throw error;
    }
  }

  async getPendingReviewCount(): Promise<number> {
    try {
      const transactions = await this.transactionsService.findAll({});
      return transactions.filter(t => t.status === TransactionStatus.NEW).length;
    } catch (error) {
      this.logger.error(`Failed to count pending reviews: ${error.message}`);
      return 0;
    }
  }

  async getRecentTransactionsList(showAll = false): Promise<string> {
    try {
      const [allTransactions, latestRate] = await Promise.all([
        this.transactionsService.findAll({}),
        this.exchangeRateService.findLatest(),
      ]);

      let transactions = allTransactions;

      // Filter out rejected and registered by default
      if (!showAll) {
        transactions = transactions.filter(t =>
          t.status !== TransactionStatus.REJECTED &&
          t.status !== TransactionStatus.REGISTERED
        );
      }

      const exchangeRate = latestRate ? Number(latestRate.value) : undefined;

      return this.presenter.formatRecentList(transactions, exchangeRate);
    } catch (error) {
      this.logger.error(`Failed to get transactions list: ${error.message}`);
      throw new Error('Error getting transactions');
    }
  }

  async formatTransactionForReview(transaction: Transaction): Promise<string> {
    try {
      const latestRate = await this.exchangeRateService.findLatest();
      const exchangeRate = latestRate ? Number(latestRate.value) : undefined;
      return this.presenter.formatForReview(transaction, exchangeRate);
    } catch (error) {
      this.logger.error(`Failed to format transaction: ${error.message}`);
      return this.presenter.formatForReview(transaction);
    }
  }

  // Register flow methods
  async hasNewTransactions(): Promise<boolean> {
    try {
      const transactions = await this.transactionsService.findAll({});
      return transactions.some(t => t.status === TransactionStatus.NEW);
    } catch (error) {
      this.logger.error(`Failed to check new transactions: ${error.message}`);
      return false;
    }
  }

  async getReviewedTransactions(): Promise<Transaction[]> {
    try {
      const transactions = await this.transactionsService.findAll({});
      return transactions.filter(t => t.status === TransactionStatus.REVIEWED);
    } catch (error) {
      this.logger.error(`Failed to get reviewed transactions: ${error.message}`);
      throw error;
    }
  }

  async registerTransactions(transactionIds: number[]): Promise<void> {
    try {
      await Promise.all(
        transactionIds.map(id =>
          this.transactionsService.update(id, {
            status: TransactionStatus.REGISTERED,
          })
        )
      );

      this.logger.log(`Registered ${transactionIds.length} transactions`);
    } catch (error) {
      this.logger.error(`Failed to register transactions: ${error.message}`);
      throw error;
    }
  }

  async getRegistrationData() {
    try {
      const [transactions, latestRate] = await Promise.all([
        this.getReviewedTransactions(),
        this.exchangeRateService.findLatest(),
      ]);

      // Sort transactions in ascending order (oldest first) for registration
      const sortedTransactions = transactions.sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      return {
        transactions: sortedTransactions,
        exchangeRate: latestRate ? Number(latestRate.value) : null,
        hasTransactions: sortedTransactions.length > 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get registration data: ${error.message}`);
      throw error;
    }
  }

  async getReviewedTransactionsNotInGroup(): Promise<Transaction[]> {
    try {
      const allReviewed = await this.getReviewedTransactions();
      return allReviewed.filter(t => !t.groupId);
    } catch (error) {
      this.logger.error(`Failed to get reviewed transactions not in group: ${error.message}`);
      throw error;
    }
  }

  async getRegistrationDataWithGroups() {
    try {
      const [singleTransactions, groups, latestRate] = await Promise.all([
        this.getReviewedTransactionsNotInGroup(),
        this.transactionGroupsService.findGroupsForRegistration(),
        this.exchangeRateService.findLatest(),
      ]);

      // Sort singles by date (oldest first)
      const sortedSingles = singleTransactions.sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Sort groups by calculated date
      const sortedGroups = await Promise.all(
        groups.map(async (g) => ({
          group: g,
          date: await this.transactionGroupsService.calculateGroupDate(g.id),
        }))
      ).then(items => items.sort((a, b) => a.date.getTime() - b.date.getTime()));

      return {
        singleTransactions: sortedSingles,
        groups: sortedGroups.map(item => item.group),
        groupsWithDates: sortedGroups, // Include dates for chronological merging
        exchangeRate: latestRate ? Number(latestRate.value) : null,
        hasItems: sortedSingles.length > 0 || sortedGroups.length > 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get registration data with groups: ${error.message}`);
      throw error;
    }
  }

  formatTransactionForRegister(transaction: Transaction, exchangeRate: number): string {
    const transactionDate = new Date(transaction.date);

    const dateString = transactionDate.toLocaleDateString('es-VE', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });

    const date = dateString.charAt(0).toUpperCase() + dateString.slice(1);

    const time = transactionDate.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC'
    });

    const amount = Number(transaction.amount).toFixed(2);

    let amountText: string;
    if (transaction.currency === 'VES') {
      const usdAmount = (Number(transaction.amount) / exchangeRate).toFixed(2);
      amountText = `VES ${amount}\nUSD ${usdAmount}`;
    } else {
      // For non-VES currencies, just show USD amount
      amountText = `USD ${amount}`;
    }

    // Type icon and label
    const typeIcons: Record<string, string> = { 'EXPENSE': '💸', 'INCOME': '💰' };
    const typeLabels: Record<string, string> = { 'EXPENSE': 'Expense', 'INCOME': 'Income' };
    const typeIcon = typeIcons[transaction.type] || '💵';
    const typeLabel = typeLabels[transaction.type] || transaction.type;

    // Platform and method labels
    const platformLabels: Record<string, string> = {
      'BANESCO': 'Banesco',
      'BANK_OF_AMERICA': 'Bank of America',
      'BINANCE': 'Binance',
      'WALLET': 'Wallet',
      'CASH_BOX': 'Cash Box',
    };
    const methodLabels: Record<string, string> = {
      'DEBIT_CARD': 'Debit Card',
      'PAGO_MOVIL': 'Pago Móvil',
      'ZELLE': 'Zelle',
      'CREDIT_CARD': 'Credit Card',
      'BINANCE_PAY': 'Binance Pay',
      'DEPOSIT': 'Deposit',
      'WITHDRAWAL': 'Withdrawal',
    };
    const platformLabel = platformLabels[transaction.platform] || transaction.platform;
    const methodLabel = transaction.method ? methodLabels[transaction.method] || transaction.method : null;

    // Status icon and label
    const statusIcons: Record<string, string> = {
      'NEW': '🆕',
      'REJECTED': '❌',
      'REGISTERED': '✅',
      'REVIEWED': '✏️',
    };
    const statusLabels: Record<string, string> = {
      'NEW': 'New',
      'REVIEWED': 'Reviewed',
      'REJECTED': 'Rejected',
      'REGISTERED': 'Registered',
    };
    const statusIcon = statusIcons[transaction.status] || '';
    const statusLabel = statusLabels[transaction.status] || transaction.status;

    return (
      `ID: ${transaction.id}\n` +
      `<b>${typeIcon} ${transaction.description || 'Transaction'}</b>\n\n` +
      `${date}\n` +
      `Time: ${time}\n\n` +
      amountText + `\n\n` +
      `Type: ${typeIcon} ${typeLabel}\n` +
      `Platform: ${platformLabel}${methodLabel ? ` (${methodLabel})` : ''}\n` +
      `Status: ${statusIcon} ${statusLabel}`
    );
  }
}
