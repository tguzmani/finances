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
import { GooglePlayEmailService } from './email/subscriptions/google-play/google-play-email.service';
import { GooglePlayParser } from './email/subscriptions/google-play/google-play.parser';
import { AnthropicEmailService } from './email/subscriptions/anthropic/anthropic-email.service';
import { AnthropicParser } from './email/subscriptions/anthropic/anthropic.parser';
import { CursorScheduler } from './email/subscriptions/cursor/cursor.scheduler';
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

    GooglePlayEmailService,
    GooglePlayParser,

    AnthropicEmailService,
    AnthropicParser,

    CursorScheduler,

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
    private readonly googlePlayService: GooglePlayEmailService,
    private readonly anthropicService: AnthropicEmailService,
  ) {
    this.registry.register(this.banescoService);
    this.registry.register(this.bofaService);
    this.registry.register(this.googlePlayService);
    this.registry.register(this.anthropicService);
  }
}
