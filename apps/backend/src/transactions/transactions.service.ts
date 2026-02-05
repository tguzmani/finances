import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailServiceRegistry } from './email/email-service.registry';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { UpdateTransactionDto } from './dto/update-status.dto';
import { TransactionStatus, TransactionType } from './transaction.types';
import { Prisma } from '@prisma/client';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailRegistry: EmailServiceRegistry
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
    });
  }

  async findOne(id: number) {
    return this.prisma.transaction.findUnique({
      where: { id },
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
            await this.prisma.transaction.create({
              data: {
                date: tx.date,
                amount: tx.amount,
                currency: tx.currency,
                transactionId: tx.transactionId,
                platform: tx.platform,
                method: tx.method,
                type: TransactionType.EXPENSE,
                status: TransactionStatus.NEW,
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
  }): Promise<void> {
    try {
      await this.prisma.transaction.create({
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
    } catch (error) {
      if (error.code === 'P2002') {
        this.logger.warn(`Duplicate transaction: ${parsed.transactionId}`);
        throw new Error('Transaction already exists');
      }
      throw error;
    }
  }
}
