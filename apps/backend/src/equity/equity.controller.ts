import { Controller, Get, Post, Query } from '@nestjs/common';
import { EquityService } from './equity.service';
import { EquitySheetsService } from './equity-sheets.service';
import { EquityItaFetchService } from './equity-ita-fetch.service';
import { EquityChartService } from './equity-chart.service';
import { EquityRepairService } from './equity-repair.service';
import { EquityName } from '@prisma/client';

@Controller('equity')
export class EquityController {
  constructor(
    private readonly equityService: EquityService,
    private readonly sheetsService: EquitySheetsService,
    private readonly itaFetchService: EquityItaFetchService,
    private readonly chartService: EquityChartService,
    private readonly repairService: EquityRepairService,
  ) {}

  @Get('sheets')
  async testSheets() {
    const [equityValue, binancePnl, sheetsEvo25] = await Promise.all([
      this.sheetsService.getEquityValue(),
      this.sheetsService.getBinancePnl(),
      this.sheetsService.getSheetsEvo25Value(),
    ]);
    return { equityValue, binancePnl, sheetsEvo25 };
  }

  @Get('ita')
  async testIta() {
    const accountValue = await this.itaFetchService.getItaAccountValue();
    return { accountValue };
  }

  /** Rebuilds snapshots captured while the DCA sheet reported #VALUE!. */
  @Post('repair-crypto-snapshots')
  async repairCryptoSnapshots(@Query('apply') apply?: string) {
    return this.repairService.repairCryptoSnapshots(apply !== 'true');
  }

  @Post('capture')
  async testCapture() {
    await this.equityService.captureAllSnapshots();
    return { status: 'ok' };
  }

  @Get('latest')
  async testLatest() {
    const names = [
      EquityName.EQUITY_SIMPLE,
      EquityName.EQUITY_CRYPTO_INVESTMENT,
      EquityName.EQUITY_FIAT_INVESTMENT,
      EquityName.EQUITY_FULL_INVESTMENT,
    ];
    const snapshots = await Promise.all(
      names.map((name) => this.equityService.findLatestByName(name)),
    );
    return snapshots.filter((s) => s !== null);
  }

  @Get('chart')
  async testChart() {
    const buffer = await this.chartService.generateEquityChart(30);
    return { size: buffer.length, preview: `data:image/png;base64,${buffer.toString('base64').substring(0, 100)}...` };
  }
}
