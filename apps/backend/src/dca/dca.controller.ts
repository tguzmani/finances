import { Controller, Post } from '@nestjs/common';
import { DcaPricesService } from './dca-prices.service';

@Controller('dca')
export class DcaController {
  constructor(private readonly dcaPricesService: DcaPricesService) {}

  @Post('refresh-prices')
  async refreshPrices() {
    return this.dcaPricesService.refreshPrices();
  }
}
