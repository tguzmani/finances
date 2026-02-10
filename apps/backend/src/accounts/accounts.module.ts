import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { BinanceAccountService } from './binance-account.service';

@Module({
  imports: [CommonModule],
  providers: [BinanceAccountService],
  exports: [BinanceAccountService],
})
export class AccountsModule {}
