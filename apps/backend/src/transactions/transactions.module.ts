import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TransactionsEmailService } from './transactions-email.service';
import { BanescoParser } from './banesco.parser';
import { TransactionsScheduler } from './transactions.scheduler';

@Module({
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    TransactionsEmailService,
    BanescoParser,
    TransactionsScheduler,
  ],
  exports: [TransactionsService],
})
export class TransactionsModule {}
