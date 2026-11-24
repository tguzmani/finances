import { Injectable } from '@nestjs/common';
import { InlineKeyboardMarkup } from 'telegraf/types';
import { BookkeepingService } from '../../bookkeeping/bookkeeping.service';
import { TelegramBookkeepingPresenter } from './telegram-bookkeeping.presenter';

export interface BookkeepingMessage {
  text: string;
  keyboard: InlineKeyboardMarkup;
}

@Injectable()
export class TelegramBookkeepingService {
  constructor(
    private readonly bookkeepingService: BookkeepingService,
    private readonly presenter: TelegramBookkeepingPresenter,
  ) {}

  async close(): Promise<BookkeepingMessage> {
    const closing = await this.bookkeepingService.close();

    return {
      text: this.presenter.formatClosing(closing),
      keyboard: this.presenter.outcomeKeyboard(closing.id),
    };
  }
}
