import { Injectable, Logger } from '@nestjs/common';
import { GoogleSheetConfigService } from '../../google-sheet-config/google-sheet-config.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';

@Injectable()
export class TelegramSettingsService {
  private readonly logger = new Logger(TelegramSettingsService.name);

  constructor(
    private readonly googleSheetConfigService: GoogleSheetConfigService,
    private readonly transactionsService: TransactionsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async countTestTransactions(): Promise<number> {
    return this.transactionsService.countTestTransactions();
  }

  async deleteTestTransactions(): Promise<string> {
    const result = await this.transactionsService.deleteTestTransactions();

    if (result.deleted === 0) {
      return 'No test transactions found.';
    }

    return (
      `Deleted <b>${result.deleted}</b> test transaction(s):\n` +
      result.descriptions.map((d) => `• ${d}`).join('\n')
    );
  }

  async saveSheetId(googleSheetId: string): Promise<string> {
    const { startDate, endDate, name } =
      await this.googleSheetConfigService.getOrDetermineNextConfig();

    await this.googleSheetConfigService.createConfig(
      googleSheetId,
      startDate,
      endDate,
      name,
    );

    // The new sheet is a copy of last month's, so it arrives with last month's
    // charges already filled in. Left there, the Libro's subscription line would
    // start the month full.
    let clearedNote = '';
    try {
      await this.subscriptionsService.startNewMonth();
      clearedNote = '\nSubscription charges cleared.';
    } catch (error) {
      this.logger.error(`Could not clear subscription charges: ${error.message}`);
      clearedNote = '\n⚠️ Could not clear subscription charges — do it by hand.';
    }

    return `Sheet ID saved for <b>${name}</b>${clearedNote}`;
  }
}
