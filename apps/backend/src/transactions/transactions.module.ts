import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TransactionsEmailService } from './transactions-email.service';
import { BanescoParser } from './banesco.parser';

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionsEmailService, BanescoParser],
  exports: [TransactionsService],
})
export class TransactionsModule {}
