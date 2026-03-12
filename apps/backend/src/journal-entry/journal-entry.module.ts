import { Module } from '@nestjs/common';
import { JournalEntryService } from './journal-entry.service';
import { JournalEntryLlmService } from './journal-entry-llm.service';
import { JournalEntryCacheService } from './journal-entry-cache.service';
import { AutoRegistrationService } from './auto-registration.service';
import { SheetUpdateService } from './sheet-update.service';
import { LedgerRowCursorService } from './ledger-row-cursor.service';
import { CommonModule } from '../common/common.module';
import { ExchangesModule } from '../exchanges/exchanges.module';

@Module({
  imports: [CommonModule, ExchangesModule],
  providers: [JournalEntryService, JournalEntryLlmService, JournalEntryCacheService, AutoRegistrationService, SheetUpdateService, LedgerRowCursorService],
  exports: [JournalEntryService, JournalEntryCacheService, AutoRegistrationService, SheetUpdateService, LedgerRowCursorService],
})
export class JournalEntryModule {}
