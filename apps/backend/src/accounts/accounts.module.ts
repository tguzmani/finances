import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { BinanceAccountService } from './accounts-binance.service';
import { AccountsSheetsService } from './accounts-sheets.service';

@Module({
  imports: [CommonModule],
  providers: [BinanceAccountService, AccountsSheetsService],
  exports: [BinanceAccountService, AccountsSheetsService],
})
export class AccountsModule {}
