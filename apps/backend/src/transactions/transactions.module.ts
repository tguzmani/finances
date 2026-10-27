import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TransactionsScheduler } from './transactions.scheduler';
import { TransactionsImageCleanupService } from './transactions-image-cleanup.service';
import { TransactionsImageCleanupScheduler } from './transactions-image-cleanup.scheduler';
import { TransactionsBinanceService } from './transactions-binance.service';
import { TransactionsBinanceConvertService } from './transactions-binance-convert.service';
import { TransactionsBinanceScheduler } from './transactions-binance.scheduler';
import { TransactionOcrParser } from './ocr/parsers/transaction-ocr-parser';
import { TransactionLlmParserService } from './ocr/parsers/transaction-llm-parser.service';
import { PagoMovilLlmParserService } from './ocr/parsers/pago-movil-llm-parser.service';
import { EmailServiceRegistry } from './email/email-service.registry';
import { BanescoEmailService } from './email/banks/banesco/banesco-email.service';
import { BanescoParser } from './email/banks/banesco/banesco.parser';
import { BofaEmailService } from './email/banks/bofa/bofa-email.service';
import { BofaParser } from './email/banks/bofa/bofa.parser';
import { GooglePlayEmailService } from './email/subscriptions/google-play/google-play-email.service';
import { GooglePlayParser } from './email/subscriptions/google-play/google-play.parser';
import { AnthropicEmailService } from './email/subscriptions/anthropic/anthropic-email.service';
import { AnthropicParser } from './email/subscriptions/anthropic/anthropic.parser';
import { RenderEmailService } from './email/subscriptions/render/render-email.service';
import { RenderParser } from './email/subscriptions/render/render.parser';
import { TheraEmailService } from './email/incomes/thera/thera-email.service';
import { TheraParser } from './email/incomes/thera/thera.parser';
import { CommonModule } from '../common/common.module';
import { JournalEntryModule } from '../journal-entry/journal-entry.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TransactionsSheetsService } from './transactions-sheets.service';
import { TransactionSearchService } from './transaction-search.service';

@Module({
  imports: [CommonModule, JournalEntryModule, SubscriptionsModule],
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    TransactionsScheduler,
    TransactionsImageCleanupService,
    TransactionsImageCleanupScheduler,
    TransactionsBinanceService,
    TransactionsBinanceConvertService,
    TransactionsBinanceScheduler,
    TransactionsSheetsService,

    EmailServiceRegistry,

    BanescoEmailService,
    BanescoParser,

    BofaEmailService,
    BofaParser,

    GooglePlayEmailService,
    GooglePlayParser,

    AnthropicEmailService,
    AnthropicParser,


    RenderEmailService,
    RenderParser,

    TheraEmailService,
    TheraParser,


    // OCR - LLM-based parsing
    TransactionOcrParser,
    TransactionLlmParserService,
    PagoMovilLlmParserService,

    // Search
    TransactionSearchService,
  ],
  exports: [
    TransactionsService,
    TransactionOcrParser,
    PagoMovilLlmParserService,
    TransactionsSheetsService,
    TransactionSearchService,
  ],
})
export class TransactionsModule {
  constructor(
    private readonly registry: EmailServiceRegistry,
    private readonly banescoService: BanescoEmailService,
    private readonly bofaService: BofaEmailService,
    private readonly googlePlayService: GooglePlayEmailService,
    private readonly anthropicService: AnthropicEmailService,
    private readonly renderService: RenderEmailService,
    private readonly theraService: TheraEmailService,
  ) {
    this.registry.register(this.banescoService);
    this.registry.register(this.bofaService);
    this.registry.register(this.googlePlayService);
    this.registry.register(this.anthropicService);
    this.registry.register(this.renderService);
    this.registry.register(this.theraService);
  }
}
