import { Injectable, Logger } from '@nestjs/common';
import { Transaction } from '@prisma/client';
import { SubscriptionsSheetsService } from './subscriptions-sheets.service';
import { SubscriptionMatchService } from './subscription-match.service';

export interface SubscriptionRecord {
  name: string;
  amount: number;
  /** True when the service was not in the catalog and a row was added for it. */
  added: boolean;
}

/** Subscriptions bill against the card, so nothing else can be one. */
const SUBSCRIPTION_PLATFORM = 'BANK_OF_AMERICA';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly sheets: SubscriptionsSheetsService,
    private readonly matcher: SubscriptionMatchService,
  ) {}

  /**
   * Records a charge against the subscription it pays for.
   *
   * The catalog is the detail the Libro used to hide: a single accumulated
   * figure on one line, with no way to tell which services it was made of or
   * which ones had not charged yet. Writing the amount onto its own row keeps
   * the Libro total exact and says where every dollar came from.
   *
   * Returns null when the charge is not a subscription, leaving it to the
   * ordinary expense flow.
   */
  async tryRecordCharge(transaction: Transaction): Promise<SubscriptionRecord | null> {
    if (transaction.platform !== SUBSCRIPTION_PLATFORM) return null;
    if (transaction.type !== 'EXPENSE') return null;
    if (!transaction.description) return null;
    if (transaction.currency !== 'USD') return null;

    const amount = Number(transaction.amount);
    const catalog = await this.sheets.getCatalog();

    const { row, newName } = await this.matcher.match(
      transaction.description,
      amount,
      transaction.date,
      catalog,
    );

    if (row) {
      if (row.charged !== null) {
        this.logger.warn(
          `"${row.name}" already shows ${row.charged} charged this month, skipping ${amount}`,
        );
        return null;
      }

      await this.sheets.recordCharge(row.row, amount, transaction.date);
      return { name: row.name, amount, added: false };
    }

    if (!newName) return null;

    const added = await this.sheets.addSubscription({
      name: newName,
      amount,
      date: transaction.date,
      method: 'TDC',
    });

    return added ? { name: newName, amount, added: true } : null;
  }

  /** Clears last month's charges when a new month's sheet is registered. */
  async startNewMonth(): Promise<void> {
    await this.sheets.clearMonthlyCharges();
  }
}
