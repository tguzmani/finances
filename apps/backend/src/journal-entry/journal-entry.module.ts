import { Module } from '@nestjs/common';
import { JournalEntryService } from './journal-entry.service';
import { JournalEntryLlmService } from './journal-entry-llm.service';
import { JournalEntryCacheService } from './journal-entry-cache.service';
import { CommonModule } from '../common/common.module';
import { ExchangesModule } from '../exchanges/exchanges.module';

@Module({
  imports: [CommonModule, ExchangesModule],
  providers: [JournalEntryService, JournalEntryLlmService, JournalEntryCacheService],
  exports: [JournalEntryService, JournalEntryCacheService],
})
export class JournalEntryModule {}
