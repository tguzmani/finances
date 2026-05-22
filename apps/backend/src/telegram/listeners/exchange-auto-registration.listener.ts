import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { CompletedExchangesEvent } from '../../exchanges/events/completed-exchanges.event';
import { ExchangesService } from '../../exchanges/exchanges.service';
import { JournalEntryService } from '../../journal-entry/journal-entry.service';
import { ExchangeStatus } from '@prisma/client';

@Injectable()
export class ExchangeAutoRegistrationListener {
  private readonly logger = new Logger(ExchangeAutoRegistrationListener.name);
  private readonly chatId: string;

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly exchangesService: ExchangesService,
    private readonly journalEntryService: JournalEntryService,
  ) {
    this.chatId = process.env.TELEGRAM_ALLOWED_USERS?.split(',')[0] || '';

    if (!this.chatId) {
      this.logger.warn('No TELEGRAM_ALLOWED_USERS configured - auto-registration notifications will not be sent');
    }
  }

  @OnEvent('exchanges.completed')
  async handleCompletedExchanges(event: CompletedExchangesEvent) {
    try {
      // Re-query to confirm exchanges are still COMPLETED (prevent double processing)
      const exchanges = await this.exchangesService.findByStatus(ExchangeStatus.COMPLETED);
      if (exchanges.length === 0) {
        this.logger.log('No COMPLETED exchanges found (already processed)');
        return;
      }

      this.logger.log(`Auto-registering ${exchanges.length} completed exchange(s)`);

      // Calculate metrics (sumFormula, wavg)
      const metrics = this.exchangesService.calculateRegisterMetrics(exchanges);
      const exchangeIds = exchanges.map(e => e.id);

      // 1. Create journal entry in Google Sheets
      await this.journalEntryService.createExchangeJournalEntry(metrics.sumFormula, metrics.wavg);
      this.logger.log(`Journal entry created: ${metrics.sumFormula}`);

      // 2. Register exchanges (mark REGISTERED + save rate in DB + update Google Sheets rate)
      await this.exchangesService.registerExchanges(exchangeIds, metrics.wavg);
      this.logger.log(`Registered ${exchangeIds.length} exchanges with rate ${metrics.wavg} VES/USD`);

      // 3. Send Telegram notification
      if (this.chatId) {
        const message =
          `✅ <b>Auto-registered ${exchanges.length} exchange(s)</b>\n\n` +
          `Exchange rate: ${metrics.wavg} VES/USD\n` +
          `Amount: ${metrics.totalAmount} USD`;

        await this.bot.telegram.sendMessage(this.chatId, message, {
          parse_mode: 'HTML',
        });
      }
    } catch (error) {
      this.logger.error(`Failed to auto-register exchanges: ${(error as Error).message}`, (error as Error).stack);

      // Send error notification so user is aware
      if (this.chatId) {
        await this.bot.telegram.sendMessage(
          this.chatId,
          `⚠️ Auto-registration failed: ${(error as Error).message}`,
          { parse_mode: 'HTML' },
        );
      }
    }
  }
}
