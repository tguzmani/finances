import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TransactionsScheduler } from './transactions.scheduler';
import { TransactionsBinanceService } from './transactions-binance.service';
import { TransactionsBinanceScheduler } from './transactions-binance.scheduler';
import { PagoMovilOcrService } from './pago-movil-ocr.service';
import { PagoMovilParser } from './pago-movil.parser';
import { EmailServiceRegistry } from './email/email-service.registry';
import { BanescoEmailService } from './email/banks/banesco/banesco-email.service';
import { BanescoParser } from './email/banks/banesco/banesco.parser';
import { BofaEmailService } from './email/banks/bofa/bofa-email.service';
import { BofaParser } from './email/banks/bofa/bofa.parser';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    TransactionsScheduler,
    TransactionsBinanceService,
    TransactionsBinanceScheduler,

    EmailServiceRegistry,

    BanescoEmailService,
    BanescoParser,

    BofaEmailService,
    BofaParser,

    PagoMovilOcrService,
    PagoMovilParser,
  ],
  exports: [
    TransactionsService,
    PagoMovilOcrService,
    PagoMovilParser,
  ],
})
export class TransactionsModule {
  constructor(
    private readonly registry: EmailServiceRegistry,
    private readonly banescoService: BanescoEmailService,
    private readonly bofaService: BofaEmailService,
  ) {
    this.registry.register(this.banescoService);
    this.registry.register(this.bofaService);
  }
}
