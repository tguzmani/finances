import { Module } from '@nestjs/common';
import { JournalEntryService } from './journal-entry.service';
import { JournalEntryLlmService } from './journal-entry-llm.service';
import { CommonModule } from '../common/common.module';
import { ExchangesModule } from '../exchanges/exchanges.module';

@Module({
  imports: [CommonModule, ExchangesModule],
  providers: [JournalEntryService, JournalEntryLlmService],
  exports: [JournalEntryService],
})
export class JournalEntryModule {}
