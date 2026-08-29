import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import {
  BANESCO_MOVEMENT_EVENT,
  BanescoMovementEvent,
} from '../../accounts/events/banesco-movement.event';
import { BanescoAccountService } from '../../accounts/accounts-banesco.service';
import { TelegramAccountsPresenter } from '../accounts/telegram-accounts.presenter';

/**
 * Answers "how much is left in Banesco?" after every movement that touches the
 * account: a P2P sell landing as "Binance a Banesco", any BANESCO transaction
 * regardless of payment method, a transfer with Banesco on either leg, or a
 * manual balance adjustment.
 *
 * The balance is read back from the sheet after the write, so what it reports is
 * what the ledger actually holds. Divergence from the bank app is the signal
 * that something leaked.
 */
@Injectable()
export class BanescoBalanceListener {
  private readonly logger = new Logger(BanescoBalanceListener.name);
  private readonly chatId: string;

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly banescoAccountService: BanescoAccountService,
    private readonly presenter: TelegramAccountsPresenter,
  ) {
    this.chatId = process.env.TELEGRAM_ALLOWED_USERS?.split(',')[0] || '';
  }

  @OnEvent(BANESCO_MOVEMENT_EVENT)
  async handleBanescoMovement(event: BanescoMovementEvent) {
    if (!this.chatId) return;

    try {
      const snapshot = await this.banescoAccountService.getBalanceSnapshot();
      const message = this.presenter.formatBanescoBalance(snapshot, event.reason);

      await this.bot.telegram.sendMessage(this.chatId, message, {
        parse_mode: 'HTML',
      });

      this.logger.log(
        `Sent Banesco balance after "${event.reason}": ${snapshot.estimatedVes.toFixed(2)} VES ` +
        `(sheet ${snapshot.ves.toFixed(2)}, ${snapshot.pendingTxCount} pending tx)`,
      );
    } catch (error) {
      this.logger.error(`Failed to send Banesco balance: ${error.message}`);
    }
  }
}
