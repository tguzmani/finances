import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { DcaPricesService } from './dca-prices.service';
import { DcaPricesScheduler } from './dca-prices.scheduler';
import { DcaSheetsService } from './dca-sheets.service';
import { DcaController } from './dca.controller';

@Module({
  imports: [CommonModule],
  controllers: [DcaController],
  providers: [DcaPricesService, DcaSheetsService, DcaPricesScheduler],
  exports: [DcaPricesService, DcaSheetsService],
})
export class DcaModule {}
