import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DcaPricesService } from './dca-prices.service';

@Injectable()
export class DcaPricesScheduler {
  private readonly logger = new Logger(DcaPricesScheduler.name);

  constructor(private readonly dcaPricesService: DcaPricesService) {}

  @Cron('*/30 * * * *', {
    name: 'dca-prices-refresh',
    disabled: process.env.SCHEDULERS_ENABLED === 'false',
  })
  async refreshPrices() {
    try {
      const result = await this.dcaPricesService.refreshPrices();
      this.logger.log(
        `[CRON] DCA prices refreshed: ${result.written}/${result.assets} assets`,
      );
    } catch (error) {
      this.logger.error(`[CRON] DCA price refresh failed: ${error.message}`);
    }
  }
}
