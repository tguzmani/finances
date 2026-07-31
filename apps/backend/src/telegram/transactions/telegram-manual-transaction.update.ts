import { Update, Ctx, Action } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { SessionContext } from '../telegram.types';
import { TransactionsService } from '../../transactions/transactions.service';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { TelegramBaseHandler } from '../telegram-base.handler';
import { TransactionGroupsService } from '../../transaction-groups/transaction-groups.service';
import { DateParserService } from '../../common/date-parser.service';
import { ExchangeRateService } from '../../exchanges/exchange-rate.service';
import { TransactionPlatform } from '../../transactions/transaction.types';
import { TransactionExtractionService, TransactionDraft } from './transaction-extraction.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TransactionManualCreatedEvent } from '../../transactions/events/transaction-manual-created.event';

@Update()
export class TelegramManualTransactionUpdate {
  private readonly logger = new Logger(TelegramManualTransactionUpdate.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly baseHandler: TelegramBaseHandler,
    private readonly transactionGroupsService: TransactionGroupsService,
    private readonly dateParser: DateParserService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly extractionService: TransactionExtractionService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.log('TelegramManualTransactionUpdate instantiated');
  }

  async handleAddTransaction(@Ctx() ctx: SessionContext) {
    this.logger.log('handleAddTransaction');
    try {
      this.baseHandler.clearSession(ctx);

      await ctx.reply(
        '➕ <b>Manual Transaction Entry</b>\n\n' +
        'Describe your transaction in one message.\n\n' +
        'Or use the step-by-step wizard:',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🪄 Use Wizard', callback_data: 'manual_use_wizard' },
                { text: '🚫 Cancel', callback_data: 'manual_cancel' },
              ],
            ],
          },
        }
      );

      ctx.session.manualTransactionState = 'waiting_freeform';
    } catch (error) {
      this.logger.error(`Error starting manual transaction: ${error.message}`);
      await ctx.reply('Error starting manual entry. Please try again.');
    }
  }

  @Action('manual_use_wizard')
  @UseGuards(TelegramAuthGuard)
  async handleManualUseWizard(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      ctx.session.manualTransactionState = 'waiting_type';
      await ctx.editMessageText(
        '➕ <b>Manual Transaction Entry</b>\n\nWhat type of transaction is this?',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '💰 Income', callback_data: 'manual_type_INCOME' },
                { text: '💸 Expense', callback_data: 'manual_type_EXPENSE' },
              ],
              [{ text: '🚫 Cancel', callback_data: 'manual_cancel' }],
            ],
          },
        }
      );
    } catch (error) {
      this.logger.error(`Error starting wizard: ${error.message}`);
      await ctx.answerCbQuery('Error');
    }
  }

  async handleManualFreeform(@Ctx() ctx: SessionContext) {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text.trim();

    let draft: TransactionDraft;
    try {
      draft = await this.extractionService.extract(text);
    } catch (error) {
      this.logger.error(`Extraction failed: ${error.message}`);
      await ctx.reply(
        '⚠️ Could not understand your message. Please try again or tap the wizard button.',
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🪄 Use Wizard', callback_data: 'manual_use_wizard' },
                { text: '🚫 Cancel', callback_data: 'manual_cancel' },
              ],
            ],
          },
        }
      );
      return;
    }

    this.applyDraftToSession(ctx, draft);
    await this.resumeWizardAtFirstMissingField(ctx);
  }

  private applyDraftToSession(ctx: SessionContext, draft: TransactionDraft) {
    if (draft.type) ctx.session.manualTransactionType = draft.type;
    if (draft.platform) {
      ctx.session.manualTransactionPlatform = draft.platform;
      ctx.session.manualTransactionCurrency = this.transactionsService.getCurrencyForPlatform(
        draft.platform as TransactionPlatform,
      );
    } else if (draft.currency) {
      ctx.session.manualTransactionCurrency = draft.currency;
    }
    if (ctx.session.manualTransactionPlatform) {
      const allowed = this.transactionsService.getAvailablePaymentMethods(
        ctx.session.manualTransactionPlatform as TransactionPlatform,
      );
      if (draft.method && allowed.includes(draft.method as any)) {
        ctx.session.manualTransactionMethod = draft.method;
      } else if (!draft.method && allowed.includes('DEBIT_CARD' as any)) {
        // Default to DEBIT_CARD when not stated — other methods (Pago Móvil, Electronic Transfer)
        // are handled via the photo flow, so manual entries are almost always card purchases.
        ctx.session.manualTransactionMethod = 'DEBIT_CARD';
      }
    }
    if (draft.amount) ctx.session.manualTransactionAmount = draft.amount;
    if (draft.description) ctx.session.manualTransactionDescription = draft.description;
    if (draft.date) {
      const parsed = new Date(draft.date);
      if (!isNaN(parsed.getTime())) {
        ctx.session.manualTransactionDate = parsed;
      }
    }
    if (!ctx.session.manualTransactionDate) {
      ctx.session.manualTransactionDate = new Date();
    }
  }

  private async resumeWizardAtFirstMissingField(@Ctx() ctx: SessionContext) {
    const s = ctx.session;
    const summary = this.buildSummary(ctx);
    const header = `➕ <b>Manual Transaction Entry</b>\n\n${summary}${summary ? '\n' : ''}`;

    if (!s.manualTransactionType) {
      s.manualTransactionState = 'waiting_type';
      await ctx.reply(header + '\nWhat type of transaction is this?', {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💰 Income', callback_data: 'manual_type_INCOME' },
              { text: '💸 Expense', callback_data: 'manual_type_EXPENSE' },
            ],
            [{ text: '🚫 Cancel', callback_data: 'manual_cancel' }],
          ],
        },
      });
      return;
    }

    if (!s.manualTransactionPlatform) {
      s.manualTransactionState = 'waiting_account';
      await ctx.reply(header + '\nWhich account?', {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏦 Banesco', callback_data: 'manual_account_BANESCO' }],
            [{ text: '🏦 Bank of America', callback_data: 'manual_account_BANK_OF_AMERICA' }],
            [{ text: '💱 Binance', callback_data: 'manual_account_BINANCE' }],
            [
              { text: '👛 Wallet', callback_data: 'manual_account_WALLET' },
              { text: '💵 Cash Box', callback_data: 'manual_account_CASH_BOX' },
            ],
            [{ text: '🚫 Cancel', callback_data: 'manual_cancel' }],
          ],
        },
      });
      return;
    }

    const methods = this.transactionsService.getAvailablePaymentMethods(
      s.manualTransactionPlatform as TransactionPlatform,
    );
    if (methods.length > 0 && !s.manualTransactionMethod) {
      s.manualTransactionState = 'waiting_method';
      const buttons = methods.map(m => [
        { text: this.getMethodLabel(m), callback_data: `manual_method_${m}` },
      ]);
      buttons.push([{ text: '🚫 Cancel', callback_data: 'manual_cancel' }]);
      await ctx.reply(header + '\nSelect payment method:', {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons },
      });
      return;
    }

    if (!s.manualTransactionAmount) {
      s.manualTransactionState = 'waiting_amount';
      await ctx.reply(header + '\nEnter the amount:', { parse_mode: 'HTML' });
      return;
    }

    if (!s.manualTransactionDescription) {
      s.manualTransactionState = 'waiting_description';
      await ctx.reply(header + '\nEnter a description for this transaction:', { parse_mode: 'HTML' });
      return;
    }

    if (s.manualTransactionDate) {
      await this.showConfirmation(ctx);
      return;
    }

    s.manualTransactionState = 'waiting_date_choice';
    await ctx.reply(header + '\nWhen did this transaction occur?', {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⏰ Now', callback_data: 'manual_date_now' },
            { text: '📅 Custom', callback_data: 'manual_date_custom' },
          ],
          [{ text: '🚫 Cancel', callback_data: 'manual_cancel' }],
        ],
      },
    });
  }

  @Action(/^manual_type_(.+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleManualType(@Ctx() ctx: SessionContext) {
    try {
      const match = (ctx as any).match as RegExpMatchArray;
      ctx.session.manualTransactionType = match[1] as 'INCOME' | 'EXPENSE';
      await ctx.answerCbQuery();
      await this.collapseButtonsToSummary(ctx);
      await this.resumeWizardAtFirstMissingField(ctx);
    } catch (error) {
      this.logger.error(`Error handling manual type: ${error.message}`);
      await ctx.answerCbQuery('Error');
    }
  }

  @Action(/^manual_account_(.+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleManualAccount(@Ctx() ctx: SessionContext) {
    try {
      const match = (ctx as any).match as RegExpMatchArray;
      const platform = match[1];
      ctx.session.manualTransactionPlatform = platform;
      ctx.session.manualTransactionCurrency = this.transactionsService.getCurrencyForPlatform(platform as any);
      await ctx.answerCbQuery();
      await this.collapseButtonsToSummary(ctx);
      await this.resumeWizardAtFirstMissingField(ctx);
    } catch (error) {
      this.logger.error(`Error handling manual account: ${error.message}`);
      await ctx.answerCbQuery('Error');
    }
  }

  @Action(/^manual_method_(.+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleManualMethod(@Ctx() ctx: SessionContext) {
    try {
      const match = (ctx as any).match as RegExpMatchArray;
      ctx.session.manualTransactionMethod = match[1];
      await ctx.answerCbQuery();
      await this.collapseButtonsToSummary(ctx);
      await this.resumeWizardAtFirstMissingField(ctx);
    } catch (error) {
      this.logger.error(`Error handling manual method: ${error.message}`);
      await ctx.answerCbQuery('Error');
    }
  }

  private async showConfirmation(ctx: SessionContext) {
    ctx.session.manualTransactionState = 'waiting_confirmation';
    const dateStr = ctx.session.manualTransactionDate!.toLocaleString('en-US', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const internalRate = await this.getInternalRate(ctx);
    await ctx.reply(
      `➕ <b>Confirm Transaction</b>\n\n${this.buildSummary(ctx, internalRate)}\nDate: ${dateStr}\n\nIs this correct?`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Confirm', callback_data: 'manual_confirm' },
              { text: '❌ Reject', callback_data: 'manual_reject' },
            ],
          ],
        },
      },
    );
  }

  @Action('manual_confirm')
  @UseGuards(TelegramAuthGuard)
  async handleManualConfirm(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      const date = ctx.session.manualTransactionDate;
      await this.createTransactionAndFinish(ctx, true, date);
    } catch (error) {
      this.logger.error(`Error confirming transaction: ${error.message}`);
      await ctx.answerCbQuery('Error');
    }
  }

  @Action('manual_reject')
  @UseGuards(TelegramAuthGuard)
  async handleManualReject(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Rejected');
      this.baseHandler.clearSession(ctx);
      ctx.session.manualTransactionState = 'waiting_freeform';
      await ctx.editMessageText(
        '➕ <b>Manual Transaction Entry</b>\n\n' +
        'Rejected. Describe your transaction in one message, or use the step-by-step wizard:',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🪄 Use Wizard', callback_data: 'manual_use_wizard' },
                { text: '🚫 Cancel', callback_data: 'manual_cancel' },
              ],
            ],
          },
        },
      );
    } catch (error) {
      this.logger.error(`Error rejecting transaction: ${error.message}`);
      await ctx.answerCbQuery('Error');
    }
  }

  private async collapseButtonsToSummary(ctx: SessionContext) {
    try {
      await ctx.editMessageText(
        `➕ <b>Manual Transaction Entry</b>\n\n${this.buildSummary(ctx)}`,
        { parse_mode: 'HTML' },
      );
    } catch (e) {
      // Message may be too old to edit; ignore.
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
        const amount = parseFloat(text.replace(/,/g, ''));
        if (isNaN(amount) || amount <= 0) {
          await ctx.reply('Invalid amount. Please enter a positive number.');
          return;
        }
        ctx.session.manualTransactionAmount = amount;
        await this.resumeWizardAtFirstMissingField(ctx);
      } else if (ctx.session.manualTransactionState === 'waiting_description') {
        ctx.session.manualTransactionDescription = text;
        await this.resumeWizardAtFirstMissingField(ctx);
      } else if (ctx.session.manualTransactionState === 'waiting_custom_date') {
        // Parse custom date input
        const dateInput = text;

        const parsedDate = this.dateParser.parseVenezuelaDate(dateInput);

        if (!parsedDate) {
          await ctx.reply('❌ Invalid date format. Please try again.');
          return;
        }

        // Create transaction with custom date (text input → new message)
        await this.createTransactionAndFinish(ctx, false, parsedDate);
      }
    } catch (error) {
      this.logger.error(`Error handling manual text input: ${error.message}`);
      await ctx.reply('Error processing input. Please try again or use /add_transaction to restart.');
      this.baseHandler.clearSession(ctx);
    }
  }

  @Action('manual_date_now')
  @UseGuards(TelegramAuthGuard)
  async handleManualDateNow(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();

      // Create transaction with current date (button click → edit)
      await this.createTransactionAndFinish(ctx, true);
    } catch (error) {
      this.logger.error(`Error handling date now: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error creating transaction. Please try again.');
    }
  }

  @Action('manual_date_custom')
  @UseGuards(TelegramAuthGuard)
  async handleManualDateCustom(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();

      ctx.session.manualTransactionState = 'waiting_custom_date';

      await ctx.editMessageText(
        '➕ <b>Manual Transaction Entry</b>\n\n' +
        this.buildSummary(ctx) +
        '\n📅 Enter custom date/time\n\n' +
        '<i>You can use natural language</i>',
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      this.logger.error(`Error handling date custom: ${error.message}`);
      await ctx.answerCbQuery('Error');
    }
  }

  @Action('manual_cancel')
  @UseGuards(TelegramAuthGuard)
  async handleManualCancel(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Cancelled');
      await ctx.editMessageText('❌ Manual transaction entry cancelled.', { parse_mode: 'HTML' });
      this.baseHandler.clearSession(ctx);
    } catch (error) {
      this.logger.error(`Error cancelling manual transaction: ${error.message}`);
    }
  }

  @Action(/^manual_connect_group(?:_(\d+))?$/)
  @UseGuards(TelegramAuthGuard)
  async handleManualConnectGroup(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();

      const match = (ctx as any).match as RegExpMatchArray | undefined;
      const idFromCallback = match?.[1] ? parseInt(match[1], 10) : undefined;
      if (idFromCallback) {
        ctx.session.currentTransactionId = idFromCallback;
      }
      const currentTxId = ctx.session.currentTransactionId;

      if (!currentTxId) {
        await ctx.editMessageText('⚠️ Transaction not found.', { parse_mode: 'HTML' });
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

      // Get existing groups to append to
      const existingGroups = await this.transactionGroupsService.findGroupsForRegistration();

      if (available.length === 0 && existingGroups.length === 0) {
        await ctx.editMessageText('No other transactions or groups available for grouping.', { parse_mode: 'HTML' });
        this.baseHandler.clearSession(ctx);
        return;
      }

      // Build buttons (no text list)
      const buttons = [];

      // Show existing groups first
      for (const group of existingGroups) {
        const memberCount = group.transactions.length;
        const desc = group.description;
        const maxDescLength = 40;
        const truncatedDesc = desc.length > maxDescLength
          ? desc.substring(0, maxDescLength) + '...'
          : desc;
        const buttonText = `📦 ${truncatedDesc} (${memberCount} txns)`;
        buttons.push([
          Markup.button.callback(buttonText, `manual_group_add_to_${group.id}`)
        ]);
      }

      // Then show individual ungrouped transactions
      for (const tx of available) {
        const amount = Number(tx.amount).toFixed(2);
        const desc = tx.description || 'No description';

        // Truncate long descriptions to fit in button
        const maxDescLength = 45;
        const truncatedDesc = desc.length > maxDescLength
          ? desc.substring(0, maxDescLength) + '...'
          : desc;

        // Button format: "Description - Amount USD"
        const buttonText = `${truncatedDesc} - ${amount} ${tx.currency}`;

        buttons.push([
          Markup.button.callback(buttonText, `manual_group_select_${tx.id}`)
        ]);
      }

      buttons.push([Markup.button.callback('❌ Cancel', 'manual_group_cancel')]);

      await ctx.editMessageText('<b>Select transaction or group:</b>', {
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

  @Action(/^manual_group_add_to_(\d+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleManualGroupAddTo(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();

      if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
        return;
      }

      const match = ctx.callbackQuery.data.match(/^manual_group_add_to_(\d+)$/);
      if (!match) {
        return;
      }

      const groupId = parseInt(match[1]);
      const txId = ctx.session.currentTransactionId;

      if (!txId) {
        await ctx.editMessageText('⚠️ Transaction not found.', { parse_mode: 'HTML' });
        this.baseHandler.clearSession(ctx);
        return;
      }

      // Add transaction to the existing group
      await this.transactionGroupsService.addTransactionToGroup(txId, groupId);

      const group = await this.transactionGroupsService.findOne(groupId);
      const count = await this.transactionGroupsService.getGroupMemberCount(groupId);

      await ctx.editMessageText(
        `✅ Transaction added to group: "${group.description}"\n` +
        `Group now contains ${count} transactions.`,
        { parse_mode: 'HTML' }
      );

      this.baseHandler.clearSession(ctx);
    } catch (error) {
      this.logger.error(`Error adding to group: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error adding transaction to group.');
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
        await ctx.editMessageText('⚠️ Transaction not found.', { parse_mode: 'HTML' });
        this.baseHandler.clearSession(ctx);
        return;
      }

      const [tx1, tx2] = await Promise.all([
        this.transactionsService.findOne(tx1Id),
        this.transactionsService.findOne(tx2Id),
      ]);

      if (!tx1 || !tx2) {
        await ctx.editMessageText('❌ Transaction not found.', { parse_mode: 'HTML' });
        this.baseHandler.clearSession(ctx);
        return;
      }

      // Scenario 1: Both have NO group - create new
      if (!tx1.groupId && !tx2.groupId) {
        ctx.session.waitingForGroupDescription = true;
        ctx.session.pendingGroupTransactionId = tx1Id;

        await ctx.editMessageText('📝 Please type a description for this new group:', { parse_mode: 'HTML' });
        return;
      }

      // Scenario 2: tx1 HAS group, tx2 has NO group - add tx2 to group
      if (tx1.groupId && !tx2.groupId) {
        await this.transactionGroupsService.addTransactionToGroup(tx2Id, tx1.groupId);

        const group = await this.transactionGroupsService.findOne(tx1.groupId);
        const count = await this.transactionGroupsService.getGroupMemberCount(tx1.groupId);

        await ctx.editMessageText(
          `✅ Transaction added to group: "${group.description}"\n` +
          `Group now contains ${count} transactions.`,
          { parse_mode: 'HTML' }
        );

        this.baseHandler.clearSession(ctx);
        return;
      }

      // Scenario 3: tx2 already HAS group - error
      if (tx2.groupId) {
        const group = await this.transactionGroupsService.findOne(tx2.groupId);
        await ctx.editMessageText(
          `⚠️ Transaction is already in group: "${group.description}"`,
          { parse_mode: 'HTML' }
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
      await ctx.editMessageText('❌ Grouping cancelled.', { parse_mode: 'HTML' });
      this.baseHandler.clearSession(ctx);
    } catch (error) {
      this.logger.error(`Error handling manual group cancel: ${error.message}`);
    }
  }

  /**
   * Create transaction with all collected data and handle post-creation flow
   * @param ctx Session context
   * @param editMode Whether to edit the existing message or send a new one
   * @param date Optional date (if not provided, uses current time)
   */
  private async createTransactionAndFinish(@Ctx() ctx: SessionContext, editMode: boolean, date?: Date) {
    const description = ctx.session.manualTransactionDescription!;

    const transaction = await this.transactionsService.createManualTransaction({
      type: ctx.session.manualTransactionType as any,
      platform: ctx.session.manualTransactionPlatform as any,
      currency: ctx.session.manualTransactionCurrency!,
      amount: ctx.session.manualTransactionAmount!,
      description,
      method: ctx.session.manualTransactionMethod as any || undefined,
      date,
    });

    // Clear manual transaction flow state
    ctx.session.manualTransactionState = undefined;
    ctx.session.manualTransactionType = undefined;
    ctx.session.manualTransactionPlatform = undefined;
    ctx.session.manualTransactionCurrency = undefined;
    ctx.session.manualTransactionMethod = undefined;
    ctx.session.manualTransactionAmount = undefined;
    ctx.session.manualTransactionDescription = undefined;
    ctx.session.manualTransactionDate = undefined;

    // Format success message — no DB queries here, render immediately.
    const typeIcons: Record<string, string> = { 'INCOME': '💰', 'EXPENSE': '💸' };
    const typeIcon = typeIcons[transaction.type] || '💸';
    const platformLabel = this.getPlatformLabel(transaction.platform);
    const methodLabel = transaction.method ? this.getMethodLabel(transaction.method) : 'N/A';
    const dateStr = new Date(transaction.date).toLocaleString('en-US', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const successMessage =
      `✅ <b>Transaction Created!</b>\n\n` +
      `${typeIcon} <b>${description}</b>\n\n` +
      `Amount: ${transaction.currency} ${Number(transaction.amount).toFixed(2)}\n` +
      `Account: ${platformLabel}\n` +
      `Method: ${methodLabel}\n` +
      `Date: ${dateStr}\n` +
      `Status: Reviewed (ready to register)`;

    if (editMode) {
      await ctx.editMessageText(successMessage, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(successMessage, { parse_mode: 'HTML' });
    }
    this.baseHandler.clearSession(ctx);

    // Sheet update + auto-registration + USD conversion + group-connect lookup all run
    // asynchronously via the listener so the user gets an instant "Created" response.
    this.eventEmitter.emit(
      'transaction.manual.created',
      new TransactionManualCreatedEvent(transaction),
    );
  }

  // ==================== Helpers ====================

  /**
   * Latest internal exchange rate (VES per USD), only when the amount is in VES.
   * Returns undefined if not applicable or unavailable, so the summary just omits
   * the USD equivalent instead of failing.
   */
  private async getInternalRate(ctx: SessionContext): Promise<number | undefined> {
    if (ctx.session.manualTransactionCurrency !== 'VES') return undefined;

    try {
      const rate = await this.exchangeRateService.findLatest();
      const value = rate ? Number(rate.value) : 0;
      return value > 0 ? value : undefined;
    } catch (error) {
      this.logger.error(`Could not fetch internal exchange rate: ${error.message}`);
      return undefined;
    }
  }

  private buildSummary(ctx: SessionContext, internalRate?: number): string {
    const parts: string[] = [];

    if (ctx.session.manualTransactionType) {
      const typeLabels: Record<string, string> = {
        'INCOME': '💰 Income',
        'EXPENSE': '💸 Expense',
      };
      parts.push(`Type: ${typeLabels[ctx.session.manualTransactionType] || ctx.session.manualTransactionType}`);
    }

    if (ctx.session.manualTransactionPlatform) {
      const platformLabel = this.getPlatformLabel(ctx.session.manualTransactionPlatform);
      const currency = ctx.session.manualTransactionCurrency || '';
      parts.push(`Account: ${platformLabel} (${currency})`);
    }

    if (ctx.session.manualTransactionMethod) {
      parts.push(`Method: ${this.getMethodLabel(ctx.session.manualTransactionMethod)}`);
    }

    if (ctx.session.manualTransactionAmount) {
      const currency = ctx.session.manualTransactionCurrency || '';
      const amount = ctx.session.manualTransactionAmount;
      const usdEquivalent =
        currency === 'VES' && internalRate
          ? ` (USD ${(amount / internalRate).toFixed(2)})`
          : '';
      parts.push(`Amount: ${currency} ${amount.toFixed(2)}${usdEquivalent}`);
    }

    if (ctx.session.manualTransactionDescription) {
      parts.push(`Description: ${ctx.session.manualTransactionDescription}`);
    }

    return parts.join('\n');
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
      'ELECTRONIC_TRANSFER': 'Electronic Transfer',
      'ZELLE': 'Zelle',
      'CREDIT_CARD': 'Credit Card',
      'BINANCE_PAY': 'Binance Pay',
      'DEPOSIT': 'Deposit',
      'WITHDRAWAL': 'Withdrawal',
    };
    return labels[method] || method;
  }
}
