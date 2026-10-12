import { Injectable } from '@nestjs/common';
import { CheckInTrigger } from '@prisma/client';
import { InlineKeyboardMarkup } from 'telegraf/types';
import { BookkeepingService, ClosingWithBalances } from '../../bookkeeping/bookkeeping.service';
import { TelegramBookkeepingPresenter } from './telegram-bookkeeping.presenter';

export interface BookkeepingMessage {
  text: string;
  keyboard: InlineKeyboardMarkup;
}

/**
 * Builds the check-in and closing messages, so the nightly cron and the typed
 * commands send exactly the same thing.
 */
@Injectable()
export class TelegramBookkeepingService {
  constructor(
    private readonly bookkeepingService: BookkeepingService,
    private readonly presenter: TelegramBookkeepingPresenter,
  ) {}

  async openCheckIn(trigger: CheckInTrigger): Promise<BookkeepingMessage> {
    const opened = await this.bookkeepingService.openCheckIn(trigger);

    return {
      text: this.presenter.formatCheckIn(opened),
      keyboard: this.presenter.checkInKeyboard(opened.checkIn.id),
    };
  }

  async close(): Promise<BookkeepingMessage & { closing: ClosingWithBalances }> {
    const closing = await this.bookkeepingService.close();

    return {
      closing,
      text: this.presenter.formatClosing(closing),
      keyboard: this.presenter.outcomeKeyboard(closing.id),
    };
  }
}
