import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TransactionPlatform, PaymentMethod, TransactionStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class CursorScheduler {
  private readonly logger = new Logger(CursorScheduler.name);
  private isRunning = false;

  constructor(private readonly prisma: PrismaService) {}

  // Run daily at 12:00 PM (noon) to check if we need to create transaction
  @Cron('0 12 * * *', {
    name: 'cursor-subscription',
    disabled: process.env.SCHEDULERS_ENABLED === 'false',
  })
  async handleCursorSubscription() {
    if (this.isRunning) {
      this.logger.warn('Previous cursor subscription check still running, skipping...');
      return;
    }

    try {
      this.isRunning = true;

      const today = new Date();
      const dayOfMonth = today.getUTCDate();

      // Only create transaction on the 9th of each month
      if (dayOfMonth !== 9) {
        this.logger.debug(`Today is not the 9th (it's ${dayOfMonth}), skipping...`);
        return;
      }

      // Check if we already created this month's transaction
      const year = today.getUTCFullYear();
      const month = today.getUTCMonth() + 1; // 0-indexed
      const transactionId = `CURSOR_${year}${month.toString().padStart(2, '0')}`;

      // Check for duplicates
      const existing = await this.prisma.transaction.findUnique({
        where: { transactionId },
      });
      if (existing) {
        this.logger.log(`Cursor subscription for ${year}-${month} already exists, skipping...`);
        return;
      }

      // Create the transaction
      await this.prisma.transaction.create({
        data: {
          date: today,
          amount: 20.00,
          currency: 'USD',
          status: TransactionStatus.NEW,
          type: TransactionType.EXPENSE,
          platform: TransactionPlatform.BANK_OF_AMERICA,
          method: PaymentMethod.CREDIT_CARD,
          transactionId,
          description: 'Cursor Subscription',
        },
      });

      this.logger.log(`✅ Created Cursor subscription transaction for ${year}-${month}`);
    } catch (error) {
      this.logger.error(`Error creating Cursor subscription: ${error.message}`, error.stack);
    } finally {
      this.isRunning = false;
    }
  }
}
