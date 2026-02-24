import { Injectable, Logger } from '@nestjs/common';
import { EquityName } from '@prisma/client';
import { EquityService } from '../../equity/equity.service';
import { TelegramEquityPresenter } from './telegram-equity.presenter';

@Injectable()
export class TelegramEquityService {
  private readonly logger = new Logger(TelegramEquityService.name);

  constructor(
    private readonly equityService: EquityService,
    private readonly presenter: TelegramEquityPresenter,
  ) {}

  async getEquityMessage(): Promise<string> {
    try {
      const names = [
        EquityName.EQUITY_SIMPLE,
        EquityName.EQUITY_CRYPTO_INVESTMENT,
        EquityName.EQUITY_FIAT_INVESTMENT,
        EquityName.EQUITY_FULL_INVESTMENT,
      ];

      const snapshots = await Promise.all(
        names.map((name) => this.equityService.findLatestByName(name)),
      );

      const validSnapshots = snapshots.filter((s) => s !== null);
      return this.presenter.formatEquityMessage(validSnapshots);
    } catch (error) {
      this.logger.error(`Error getting equity message: ${error.message}`);
      throw error;
    }
  }
}
