import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailServiceRegistry } from './email/email-service.registry';
import { TransactionsBinanceService } from './transactions-binance.service';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { UpdateTransactionDto } from './dto/update-status.dto';
import { TransactionStatus, TransactionType } from './transaction.types';
import { TransactionSearchCriteria } from './transaction-search.service';
import { Prisma, TransactionPlatform, PaymentMethod, Transaction } from '@prisma/client';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailRegistry: EmailServiceRegistry,
    private readonly binanceTransactions: TransactionsBinanceService
  ) { }

  async findAll(query: QueryTransactionsDto) {
    const { fromDate, toDate, limit, minAmount, maxAmount } = query;

    const where: Prisma.TransactionWhereInput = {};

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(fromDate);
      if (toDate) where.date.lte = new Date(toDate);
    }

    if (minAmount !== undefined || maxAmount !== undefined) {
      where.amount = {};
      if (minAmount !== undefined) where.amount.gte = minAmount;
      if (maxAmount !== undefined) where.amount.lte = maxAmount;
    }

    return this.prisma.transaction.findMany({
      where,
      take: limit,
      orderBy: { date: 'desc' },
      include: {
        group: true,
      },
    });
  }

  async findOne(id: number) {
    return this.prisma.transaction.findUnique({
      where: { id },
    });
  }

  async findByTransactionId(transactionId: string) {
    return this.prisma.transaction.findUnique({
      where: { transactionId },
    });
  }

  async searchTransactions(criteria: TransactionSearchCriteria): Promise<Transaction[]> {
    const where: Prisma.TransactionWhereInput = {};

    if (criteria.description) {
      where.description = { contains: criteria.description, mode: 'insensitive' };
    }

    if (criteria.dateFrom || criteria.dateTo) {
      where.date = {};
      if (criteria.dateFrom) where.date.gte = new Date(criteria.dateFrom + 'T00:00:00Z');
      if (criteria.dateTo) where.date.lte = new Date(criteria.dateTo + 'T23:59:59Z');
    }

    if (criteria.amountMin != null || criteria.amountMax != null) {
      where.amount = {};
      if (criteria.amountMin != null) where.amount.gte = criteria.amountMin;
      if (criteria.amountMax != null) where.amount.lte = criteria.amountMax;
    }

    if (criteria.platform) {
      where.platform = criteria.platform as TransactionPlatform;
    }

    if (criteria.statusIn) {
      where.status = { in: criteria.statusIn as TransactionStatus[] };
    } else if (criteria.status) {
      where.status = criteria.status as TransactionStatus;
    }

    if (criteria.method) {
      where.method = criteria.method as PaymentMethod;
    }

    return this.prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 10,
      include: { group: true },
    });
  }

  async update(id: number, dto: UpdateTransactionDto) {
    const data: Prisma.TransactionUpdateInput = {};

    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    if (dto.description !== undefined) {
      data.description = dto.description;
    }

    if (dto.date !== undefined) {
      data.date = dto.date;
    }

    return this.prisma.transaction.update({
      where: { id },
      data,
    });
  }

  async syncFromEmail(limitPerBank = 30) {
    this.logger.log(`Starting email sync with limit ${limitPerBank} per bank`);

    const services = this.emailRegistry.getAllServices();
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalEmails = 0;

    for (const service of services) {
      const platform = service.getBankPlatform();
      this.logger.log(`Syncing ${platform}...`);

      try {
        const emails = await service.fetchEmails(limitPerBank);
        const transactions = service.parseEmails(emails);

        totalEmails += emails.length;

        for (const tx of transactions) {
          try {
            // Check for amount-based duplicates (BANESCO only)
            if (tx.platform === TransactionPlatform.BANESCO) {
              const existingByAmount = await this.prisma.transaction.findFirst({
                where: {
                  platform: TransactionPlatform.BANESCO,
                  amount: tx.amount,
                },
              });

              if (existingByAmount) {
                this.logger.warn(
                  `Duplicate BANESCO transaction detected by amount: ${tx.amount} ${tx.currency}. ` +
                  `Existing transaction ID: ${existingByAmount.id} (${existingByAmount.transactionId}), ` +
                  `New email transaction ID: ${tx.transactionId}. Skipping.`
                );
                totalSkipped++;
                continue;
              }
            }

            await this.prisma.transaction.create({
              data: {
                date: tx.date,
                amount: tx.amount,
                currency: tx.currency,
                transactionId: tx.transactionId,
                platform: tx.platform,
                method: tx.method,
                type: tx.type,
                status: TransactionStatus.NEW,
                description: tx.description,
              },
            });
            totalCreated++;
          } catch (err) {
            if (err.code === 'P2002') {
              totalSkipped++;
            } else {
              this.logger.error(`Failed to create transaction: ${err.message}`);
            }
          }
        }
      } catch (err) {
        this.logger.error(`Failed to sync ${platform}: ${err.message}`);
      }
    }

    this.logger.log(
      `Sync complete: ${totalCreated} created, ${totalSkipped} skipped from ${totalEmails} emails`
    );

    return {
      emailsProcessed: totalEmails,
      transactionsCreated: totalCreated,
      transactionsSkipped: totalSkipped,
    };
  }

  async createFromPagoMovil(parsed: {
    date: Date;
    amount: number;
    currency: string;
    transactionId: string;
  }) {
    try {
      const transaction = await this.prisma.transaction.create({
        data: {
          date: parsed.date,
          amount: parsed.amount,
          currency: parsed.currency,
          transactionId: parsed.transactionId,
          platform: 'BANESCO',
          method: 'PAGO_MOVIL',
          type: TransactionType.EXPENSE,
          status: TransactionStatus.NEW,
        },
      });

      this.logger.log(`Created Pago Móvil transaction: ${parsed.transactionId}`);
      return transaction;
    } catch (error) {
      if (error.code === 'P2002') {
        this.logger.warn(`Duplicate transaction: ${parsed.transactionId}`);
        throw new Error('Transaction already exists');
      }
      throw error;
    }
  }

  async syncFromBinance(limitPerType = 30): Promise<{
    transactionsCreated: number;
    transactionsSkipped: number;
    totalFetched: number;
  }> {
    this.logger.log(`Starting Binance sync with limit ${limitPerType} per type`);

    let totalCreated = 0;
    let totalSkipped = 0;

    // Fetch all types in parallel
    const [deposits, withdrawals, pays] = await Promise.all([
      this.binanceTransactions.getDeposits(limitPerType),
      this.binanceTransactions.getWithdrawals(limitPerType),
      this.binanceTransactions.getBinancePay(limitPerType),
    ]);

    const allTransactions = [...deposits, ...withdrawals, ...pays];

    for (const tx of allTransactions) {
      try {
        await this.prisma.transaction.create({
          data: {
            date: tx.date,
            amount: tx.amount,
            currency: tx.currency,
            transactionId: tx.transactionId,
            platform: tx.platform,
            method: tx.method,
            type: tx.type,
            status: TransactionStatus.NEW,
          },
        });
        totalCreated++;
      } catch (err) {
        if (err.code === 'P2002') {
          totalSkipped++; // Duplicate transactionId
        } else {
          this.logger.error(`Failed to create transaction: ${err.message}`);
        }
      }
    }

    this.logger.log(
      `Binance sync complete: ${totalCreated} created, ${totalSkipped} skipped from ${allTransactions.length} transactions`
    );

    return {
      transactionsCreated: totalCreated,
      transactionsSkipped: totalSkipped,
      totalFetched: allTransactions.length,
    };
  }

  /**
   * Get currency for a given platform
   * Banesco = VES, Binance = USDT, Others = USD
   */
  getCurrencyForPlatform(platform: TransactionPlatform): string {
    switch (platform) {
      case TransactionPlatform.BANESCO:
        return 'VES';
      case TransactionPlatform.BINANCE:
        return 'USDT';
      case TransactionPlatform.BANK_OF_AMERICA:
      case TransactionPlatform.WALLET:
      case TransactionPlatform.CASH_BOX:
        return 'USD';
      default:
        return 'USD';
    }
  }

  /**
   * Get available payment methods for a platform
   */
  getAvailablePaymentMethods(platform: TransactionPlatform): PaymentMethod[] {
    switch (platform) {
      case TransactionPlatform.BANESCO:
        return [PaymentMethod.DEBIT_CARD, PaymentMethod.PAGO_MOVIL];
      case TransactionPlatform.BANK_OF_AMERICA:
        return [PaymentMethod.DEBIT_CARD, PaymentMethod.CREDIT_CARD, PaymentMethod.ZELLE];
      case TransactionPlatform.BINANCE:
        return [PaymentMethod.BINANCE_PAY, PaymentMethod.DEPOSIT, PaymentMethod.WITHDRAWAL];
      case TransactionPlatform.WALLET:
      case TransactionPlatform.CASH_BOX:
        return []; // No specific methods, can be left null
      default:
        return [];
    }
  }

  /**
   * Create manual transaction
   */
  async createManualTransaction(data: {
    type: TransactionType;
    platform: TransactionPlatform;
    currency: string;
    amount: number;
    description: string;
    method?: PaymentMethod;
    date?: Date;
  }): Promise<Transaction> {
    // Generate unique transaction ID for manual entries
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const transactionId = `MANUAL_${data.platform}_${timestamp}_${random}`;

    // Use provided date or current UTC time
    // Dates are always stored in UTC; display conversion to America/Caracas happens at presentation layer
    const transactionDate = data.date ?? new Date();

    // Determine payment method: CASH for CASH_BOX and WALLET platforms
    let paymentMethod = data.method;
    if (!paymentMethod && (data.platform === TransactionPlatform.CASH_BOX || data.platform === TransactionPlatform.WALLET)) {
      paymentMethod = PaymentMethod.CASH;
    }

    return await this.prisma.transaction.create({
      data: {
        date: transactionDate,
        amount: data.amount,
        currency: data.currency,
        transactionId,
        platform: data.platform,
        method: paymentMethod || null,
        type: data.type,
        description: data.description,
        status: TransactionStatus.REVIEWED, // Manual entries go to REVIEWED status
      },
    });
  }
}
