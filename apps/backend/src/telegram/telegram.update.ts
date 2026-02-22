import { Update, Ctx, Command, Action } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramAuthGuard } from './guards/telegram-auth.guard';
import { SessionContext } from './telegram.types';
import { TelegramTransactionsUpdate } from './transactions/telegram-transactions.update';
import { TelegramExchangesUpdate } from './exchanges/telegram-exchanges.update';
import { TelegramManualTransactionUpdate } from './transactions/telegram-manual-transaction.update';
import { TelegramRatesUpdate } from './rates/telegram-rates.update';
import { TelegramAccountsUpdate } from './accounts/telegram-accounts.update';
import { TelegramExpensesUpdate } from './expenses/telegram-expenses.update';
import { TelegramBaseHandler } from './telegram-base.handler';
import { TransactionGroupsService } from '../transaction-groups/transaction-groups.service';
import { ExchangeRateService } from '../exchanges/exchange-rate.service';
import { TelegramGroupsPresenter } from './transactions/telegram-groups.presenter';
import { TelegramGroupFlowUpdate } from './transactions/telegram-group-flow.update';
import { TelegramConvertUpdate } from './exchanges/convert/telegram-convert.update';

@Update()
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly transactionsUpdate: TelegramTransactionsUpdate,
    private readonly exchangesUpdate: TelegramExchangesUpdate,
    private readonly manualTransactionUpdate: TelegramManualTransactionUpdate,
    private readonly ratesUpdate: TelegramRatesUpdate,
    private readonly accountsUpdate: TelegramAccountsUpdate,
    private readonly expensesUpdate: TelegramExpensesUpdate,
    private readonly baseHandler: TelegramBaseHandler,
    private readonly transactionGroupsService: TransactionGroupsService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly groupsPresenter: TelegramGroupsPresenter,
    private readonly groupFlowUpdate: TelegramGroupFlowUpdate,
    private readonly convertUpdate: TelegramConvertUpdate,
  ) { }

  @Command('start')
  async handleStart(@Ctx() ctx: SessionContext) {
    await ctx.reply('Welcome! Use /status to view your finance summary.');
  }

  @Command('status')
  @UseGuards(TelegramAuthGuard)
  async handleStatus(@Ctx() ctx: SessionContext) {
    try {
      const message = await this.telegramService.getStatus();
      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (error) {
      await ctx.reply('An error occurred. Please try again later.');
    }
  }

  @Command('help')
  async handleHelp(@Ctx() ctx: SessionContext) {
    await ctx.reply(
      'Available commands:\n' +
      '/status - View finance summary\n' +
      '/accounts - View account balances\n' +
      '/expenses - View budget and expenses\n' +
      '/rates - View exchange rates and discounts\n' +
      '/transactions - View recent expenses\n' +
      '/convert - Convert between currencies\n' +
      '/exchanges - View recent exchanges\n' +
      '/group - Create or manage groups\n' +
      '/groups - View unregistered groups\n' +
      '/review - Review pending transactions\n' +
      '/register - Register reviewed items\n' +
      '/add_transaction - Add manual transaction\n' +
      '/sync - Sync data from Banesco, BofA and Binance\n' +
      '/help - Show this help'
    );
  }

  @Command('group')
  @UseGuards(TelegramAuthGuard)
  async handleGroup(@Ctx() ctx: SessionContext) {
    await this.groupFlowUpdate.startGroupFlow(ctx);
  }

  @Command('groups')
  @UseGuards(TelegramAuthGuard)
  async handleGroups(@Ctx() ctx: SessionContext) {
    try {
      const [groups, latestRate] = await Promise.all([
        this.transactionGroupsService.findGroupsForRegistration(),
        this.exchangeRateService.findLatest(),
      ]);

      if (groups.length === 0) {
        await ctx.reply('📭 No unregistered groups.');
        return;
      }

      const exchangeRate = latestRate ? Number(latestRate.value) : 0;

      let message = `<b>Unregistered Groups (${groups.length}):</b>\n\n`;

      for (const group of groups) {
        const calculation = await this.transactionGroupsService.calculateGroupAmount(group.id, exchangeRate);
        const groupDate = await this.transactionGroupsService.calculateGroupDate(group.id);

        // Use presenter to format the group
        message += this.groupsPresenter.formatGroupForDisplay(group, calculation, groupDate, exchangeRate);
        message += '\n\n';
      }

      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error(`Error in groups command: ${error.message}`);
      await ctx.reply('Error getting groups.');
    }
  }

  @Command('add_transaction')
  @UseGuards(TelegramAuthGuard)
  async handleAddTransaction(@Ctx() ctx: SessionContext) {
    await this.manualTransactionUpdate.handleAddTransaction(ctx);
  }

  @Command('exchanges')
  @UseGuards(TelegramAuthGuard)
  async handleExchanges(@Ctx() ctx: SessionContext) {
    await this.exchangesUpdate.handleExchanges(ctx);
  }

  @Command('rates')
  @UseGuards(TelegramAuthGuard)
  async handleRates(@Ctx() ctx: SessionContext) {
    await this.ratesUpdate.handleRates(ctx);
  }

  @Command('accounts')
  @UseGuards(TelegramAuthGuard)
  async handleAccounts(@Ctx() ctx: SessionContext) {
    await this.accountsUpdate.handleAccounts(ctx);
  }

  @Command('expenses')
  @UseGuards(TelegramAuthGuard)
  async handleExpenses(@Ctx() ctx: SessionContext) {
    await this.expensesUpdate.handleExpenses(ctx);
  }

  @Command('convert')
  @UseGuards(TelegramAuthGuard)
  async handleConvert(@Ctx() ctx: SessionContext) {
    await this.convertUpdate.handleConvert(ctx);
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

  @Command('register')
  @UseGuards(TelegramAuthGuard)
  async handleRegister(@Ctx() ctx: SessionContext) {
    try {
      // Clear any previous session state
      this.baseHandler.clearSession(ctx);

      // Get counts
      const [reviewedTxCount, reviewedExCount] = await Promise.all([
        this.telegramService.transactions.getReviewedTransactions().then(txs => txs.length),
        this.telegramService.exchanges.getReviewedExchanges().then(exs => exs.length),
      ]);

      // If nothing to register, show message
      if (reviewedTxCount === 0 && reviewedExCount === 0) {
        await ctx.reply('✅ Nothing to register right now');
        return;
      }

      // If only transactions available, go directly to transaction registration
      if (reviewedTxCount > 0 && reviewedExCount === 0) {
        await ctx.reply('ℹ️ Only transactions available to register');
        await this.transactionsUpdate.startTransactionRegistration(ctx);
        return;
      }

      // If only exchanges available, go directly to exchange registration
      if (reviewedExCount > 0 && reviewedTxCount === 0) {
        await ctx.reply('ℹ️ Only exchanges available to register');
        await this.exchangesUpdate.startExchangeRegistration(ctx);
        return;
      }

      // Both have items - show selection buttons
      const buttons = [
        [Markup.button.callback(`💸 Transactions (${reviewedTxCount})`, 'register_start_transactions')],
        [Markup.button.callback(`💱 Exchanges (${reviewedExCount})`, 'register_start_exchanges')],
      ];

      const keyboard = Markup.inlineKeyboard(buttons);

      await ctx.reply(
        '<b>What would you like to register?</b>',
        {
          parse_mode: 'HTML',
          ...keyboard,
        }
      );
    } catch (error) {
      this.logger.error(`Error in register command: ${error.message}`);
      await ctx.reply('Error starting registration process.');
    }
  }

  @Command('review')
  @UseGuards(TelegramAuthGuard)
  async handleReview(@Ctx() ctx: SessionContext) {
    try {
      // Clear any previous session state
      this.baseHandler.clearSession(ctx);

      // Get count for transactions only
      const transactionsCount = await this.telegramService.transactions.getPendingReviewCount();

      // If nothing to review, show message
      if (transactionsCount === 0) {
        await ctx.reply('✅ Nothing to review right now');
        return;
      }

      // Directly start transaction review (no need for selection since only transactions)
      ctx.session.reviewType = 'transactions';

      // Initialize progress tracking
      this.baseHandler.initializeReviewProgress(ctx, transactionsCount);

      // Start transaction review flow
      await this.transactionsUpdate.startTransactionReview(ctx);
    } catch (error) {
      await ctx.reply('Error starting review process.');
    }
  }

  @Command('review_one')
  @UseGuards(TelegramAuthGuard)
  async handleReviewOne(@Ctx() ctx: SessionContext) {
    try {
      // Clear any previous session state
      this.baseHandler.clearSession(ctx);

      // Transaction search is always available (searches any status)
      // Only check if there are exchanges to offer that option too
      const exCount = await this.telegramService.exchanges.getReviewedExchanges().then(exs => exs.length);

      if (exCount === 0) {
        // No exchanges — go directly to transaction search
        ctx.session.reviewOneMode = 'waiting_for_tx_search';
        ctx.session.reviewOneType = 'transaction';
        await ctx.reply(
          '🔍 <b>Search transaction</b>\n\n<i>Type name, amount, date, platform, or any combination</i>',
          { parse_mode: 'HTML', reply_markup: { force_reply: true } },
        );
        return;
      }

      // Exchanges available — show selection buttons
      const buttons = [
        [Markup.button.callback('💸 Transaction', 'review_one_transaction')],
        [Markup.button.callback(`💱 Exchange (${exCount} reviewed)`, 'review_one_exchange')],
      ];

      await ctx.reply('<b>What would you like to review?</b>', {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      await ctx.reply('Error starting review by ID.');
    }
  }

  @Action('review_go_back')
  @UseGuards(TelegramAuthGuard)
  async handleReviewGoBack(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();

      const reviewType = ctx.session.reviewType;

      if (reviewType === 'transactions') {
        await this.transactionsUpdate.showPreviousTransactionPublic(ctx);
      } else {
        await ctx.answerCbQuery('No active review');
      }
    } catch (error) {
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error going back.');
    }
  }

  @Action('review_cancel')
  @UseGuards(TelegramAuthGuard)
  async handleCancel(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Stopped');
      await ctx.reply('🚫 Review process stopped.');

      // Clear session
      this.baseHandler.clearSession(ctx);
    } catch (error) {
      await ctx.answerCbQuery('Error');
    }
  }

  @Action('register_cancel')
  @UseGuards(TelegramAuthGuard)
  async handleRegisterCancel(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Cancelled');
      await ctx.reply('🚫 Registration cancelled.');
      this.baseHandler.clearSession(ctx);
    } catch (error) {
      await ctx.answerCbQuery('Error');
    }
  }
}
