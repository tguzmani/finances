import { Injectable, Logger } from '@nestjs/common';
import { GoogleSheetConfigService } from '../../google-sheet-config/google-sheet-config.service';
import { TransactionsService } from '../../transactions/transactions.service';

@Injectable()
export class TelegramSettingsService {
  private readonly logger = new Logger(TelegramSettingsService.name);

  constructor(
    private readonly googleSheetConfigService: GoogleSheetConfigService,
    private readonly transactionsService: TransactionsService,
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

    return `Sheet ID saved for <b>${name}</b>`;
  }
}
