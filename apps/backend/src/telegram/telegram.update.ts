import { Update, Ctx, Command, Action, On } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramAuthGuard } from './guards/telegram-auth.guard';
import { SessionContext } from './telegram.types';
import { TransactionsService } from '../transactions/transactions.service';
import { TransactionStatus } from '../transactions/transaction.types';

@Update()
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly transactionsService: TransactionsService,
  ) {}

  @Command('start')
  async handleStart(@Ctx() ctx: SessionContext) {
    await ctx.reply('Welcome! Use /status to view your finance summary.');
  }

  @Command('status')
  @UseGuards(TelegramAuthGuard)
  async handleStatus(@Ctx() ctx: SessionContext) {
    try {
      const message = await this.telegramService.getStatus();
      await ctx.reply(message);
    } catch (error) {
      await ctx.reply('An error occurred. Please try again later.');
    }
  }

  @Command('help')
  async handleHelp(@Ctx() ctx: SessionContext) {
    await ctx.reply(
      'Available commands:\n' +
      '/status - View finance summary\n' +
      '/transactions - View recent expenses\n' +
      '/exchanges - View recent exchanges\n' +
      '/review - Review pending expenses\n' +
      '/sync - Sync data from Banesco and Binance\n' +
      '/help - Show this help'
    );
  }

  @Command('transactions')
  @UseGuards(TelegramAuthGuard)
  async handleTransactions(@Ctx() ctx: SessionContext) {
    try {
      const message = await this.telegramService.getRecentTransactions();
      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (error) {
      await ctx.reply('Error getting transactions.');
    }
  }

  @Command('exchanges')
  @UseGuards(TelegramAuthGuard)
  async handleExchanges(@Ctx() ctx: SessionContext) {
    try {
      const message = await this.telegramService.getRecentExchanges();
      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (error) {
      await ctx.reply('Error getting exchanges.');
    }
  }

  @Command('sync')
  @UseGuards(TelegramAuthGuard)
  async handleSync(@Ctx() ctx: SessionContext) {
    try {
      await ctx.reply('🔄 Starting sync...');
      const result = await this.telegramService.triggerSync();
      await ctx.reply(result, { parse_mode: 'HTML' });
    } catch (error) {
      await ctx.reply('Error during sync.');
    }
  }

  @Command('review')
  @UseGuards(TelegramAuthGuard)
  async handleReview(@Ctx() ctx: SessionContext) {
    try {
      // Clear any previous session state
      ctx.session = {};

      await this.showNextTransaction(ctx);
    } catch (error) {
      await ctx.reply('Error starting review process.');
    }
  }

  @Action('review_reject')
  @UseGuards(TelegramAuthGuard)
  async handleReject(@Ctx() ctx: SessionContext) {
    try {
      const transactionId = ctx.session.currentTransactionId;

      if (!transactionId) {
        await ctx.answerCbQuery('No active transaction');
        return;
      }

      // Update transaction status to REJECTED
      await this.transactionsService.update(transactionId, {
        status: TransactionStatus.REJECTED,
      });

      await ctx.answerCbQuery('Transaction rejected');
      await ctx.reply('❌ Transaction rejected');

      // Show next transaction
      await this.showNextTransaction(ctx);
    } catch (error) {
      await ctx.answerCbQuery('Error rejecting transaction');
    }
  }

  @Action('review_name')
  @UseGuards(TelegramAuthGuard)
  async handleName(@Ctx() ctx: SessionContext) {
    try {
      const transactionId = ctx.session.currentTransactionId;

      if (!transactionId) {
        await ctx.answerCbQuery('No active transaction');
        return;
      }

      // Set flag to wait for description input
      ctx.session.waitingForDescription = true;

      await ctx.answerCbQuery();
      await ctx.reply(
        '✏️ Please type a description for this transaction:',
        { reply_markup: { force_reply: true } }
      );
    } catch (error) {
      await ctx.answerCbQuery('Error');
    }
  }

  @Action('review_skip')
  @UseGuards(TelegramAuthGuard)
  async handleSkip(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Skipped');
      await ctx.reply('⏭️ Skipped');

      // Show next transaction
      await this.showNextTransaction(ctx);
    } catch (error) {
      await ctx.answerCbQuery('Error');
    }
  }

  @Action('review_cancel')
  @UseGuards(TelegramAuthGuard)
  async handleCancel(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Stopped');
      await ctx.reply('🚫 Review process stopped.');

      // Clear session
      ctx.session = {};
    } catch (error) {
      await ctx.answerCbQuery('Error');
    }
  }

  @On('text')
  async handleText(@Ctx() ctx: SessionContext) {
    // Only process if we're waiting for a description
    if (!ctx.session.waitingForDescription || !ctx.session.currentTransactionId) {
      return;
    }

    // Type guard for text messages
    if (!('text' in ctx.message)) {
      return;
    }

    try {
      const transactionId = ctx.session.currentTransactionId;
      const description = ctx.message.text;

      // Update transaction with description and mark as REVIEWED
      await this.transactionsService.update(transactionId, {
        description,
        status: TransactionStatus.REVIEWED,
      });

      await ctx.reply(`✅ Description saved: "${description}"`);

      // Reset session flags
      ctx.session.waitingForDescription = false;

      // Show next transaction
      await this.showNextTransaction(ctx);
    } catch (error) {
      this.logger.error(`Error saving description: ${error.message}`);
      await ctx.reply('Error saving description. Please try again.');
    }
  }

  private async showNextTransaction(ctx: SessionContext) {
    try {
      const transaction = await this.telegramService.getNextReviewTransaction();

      if (!transaction) {
        await ctx.reply('✅ No more transactions to review!');
        ctx.session = {};
        return;
      }

      // Store current transaction in session
      ctx.session.currentTransactionId = transaction.id;
      ctx.session.waitingForDescription = false;

      const message = this.telegramService.formatTransactionForReview(transaction);

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✏️ Name', 'review_name'),
          Markup.button.callback('⏭️ Skip', 'review_skip'),
        ],
        [
          Markup.button.callback('❌ Reject', 'review_reject'),
          Markup.button.callback('🚫 Stop', 'review_cancel'),
        ],
      ]);

      await ctx.reply(message, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } catch (error) {
      this.logger.error(`Error showing next transaction: ${error.message}`);
      await ctx.reply('Error loading transaction.');
    }
  }
}
