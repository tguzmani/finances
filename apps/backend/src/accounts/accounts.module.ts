import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { ExchangesModule } from '../exchanges/exchanges.module';
import { BinanceAccountService } from './accounts-binance.service';
import { AccountsSheetsService } from './accounts-sheets.service';
import { BanescoAccountService } from './accounts-banesco.service';
import { CashAccountService } from './accounts-cash.service';

@Module({
  imports: [CommonModule, TransactionsModule, ExchangesModule],
  providers: [BinanceAccountService, AccountsSheetsService, BanescoAccountService, CashAccountService],
  exports: [BinanceAccountService, AccountsSheetsService, BanescoAccountService, CashAccountService],
})
export class AccountsModule {}
