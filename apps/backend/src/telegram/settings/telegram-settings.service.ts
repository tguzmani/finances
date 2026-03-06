import { Injectable, Logger } from '@nestjs/common';
import { GoogleSheetConfigService } from '../../google-sheet-config/google-sheet-config.service';

@Injectable()
export class TelegramSettingsService {
  private readonly logger = new Logger(TelegramSettingsService.name);

  constructor(
    private readonly googleSheetConfigService: GoogleSheetConfigService,
  ) {}

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
