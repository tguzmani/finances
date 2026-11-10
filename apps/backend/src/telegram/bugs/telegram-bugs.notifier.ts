import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { BugReportService } from '../../bug-reports/bug-report.service';
import { TelegramBugsPresenter } from './telegram-bugs.presenter';

/**
 * Closes the loop on a report: the fix ships, the bot boots, and the chat says
 * which bug went away and what the fix was. Announcing on boot rather than on a
 * schedule ties the message to the deploy that carries the fix.
 *
 * `notifiedAt` is what keeps it to once per row, so a restart announces nothing.
 */
@Injectable()
export class TelegramBugsNotifier implements OnApplicationBootstrap {
  private readonly logger = new Logger(TelegramBugsNotifier.name);
  private readonly chatId: string;

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly bugReportService: BugReportService,
    private readonly presenter: TelegramBugsPresenter,
  ) {
    this.chatId = process.env.TELEGRAM_ALLOWED_USERS?.split(',')[0] || '';
  }

  async onApplicationBootstrap() {
    if (!this.chatId) {
      this.logger.warn('No TELEGRAM_ALLOWED_USERS configured - bug updates will not be announced');
      return;
    }

    try {
      const bugs = await this.bugReportService.findUnannounced();
      if (bugs.length === 0) return;

      await this.bot.telegram.sendMessage(this.chatId, this.presenter.announcement(bugs), {
        parse_mode: 'HTML',
      });
      await this.bugReportService.markAnnounced(bugs.map((bug) => bug.id));

      this.logger.log(`Announced ${bugs.length} resolved bug report(s)`);
    } catch (error) {
      // The rows stay unannounced, so the next boot tries again
      this.logger.error(`Announcing resolved bugs failed: ${error.message}`);
    }
  }
}
