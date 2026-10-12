import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { ExchangesModule } from '../exchanges/exchanges.module';
import { BookkeepingService } from './bookkeeping.service';

@Module({
  imports: [AccountsModule, ExchangesModule],
  providers: [BookkeepingService],
  exports: [BookkeepingService],
})
export class BookkeepingModule {}
