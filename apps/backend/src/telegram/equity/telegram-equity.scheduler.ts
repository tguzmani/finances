import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EquityService } from '../../equity/equity.service';

@Injectable()
export class TelegramEquityScheduler {
  private readonly logger = new Logger(TelegramEquityScheduler.name);

  constructor(private readonly equityService: EquityService) {}

  /**
   * Capture equity snapshots at 4 AM UTC (12 AM Venezuela time)
   * Venezuela is UTC-4, so 12 AM VET = 4 AM UTC
   */
  @Cron('0 4 * * *', { timeZone: 'UTC' })
  async captureEquity() {
    if (process.env.ENABLE_EQUITY_CAPTURE !== 'true') {
      this.logger.debug('Equity capture is disabled (ENABLE_EQUITY_CAPTURE != true), skipping');
      return;
    }

    try {
      this.logger.log('Capturing daily equity snapshots...');
      await this.equityService.captureAllSnapshots();
      this.logger.log('Daily equity snapshots captured successfully');
    } catch (error) {
      this.logger.error(
        `Failed to capture equity snapshots: ${error.message}`,
      );
    }
  }
}
