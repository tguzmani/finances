import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { DcaModule } from '../dca/dca.module';
import { EquityService } from './equity.service';
import { EquitySheetsService } from './equity-sheets.service';
import { EquityItaFetchService } from './equity-ita-fetch.service';
import { EquityChartService } from './equity-chart.service';
import { EquityRepairService } from './equity-repair.service';
import { EquityController } from './equity.controller';

@Module({
  imports: [CommonModule, DcaModule],
  controllers: [EquityController],
  providers: [
    EquityService,
    EquitySheetsService,
    EquityItaFetchService,
    EquityChartService,
    EquityRepairService,
  ],
  exports: [
    EquityService,
    EquitySheetsService,
    EquityItaFetchService,
    EquityChartService,
  ],
})
export class EquityModule {}
