import { Update, Ctx, Action } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { SessionContext } from '../telegram.types';
import { TransactionsService } from '../../transactions/transactions.service';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { TelegramBaseHandler } from '../telegram-base.handler';
import { TransactionGroupsService } from '../../transaction-groups/transaction-groups.service';

@Update()
export class TelegramManualTransactionUpdate {
  private readonly logger = new Logger(TelegramManualTransactionUpdate.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly baseHandler: TelegramBaseHandler,
    private readonly transactionGroupsService: TransactionGroupsService,
  ) {
    this.logger.log('TelegramManualTransactionUpdate instantiated');
  }

  async handleAddTransaction(@Ctx() ctx: SessionContext) {
    this.logger.log('handleAddTransaction');
    try {
      // Clear any existing session data
      this.baseHandler.clearSession(ctx);

      await ctx.reply(
        '➕ <b>Manual Transaction Entry</b>\n\n' +
        'What type of transaction is this?',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '💰 Income', callback_data: 'manual_type_INCOME' },
                { text: '💸 Expense', callback_data: 'manual_type_EXPENSE' },
              ],
              [
                { text: '🚫 Cancel', callback_data: 'manual_cancel' },
              ],
            ],
          },
        }
      );

      ctx.session.manualTransactionState = 'waiting_type';
    } catch (error) {
      this.logger.error(`Error starting manual transaction: ${error.message}`);
      await ctx.reply('Error starting manual entry. Please try again.');
    }
  }

  @Action(/^manual_type_(.+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleManualType(@Ctx() ctx: SessionContext) {
    try {
      const match = (ctx as any).match as RegExpMatchArray;
      const type = match[1] as 'INCOME' | 'EXPENSE';

      await ctx.answerCbQuery();

      ctx.session.manualTransactionType = type;
      ctx.session.manualTransactionState = 'waiting_account';

      const typeLabel = type === 'INCOME' ? '💰 Income' : '💸 Expense';

      await ctx.reply(
        `${typeLabel} transaction\n\n` +
        'Which account?',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🏦 Bank of America', callback_data: 'manual_account_BANK_OF_AMERICA' },
              ],
              [
                { text: '🏦 Banesco', callback_data: 'manual_account_BANESCO' },
              ],
              [
                { text: '💱 Binance', callback_data: 'manual_account_BINANCE' },
              ],
              [
                { text: '👛 Wallet', callback_data: 'manual_account_WALLET' },
                { text: '💵 Cash Box', callback_data: 'manual_account_CASH_BOX' },
              ],
              [
                { text: '🚫 Cancel', callback_data: 'manual_cancel' },
              ],
            ],
          },
        }
      );
    } catch (error) {
      this.logger.error(`Error handling manual type: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error processing selection. Please try again.');
    }
  }

  @Action(/^manual_account_(.+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleManualAccount(@Ctx() ctx: SessionContext) {
    try {
      const match = (ctx as any).match as RegExpMatchArray;
      const platform = match[1];

      await ctx.answerCbQuery();

      ctx.session.manualTransactionPlatform = platform;

      // Infer currency
      const currency = this.transactionsService.getCurrencyForPlatform(platform as any);
      ctx.session.manualTransactionCurrency = currency;

      // Get available payment methods
      const methods = this.transactionsService.getAvailablePaymentMethods(platform as any);

      if (methods.length === 0) {
        // Skip payment method for Wallet/Cash Box
        ctx.session.manualTransactionState = 'waiting_amount';

        await ctx.reply(
          `Account: ${this.getPlatformLabel(platform)}\n` +
          `Currency: ${currency}\n\n` +
          'Enter the amount:',
          { parse_mode: 'HTML' }
        );
      } else {
        // Show payment method options
        ctx.session.manualTransactionState = 'waiting_method';

        const buttons = methods.map(method => [
          { text: this.getMethodLabel(method), callback_data: `manual_method_${method}` }
        ]);

        buttons.push([{ text: '🚫 Cancel', callback_data: 'manual_cancel' }]);

        await ctx.reply(
          `Account: ${this.getPlatformLabel(platform)}\n` +
          `Currency: ${currency}\n\n` +
          'Select payment method:',
          {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: buttons },
          }
        );
      }
    } catch (error) {
      this.logger.error(`Error handling manual account: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error processing selection. Please try again.');
    }
  }

  @Action(/^manual_method_(.+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleManualMethod(@Ctx() ctx: SessionContext) {
    try {
      const match = (ctx as any).match as RegExpMatchArray;
      const method = match[1];

      await ctx.answerCbQuery();

      ctx.session.manualTransactionMethod = method;
      ctx.session.manualTransactionState = 'waiting_amount';

      await ctx.reply(
        `Payment method: ${this.getMethodLabel(method)}\n\n` +
        'Enter the amount:',
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      this.logger.error(`Error handling manual method: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error processing selection. Please try again.');
    }
  }

  // This method is called by TelegramTransactionsUpdate when in manual transaction state
  async handleManualAmountOrDescription(@Ctx() ctx: SessionContext) {
    // Type guard for text messages
    if (!('text' in ctx.message)) {
      return;
    }

    try {
      const text = ctx.message.text.trim();

      // Handle group description input (from manual connect group flow)
      if (ctx.session.waitingForGroupDescription) {
        const description = text;
        const tx1Id = ctx.session.pendingGroupTransactionId;
        const tx2Id = ctx.session.currentTransactionId;

        if (!tx1Id || !tx2Id) {
          await ctx.reply('⚠️ Session error. Please try again.');
          this.baseHandler.clearSession(ctx);
          return;
        }

        // Create group with both transactions
        await this.transactionGroupsService.createGroupWithTransactions(
          description,
          [tx1Id, tx2Id]
        );

        await ctx.reply(
          `✅ Group created: "${description}"\n` +
          `Transactions ${tx1Id} and ${tx2Id} are now grouped.`
        );

        // Clear session
        this.baseHandler.clearSession(ctx);
        return;
      }

      if (ctx.session.manualTransactionState === 'waiting_amount') {
        // Parse amount
        const amount = parseFloat(text.replace(/,/g, ''));

        if (isNaN(amount) || amount <= 0) {
          await ctx.reply('Invalid amount. Please enter a positive number.');
          return;
        }

        ctx.session.manualTransactionAmount = amount;
        ctx.session.manualTransactionState = 'waiting_description';

        await ctx.reply(
          `Amount: ${ctx.session.manualTransactionCurrency} ${amount.toFixed(2)}\n\n` +
          'Enter a description for this transaction:',
          { parse_mode: 'HTML' }
        );
      } else if (ctx.session.manualTransactionState === 'waiting_description') {
        // Save description and create transaction
        const description = text;

        await ctx.reply('Creating transaction...');

        const transaction = await this.transactionsService.createManualTransaction({
          type: ctx.session.manualTransactionType as any,
          platform: ctx.session.manualTransactionPlatform as any,
          currency: ctx.session.manualTransactionCurrency!,
          amount: ctx.session.manualTransactionAmount!,
          description,
          method: ctx.session.manualTransactionMethod as any || undefined,
        });

        // Format success message
        const typeIcon = transaction.type === 'INCOME' ? '💰' : '💸';
        const platformLabel = this.getPlatformLabel(transaction.platform);
        const methodLabel = transaction.method ? this.getMethodLabel(transaction.method) : 'N/A';

        await ctx.reply(
          `✅ <b>Transaction Created!</b>\n\n` +
          `${typeIcon} <b>${description}</b>\n\n` +
          `Amount: ${transaction.currency} ${Number(transaction.amount).toFixed(2)}\n` +
          `Account: ${platformLabel}\n` +
          `Method: ${methodLabel}\n` +
          `Status: Reviewed (ready to register)`,
          { parse_mode: 'HTML' }
        );

        // Check if there are other REVIEWED transactions to connect to a group
        const allTransactions = await this.transactionsService.findAll({});
        const otherReviewedTransactions = allTransactions.filter(t =>
          t.status === 'REVIEWED' &&
          t.id !== transaction.id &&
          t.groupId === null
        );

        if (otherReviewedTransactions.length > 0) {
          // Store the created transaction ID in session for grouping
          ctx.session.currentTransactionId = transaction.id;

          const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('📎 Connect to Group', 'manual_connect_group')],
          ]);

          await ctx.reply(
            'Would you like to connect this transaction to a group?',
            keyboard
          );
        } else {
          // Clear session if no other transactions available
          this.baseHandler.clearSession(ctx);
        }
      }
    } catch (error) {
      this.logger.error(`Error handling manual text input: ${error.message}`);
      await ctx.reply('Error processing input. Please try again or use /add_transaction to restart.');
      this.baseHandler.clearSession(ctx);
    }
  }

  @Action('manual_cancel')
  @UseGuards(TelegramAuthGuard)
  async handleManualCancel(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Cancelled');
      await ctx.reply('❌ Manual transaction entry cancelled.');
      this.baseHandler.clearSession(ctx);
    } catch (error) {
      this.logger.error(`Error cancelling manual transaction: ${error.message}`);
    }
  }

  @Action('manual_connect_group')
  @UseGuards(TelegramAuthGuard)
  async handleManualConnectGroup(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();

      const currentTxId = ctx.session.currentTransactionId;

      if (!currentTxId) {
        await ctx.reply('⚠️ Transaction not found.');
        this.baseHandler.clearSession(ctx);
        return;
      }

      // Get available transactions to group with
      const allTransactions = await this.transactionsService.findAll({});
      const available = allTransactions.filter(t =>
        (t.status === 'NEW' || t.status === 'REVIEWED') &&
        t.id !== currentTxId &&
        t.groupId === null
      );

      if (available.length === 0) {
        await ctx.reply('No other transactions available for grouping.');
        this.baseHandler.clearSession(ctx);
        return;
      }

      // Build message and buttons
      let message = '<b>Select transaction to group with:</b>\n\n';
      const buttons = [];

      for (const tx of available) {
        const date = new Date(tx.date).toLocaleDateString('es-VE', { timeZone: 'UTC' });
        const amount = Number(tx.amount).toFixed(2);
        const desc = tx.description || 'No description';

        message += `ID: ${tx.id} - ${desc} - ${date}. ${amount} ${tx.currency}\n`;
        buttons.push([
          Markup.button.callback(`ID: ${tx.id}`, `manual_group_select_${tx.id}`)
        ]);
      }

      buttons.push([Markup.button.callback('❌ Cancel', 'manual_group_cancel')]);

      await ctx.reply(message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      this.logger.error(`Error in manual connect group: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error loading transactions.');
      this.baseHandler.clearSession(ctx);
    }
  }

  @Action(/^manual_group_select_(\d+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleManualGroupSelect(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();

      if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
        return;
      }

      const match = ctx.callbackQuery.data.match(/^manual_group_select_(\d+)$/);
      if (!match) {
        return;
      }

      const tx1Id = parseInt(match[1]); // Selected from list
      const tx2Id = ctx.session.currentTransactionId; // Newly created transaction

      if (!tx2Id) {
        await ctx.reply('⚠️ Transaction not found.');
        this.baseHandler.clearSession(ctx);
        return;
      }

      const [tx1, tx2] = await Promise.all([
        this.transactionsService.findOne(tx1Id),
        this.transactionsService.findOne(tx2Id),
      ]);

      if (!tx1 || !tx2) {
        await ctx.reply('❌ Transaction not found.');
        this.baseHandler.clearSession(ctx);
        return;
      }

      // Scenario 1: Both have NO group - create new
      if (!tx1.groupId && !tx2.groupId) {
        ctx.session.waitingForGroupDescription = true;
        ctx.session.pendingGroupTransactionId = tx1Id;

        await ctx.reply('📝 Please type a description for this new group:');
        return;
      }

      // Scenario 2: tx1 HAS group, tx2 has NO group - add tx2 to group
      if (tx1.groupId && !tx2.groupId) {
        await this.transactionGroupsService.addTransactionToGroup(tx2Id, tx1.groupId);

        const group = await this.transactionGroupsService.findOne(tx1.groupId);
        const count = await this.transactionGroupsService.getGroupMemberCount(tx1.groupId);

        await ctx.reply(
          `✅ Transaction added to group: "${group.description}"\n` +
          `Group now contains ${count} transactions.`
        );

        this.baseHandler.clearSession(ctx);
        return;
      }

      // Scenario 3: tx2 already HAS group - error
      if (tx2.groupId) {
        const group = await this.transactionGroupsService.findOne(tx2.groupId);
        await ctx.reply(
          `⚠️ Transaction is already in group: "${group.description}"`
        );
        this.baseHandler.clearSession(ctx);
      }
    } catch (error) {
      this.logger.error(`Error handling manual group select: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error processing selection.');
      this.baseHandler.clearSession(ctx);
    }
  }

  @Action('manual_group_cancel')
  @UseGuards(TelegramAuthGuard)
  async handleManualGroupCancel(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Cancelled');
      await ctx.reply('❌ Grouping cancelled.');
      this.baseHandler.clearSession(ctx);
    } catch (error) {
      this.logger.error(`Error handling manual group cancel: ${error.message}`);
    }
  }

  private getPlatformLabel(platform: string): string {
    const labels: Record<string, string> = {
      'BANESCO': 'Banesco',
      'BANK_OF_AMERICA': 'Bank of America',
      'BINANCE': 'Binance',
      'WALLET': 'Wallet',
      'CASH_BOX': 'Cash Box',
    };
    return labels[platform] || platform;
  }

  private getMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      'DEBIT_CARD': 'Debit Card',
      'PAGO_MOVIL': 'Pago Móvil',
      'ZELLE': 'Zelle',
      'CREDIT_CARD': 'Credit Card',
      'BINANCE_PAY': 'Binance Pay',
      'DEPOSIT': 'Deposit',
      'WITHDRAWAL': 'Withdrawal',
    };
    return labels[method] || method;
  }
}
