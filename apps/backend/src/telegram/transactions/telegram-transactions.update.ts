import { Update, Ctx, Command, Action, On } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { Transaction } from '@prisma/client';
import { TelegramService } from '../telegram.service';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { SessionContext } from '../telegram.types';
import { TransactionsService } from '../../transactions/transactions.service';
import { TransactionStatus } from '../../transactions/transaction.types';
import { TransactionSearchService } from '../../transactions/transaction-search.service';
import { TelegramBaseHandler } from '../telegram-base.handler';
import { TelegramExchangesUpdate } from '../exchanges/telegram-exchanges.update';
import { TelegramManualTransactionUpdate } from './telegram-manual-transaction.update';
import { TelegramAccountsUpdate } from '../accounts/telegram-accounts.update';
import { TelegramSettingsUpdate } from '../settings/telegram-settings.update';
import { TelegramConvertUpdate } from '../exchanges/convert/telegram-convert.update';
import { TransactionGroupsService } from '../../transaction-groups/transaction-groups.service';
import { TransactionGroupStatus } from '../../transaction-groups/transaction-group.types';
import { TelegramGroupFlowUpdate } from './telegram-group-flow.update';
import { TelegramTransferUpdate } from '../transfers/telegram-transfer.update';
import { TelegramPagoMovilUpdate } from '../pago-movil/telegram-pago-movil.update';
import { DateParserService } from '../../common/date-parser.service';
import { B2StorageService } from '../../common/b2-storage.service';
import { AutoRegistrationService } from '../../journal-entry/auto-registration.service';
import { SheetUpdateService } from '../../journal-entry/sheet-update.service';

@Update()
export class TelegramTransactionsUpdate {
  private readonly logger = new Logger(TelegramTransactionsUpdate.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly transactionsService: TransactionsService,
    private readonly transactionSearchService: TransactionSearchService,
    private readonly baseHandler: TelegramBaseHandler,
    private readonly exchangesUpdate: TelegramExchangesUpdate,
    private readonly manualTransactionUpdate: TelegramManualTransactionUpdate,
    private readonly accountsUpdate: TelegramAccountsUpdate,
    private readonly settingsUpdate: TelegramSettingsUpdate,
    private readonly convertUpdate: TelegramConvertUpdate,
    private readonly transactionGroupsService: TransactionGroupsService,
    private readonly groupFlowUpdate: TelegramGroupFlowUpdate,
    private readonly dateParser: DateParserService,
    private readonly autoRegistrationService: AutoRegistrationService,
    private readonly sheetUpdateService: SheetUpdateService,
    private readonly b2Storage: B2StorageService,
    private readonly transferUpdate: TelegramTransferUpdate,
    private readonly pagoMovilUpdate: TelegramPagoMovilUpdate,
  ) { }

  @Command('transactions')
  @UseGuards(TelegramAuthGuard)
  async handleTransactions(@Ctx() ctx: SessionContext) {
    try {
      const message = await this.telegramService.transactions.getRecentTransactionsList();
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Show all', 'transactions_show_all')],
      ]);
      await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
    } catch (error) {
      await ctx.reply('Error getting transactions.');
    }
  }

  @Action('review_start_transactions')
  @UseGuards(TelegramAuthGuard)
  async handleReviewStartTransactions(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      ctx.session.reviewType = 'transactions';

      // Initialize progress tracking
      const totalCount = await this.telegramService.transactions.getPendingReviewCount();
      this.baseHandler.initializeReviewProgress(ctx, totalCount);

      await this.showNextTransaction(ctx);
    } catch (error) {
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error starting transaction review.');
    }
  }

  @Action('review_one_transaction')
  @UseGuards(TelegramAuthGuard)
  async handleReviewOneTransaction(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      ctx.session.reviewOneMode = 'waiting_for_tx_search';
      ctx.session.reviewOneType = 'transaction';

      await ctx.reply(
        '🔍 <b>Search transaction</b>\n\n<i>Type name, amount, date, platform, or any combination</i>',
        { parse_mode: 'HTML', reply_markup: { force_reply: true } },
      );
    } catch (error) {
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error. Please try again.');
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

      // Check if transaction is in a group
      const transaction = await this.transactionsService.findOne(transactionId);
      let ungroupedMessage = '';

      if (transaction?.groupId) {
        const group = await this.transactionGroupsService.findOne(transaction.groupId);
        const memberCount = await this.transactionGroupsService.getGroupMemberCount(transaction.groupId);

        // Remove from group
        await this.transactionGroupsService.removeTransactionFromGroup(transactionId);

        ungroupedMessage = `\n\n🔗 Removed from group: "${group.description}"`;

        // If group now has only 1 member, delete the group
        if (memberCount === 2) {
          await this.transactionGroupsService.delete(group.id);
          ungroupedMessage += '\n⚠️ Group deleted (only 1 transaction remaining).';
        }
      }

      // Update transaction status to REJECTED
      await this.transactionsService.update(transactionId, {
        status: TransactionStatus.REJECTED,
      });

      await ctx.answerCbQuery('Transaction rejected');

      // If single item review, edit the message to show rejected status with undo
      if (ctx.session.reviewSingleItem) {
        const rejectedTx = await this.transactionsService.findOne(transactionId);
        const message = await this.telegramService.transactions.formatTransactionForReview(rejectedTx);

        await ctx.editMessageText(
          `<b>Transaction ID: ${transactionId}</b>\n\n` +
          message +
          ungroupedMessage +
          '\n\n❌ <b>Rejected</b>',
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '↩️ Undo', callback_data: `review_undo_reject_${transactionId}` }],
              ],
            },
          },
        );
        this.baseHandler.clearSession(ctx);
      } else {
        await ctx.reply(`❌ Transaction rejected${ungroupedMessage}`);
        await this.showNextTransaction(ctx);
      }
    } catch (error) {
      await ctx.answerCbQuery('Error rejecting transaction');
    }
  }

  @Action(/^review_undo_reject_(\d+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleUndoReject(@Ctx() ctx: SessionContext) {
    try {
      const match = (ctx as any).match as RegExpMatchArray;
      const transactionId = parseInt(match[1]);

      await this.transactionsService.update(transactionId, {
        status: TransactionStatus.REVIEWED,
      });

      const transaction = await this.transactionsService.findOne(transactionId);

      await ctx.answerCbQuery('Rejection undone');

      // Re-display the transaction with full review buttons
      ctx.session.reviewSingleItem = true;
      ctx.session.currentTransactionId = transaction.id;
      ctx.session.waitingForDescription = true;
      ctx.session.reviewType = 'transactions';

      const message = await this.telegramService.transactions.formatTransactionForReview(transaction);

      const hasGroup = transaction.groupId !== null;
      const groupButton = hasGroup
        ? Markup.button.callback('🔗 Ungroup', 'ungroup_transaction')
        : Markup.button.callback('📎 Group', 'group_transaction');

      const buttons = [];

      if (transaction.imageUrl) {
        buttons.push([Markup.button.callback('🧾 View Bill', `view_bill_${transaction.id}`)]);
      }

      buttons.push([
        Markup.button.callback('📅 Change Date', 'review_date'),
        Markup.button.callback('✏️ Change Name', 'review_name'),
      ]);

      buttons.push([
        Markup.button.callback('💲 Change Amount', 'review_amount'),
        groupButton,
      ]);

      buttons.push([Markup.button.callback('❌ Reject', 'review_reject')]);

      const keyboard = Markup.inlineKeyboard(buttons);

      await ctx.editMessageText(
        `<b>Transaction ID: ${transaction.id}</b>\n\n` +
        message +
        '\n\n💬 <i>Type a description or use the buttons below:</i>',
        {
          parse_mode: 'HTML',
          ...keyboard,
        },
      );
    } catch (error) {
      await ctx.answerCbQuery('Error undoing rejection');
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

  @Action('review_date')
  @UseGuards(TelegramAuthGuard)
  async handleDateChange(@Ctx() ctx: SessionContext) {
    try {
      const transactionId = ctx.session.currentTransactionId;

      if (!transactionId) {
        await ctx.answerCbQuery('No active transaction');
        return;
      }

      ctx.session.waitingForDateChange = true;
      ctx.session.waitingForDescription = false;

      await ctx.answerCbQuery();
      await ctx.reply(
        '📅 <b>Enter new date/time</b>\n\n' +
        'You can use natural language (e.g. "ayer 2pm", "Feb 10 3:30 PM", "hace 2 horas")',
        { parse_mode: 'HTML', reply_markup: { force_reply: true } }
      );
    } catch (error) {
      await ctx.answerCbQuery('Error');
    }
  }

  @Action('review_amount')
  @UseGuards(TelegramAuthGuard)
  async handleAmountChange(@Ctx() ctx: SessionContext) {
    try {
      const transactionId = ctx.session.currentTransactionId;

      if (!transactionId) {
        await ctx.answerCbQuery('No active transaction');
        return;
      }

      ctx.session.waitingForAmountChange = true;
      ctx.session.waitingForDescription = false;

      await ctx.answerCbQuery();
      await ctx.reply(
        '💲 <b>Enter new amount</b>',
        { parse_mode: 'HTML', reply_markup: { force_reply: true } }
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

      // If single item review, end the flow. Otherwise show next
      if (ctx.session.reviewSingleItem) {
        this.baseHandler.clearSession(ctx);
      } else {
        await this.showNextTransaction(ctx);
      }
    } catch (error) {
      await ctx.answerCbQuery('Error');
    }
  }

  @Action('review_mark_reviewed')
  @UseGuards(TelegramAuthGuard)
  async handleMarkReviewed(@Ctx() ctx: SessionContext) {
    try {
      const transactionId = ctx.session.currentTransactionId;

      if (!transactionId) {
        await ctx.answerCbQuery('No active transaction');
        return;
      }

      // Mark transaction as REVIEWED without requiring description
      await this.transactionsService.update(transactionId, {
        status: TransactionStatus.REVIEWED,
      });

      await ctx.answerCbQuery('Marked as reviewed');
      await ctx.reply('✅ Marked as reviewed');

      // If single item review, end the flow. Otherwise show next
      if (ctx.session.reviewSingleItem) {
        this.baseHandler.clearSession(ctx);
      } else {
        await this.showNextTransaction(ctx);
      }
    } catch (error) {
      await ctx.answerCbQuery('Error');
    }
  }

  @Action(/^notification_tx_name_(\d+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleNotificationName(@Ctx() ctx: SessionContext) {
    try {
      // Extract transaction ID from callback data
      if (!('data' in ctx.callbackQuery)) {
        await ctx.answerCbQuery('Invalid callback');
        return;
      }
      const match = ctx.callbackQuery.data.match(/^notification_tx_name_(\d+)$/);
      const transactionId = parseInt(match[1], 10);

      await ctx.answerCbQuery();

      // Verify transaction exists
      const transaction = await this.transactionsService.findOne(transactionId);
      if (!transaction) {
        await ctx.editMessageText('❌ Transaction not found', { parse_mode: 'HTML' });
        return;
      }

      // Set session state for text input
      ctx.session.currentTransactionId = transactionId;
      ctx.session.notificationTransactionId = transactionId;
      ctx.session.waitingForDescription = true;
      ctx.session.reviewSingleItem = true; // Important: close session after

      // Edit the notification message to show we're waiting for input
      const currentText = 'message' in ctx.callbackQuery && 'text' in ctx.callbackQuery.message
        ? ctx.callbackQuery.message.text
        : '';
      await ctx.editMessageText(
        currentText + '\n\n✏️ <i>Type a description for this transaction:</i>',
        { parse_mode: 'HTML' },
      );
    } catch (error) {
      this.logger.error(`Error handling notification name: ${error.message}`);
      await ctx.answerCbQuery('Error');
    }
  }

  @Action(/^notification_tx_reject_(\d+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleNotificationReject(@Ctx() ctx: SessionContext) {
    try {
      // Extract transaction ID from callback data
      if (!('data' in ctx.callbackQuery)) {
        await ctx.answerCbQuery('Invalid callback');
        return;
      }
      const match = ctx.callbackQuery.data.match(/^notification_tx_reject_(\d+)$/);
      const transactionId = parseInt(match[1], 10);

      await ctx.answerCbQuery('Rejecting transaction...');

      // Verify transaction exists
      const transaction = await this.transactionsService.findOne(transactionId);
      if (!transaction) {
        await ctx.editMessageText('❌ Transaction not found', { parse_mode: 'HTML' });
        return;
      }

      // Update status to REJECTED
      await this.transactionsService.update(transactionId, {
        status: TransactionStatus.REJECTED,
      });

      // Edit the notification message to show rejection
      const currentText = 'message' in ctx.callbackQuery && 'text' in ctx.callbackQuery.message
        ? ctx.callbackQuery.message.text
        : '';
      await ctx.editMessageText(
        currentText + '\n\n❌ <b>Rejected</b>',
        { parse_mode: 'HTML' },
      );

      // Clear session (single item, no continuation)
      this.baseHandler.clearSession(ctx);
    } catch (error) {
      this.logger.error(`Error handling notification reject: ${error.message}`);
      await ctx.answerCbQuery('Error');
    }
  }

  @Action('transactions_show_all')
  @UseGuards(TelegramAuthGuard)
  async handleTransactionsShowAll(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      const message = await this.telegramService.transactions.getRecentTransactionsList(true);
      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (error) {
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error getting all transactions.');
    }
  }

  @Action('group_transaction')
  @UseGuards(TelegramAuthGuard)
  async handleGroupTransaction(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();

      const currentTxId = ctx.session.currentTransactionId;

      if (!currentTxId) {
        await ctx.reply('⚠️ No active transaction to group.');
        return;
      }

      // Get NEW and REVIEWED transactions, exclude current, exclude already grouped
      const transactions = await this.transactionsService.findAll({});
      const available = transactions.filter(t =>
        (t.status === 'NEW' || t.status === 'REVIEWED') &&
        t.id !== currentTxId &&
        t.groupId === null
      );

      // Get existing groups to append to
      const existingGroups = await this.transactionGroupsService.findGroupsForRegistration();

      if (available.length === 0 && existingGroups.length === 0) {
        await ctx.reply('No other transactions or groups available for grouping.');
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
          Markup.button.callback(buttonText, `group_add_to_${group.id}`)
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
          Markup.button.callback(buttonText, `group_select_${tx.id}`)
        ]);
      }

      buttons.push([Markup.button.callback('❌ Cancel', 'group_cancel')]);

      await ctx.reply('<b>Select transaction or group:</b>', {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      this.logger.error(`Error handling group transaction: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error loading transactions for grouping.');
    }
  }

  @Action(/^group_add_to_(\d+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleGroupAddTo(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();

      if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
        return;
      }

      const match = ctx.callbackQuery.data.match(/^group_add_to_(\d+)$/);
      if (!match) {
        return;
      }

      const groupId = parseInt(match[1]);
      const txId = ctx.session.currentTransactionId;

      if (!txId) {
        await ctx.reply('⚠️ No active transaction.');
        return;
      }

      // Add transaction to the existing group
      await this.transactionGroupsService.addTransactionToGroup(txId, groupId);

      const group = await this.transactionGroupsService.findOne(groupId);
      const count = await this.transactionGroupsService.getGroupMemberCount(groupId);

      // Mark current transaction as REVIEWED since it's been grouped
      await this.transactionsService.update(txId, {
        status: TransactionStatus.REVIEWED,
      });

      await ctx.reply(
        `✅ Transaction added to group: "${group.description}"\n` +
        `Group now contains ${count} transactions.`
      );

      // Continue review
      if (ctx.session.reviewSingleItem) {
        this.baseHandler.clearSession(ctx);
      } else {
        await this.showNextTransaction(ctx);
      }
    } catch (error) {
      this.logger.error(`Error adding to group: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error adding transaction to group.');
    }
  }

  @Action(/^group_select_(\d+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleGroupSelect(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();

      if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
        return;
      }

      const match = ctx.callbackQuery.data.match(/^group_select_(\d+)$/);
      if (!match) {
        return;
      }

      const tx1Id = parseInt(match[1]); // Selected from list
      const tx2Id = ctx.session.currentTransactionId; // Current transaction

      if (!tx2Id) {
        await ctx.reply('⚠️ No active transaction.');
        return;
      }

      const [tx1, tx2] = await Promise.all([
        this.transactionsService.findOne(tx1Id),
        this.transactionsService.findOne(tx2Id),
      ]);

      if (!tx1 || !tx2) {
        await ctx.reply('❌ Transaction not found.');
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

        // Mark current transaction as REVIEWED since it's been grouped
        await this.transactionsService.update(tx2Id, {
          status: TransactionStatus.REVIEWED,
        });

        await ctx.reply(
          `✅ Transaction added to group: "${group.description}"\n` +
          `Group now contains ${count} transactions.`
        );

        // Continue review
        if (ctx.session.reviewSingleItem) {
          this.baseHandler.clearSession(ctx);
        } else {
          await this.showNextTransaction(ctx);
        }
        return;
      }

      // Scenario 3: tx2 already HAS group - error
      if (tx2.groupId) {
        const group = await this.transactionGroupsService.findOne(tx2.groupId);
        await ctx.reply(
          `⚠️ Current transaction is already in group: "${group.description}"\n` +
          `Please ungroup it first.`
        );
      }
    } catch (error) {
      this.logger.error(`Error handling group select: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error processing group selection.');
    }
  }

  @Action('group_cancel')
  @UseGuards(TelegramAuthGuard)
  async handleGroupCancel(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Cancelled');
      await ctx.reply('❌ Grouping cancelled.');

      // Continue review
      if (ctx.session.reviewSingleItem) {
        this.baseHandler.clearSession(ctx);
      } else {
        await this.showNextTransaction(ctx);
      }
    } catch (error) {
      this.logger.error(`Error handling group cancel: ${error.message}`);
    }
  }

  @Action('ungroup_transaction')
  @UseGuards(TelegramAuthGuard)
  async handleUngroupTransaction(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();

      const txId = ctx.session.currentTransactionId;

      if (!txId) {
        await ctx.reply('⚠️ No active transaction.');
        return;
      }

      const transaction = await this.transactionsService.findOne(txId);

      if (!transaction?.groupId) {
        await ctx.reply('Transaction is not in a group.');
        return;
      }

      const group = await this.transactionGroupsService.findOne(transaction.groupId);
      const memberCount = await this.transactionGroupsService.getGroupMemberCount(transaction.groupId);

      // Remove from group
      await this.transactionGroupsService.removeTransactionFromGroup(txId);

      let message = `✅ Transaction removed from group: "${group.description}"`;

      // If group now has only 1 member, delete the group
      if (memberCount === 2) {
        await this.transactionGroupsService.delete(group.id);
        message += '\n\n⚠️ Group deleted (only 1 transaction remaining).';
      } else {
        message += `\n\nGroup now has ${memberCount - 1} transactions.`;
      }

      await ctx.reply(message);

      // Continue review
      if (ctx.session.reviewSingleItem) {
        this.baseHandler.clearSession(ctx);
      } else {
        await this.showNextTransaction(ctx);
      }
    } catch (error) {
      this.logger.error(`Error ungrouping transaction: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error ungrouping transaction.');
    }
  }

  @On('text')
  async handleText(@Ctx() ctx: SessionContext) {
    // Type guard for text messages
    if (!('text' in ctx.message)) {
      return;
    }

    // Pago Móvil flow - delegate to pago móvil handler
    if (ctx.session.pagoMovilWaiting) {
      await this.pagoMovilUpdate.handleTextInput(ctx);
      return;
    }

    // /group flow - description input
    if (ctx.session.groupFlowWaitingForDescription) {
      await this.groupFlowUpdate.handleDescriptionInput(ctx);
      return;
    }

    // Convert flow - delegate to convert handler
    if (ctx.session.convertWaitingForInput) {
      await this.convertUpdate.handleConvertInput(ctx);
      return;
    }

    // Settings flow - delegate to settings handler
    if (ctx.session.settingsWaitingForSheetId) {
      await this.settingsUpdate.handleSheetIdInput(ctx);
      return;
    }

    // Transfer flow - delegate to transfer handler
    if (ctx.session.transferState) {
      await this.transferUpdate.handleTextInput(ctx);
      return;
    }

    // Banesco balance update flow - delegate to accounts handler
    if (ctx.session.waitingForBanescoAmount) {
      await this.accountsUpdate.handleBanescoAmountInput(ctx);
      return;
    }

    // Manual transaction flow is handled by TelegramManualTransactionUpdate
    if (ctx.session.manualTransactionState === 'waiting_amount' ||
      ctx.session.manualTransactionState === 'waiting_description' ||
      ctx.session.manualTransactionState === 'waiting_custom_date') {
      await this.manualTransactionUpdate.handleManualAmountOrDescription(ctx);
      return;
    }

    // Handle search for transaction flow
    if (ctx.session.reviewOneMode === 'waiting_for_tx_search') {
      await this.handleTransactionSearch(ctx);
      return;
    }

    // Handle review by ID for exchange flow
    if (ctx.session.reviewOneMode === 'waiting_for_ex_id') {
      await this.exchangesUpdate.handleReviewOneExchangeId(ctx);
      return;
    }

    // Handle group description input
    if (ctx.session.waitingForGroupDescription) {
      try {
        const description = ctx.message.text;
        const tx1Id = ctx.session.pendingGroupTransactionId;
        const tx2Id = ctx.session.currentTransactionId;

        if (!tx1Id || !tx2Id) {
          await ctx.reply('⚠️ Session error. Please try again.');
          ctx.session.waitingForGroupDescription = false;
          ctx.session.pendingGroupTransactionId = undefined;
          return;
        }

        // Create group with both transactions
        await this.transactionGroupsService.createGroupWithTransactions(
          description,
          [tx1Id, tx2Id]
        );

        // Mark current transaction as REVIEWED since it's been grouped
        await this.transactionsService.update(tx2Id, {
          status: TransactionStatus.REVIEWED,
        });

        await ctx.reply(
          `✅ Group created: "${description}"\n` +
          `Transactions ${tx1Id} and ${tx2Id} are now grouped.`
        );

        // Clear flags and continue
        ctx.session.waitingForGroupDescription = false;
        ctx.session.pendingGroupTransactionId = undefined;

        if (ctx.session.reviewSingleItem) {
          this.baseHandler.clearSession(ctx);
        } else {
          await this.showNextTransaction(ctx);
        }
        return;
      } catch (error) {
        this.logger.error(`Error creating group: ${error.message}`);
        await ctx.reply('Error creating group. Please try again.');
        ctx.session.waitingForGroupDescription = false;
        ctx.session.pendingGroupTransactionId = undefined;
        return;
      }
    }

    // Handle date change input
    if (ctx.session.waitingForDateChange && ctx.session.currentTransactionId) {
      try {
        const input = ctx.message.text.trim();
        const parsedDate = this.dateParser.parseVenezuelaDate(input);

        if (!parsedDate) {
          await ctx.reply('❌ Invalid date format. Please try again.');
          return;
        }

        await this.transactionsService.update(ctx.session.currentTransactionId, {
          date: parsedDate,
        });

        const formatted = parsedDate.toLocaleString('en-US', {
          timeZone: 'America/Caracas',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        await ctx.reply(`✅ Date updated to: ${formatted}`);
        ctx.session.waitingForDateChange = false;
        ctx.session.waitingForDescription = true;
        return;
      } catch (error) {
        this.logger.error(`Error updating date: ${error.message}`);
        await ctx.reply('Error updating date. Please try again.');
        ctx.session.waitingForDateChange = false;
        return;
      }
    }

    // Handle amount change input
    if (ctx.session.waitingForAmountChange && ctx.session.currentTransactionId) {
      try {
        const input = ctx.message.text.trim();
        const amount = parseFloat(input.replace(/,/g, ''));

        if (isNaN(amount) || amount <= 0) {
          await ctx.reply('❌ Invalid amount. Please enter a positive number.');
          return;
        }

        await this.transactionsService.update(ctx.session.currentTransactionId, {
          amount,
        });

        const transaction = await this.transactionsService.findOne(ctx.session.currentTransactionId);
        await ctx.reply(`✅ Amount updated to: ${transaction.currency} ${amount.toFixed(2)}`);
        ctx.session.waitingForAmountChange = false;
        ctx.session.waitingForDescription = true;
        return;
      } catch (error) {
        this.logger.error(`Error updating amount: ${error.message}`);
        await ctx.reply('Error updating amount. Please try again.');
        ctx.session.waitingForAmountChange = false;
        return;
      }
    }

    // Only process if we're waiting for a description
    if (!ctx.session.waitingForDescription || !ctx.session.currentTransactionId) {
      return;
    }

    try {
      const transactionId = ctx.session.currentTransactionId;
      const description = ctx.message.text;

      // Update transaction with description and mark as REVIEWED
      const updated = await this.transactionsService.update(transactionId, {
        description,
        status: TransactionStatus.REVIEWED,
      });

      // Try sheet cell update first (exact matches like "Neyda" need priority over LLM)
      try {
        const sheetResult = await this.sheetUpdateService.trySheetUpdate(updated);
        if (sheetResult) {
          await this.transactionsService.update(transactionId, {
            status: TransactionStatus.REGISTERED,
          });

          await ctx.reply(
            `✅ <b>Transaction Auto-Registered!</b>\n\n` +
            `<b>${description}</b>\n` +
            `Status: Registered`,
            { parse_mode: 'HTML' },
          );

          ctx.session.waitingForDescription = false;
          this.baseHandler.clearSession(ctx);
          return;
        }
      } catch (error) {
        this.logger.error(`Sheet update error: ${error.message}`);
        await ctx.reply(`⚠️ <b>${description}</b>\n\n${error.message}`, { parse_mode: 'HTML' });
      }

      // Try auto-registration for known transaction types (journal entry creation)
      const autoResult = await this.autoRegistrationService.tryAutoRegister(updated);
      if (autoResult) {
        await this.transactionsService.update(transactionId, {
          status: TransactionStatus.REGISTERED,
        });

        await ctx.reply(
          `✅ <b>Transaction Auto-Registered!</b>\n\n` +
          `<b>${description}</b>\n` +
          `Journal: ${autoResult.debitAccount} / ${autoResult.creditAccount}\n` +
          `Category: ${autoResult.rule.category} / ${autoResult.rule.subcategory}\n` +
          `Status: Registered`,
          { parse_mode: 'HTML' },
        );

        ctx.session.waitingForDescription = false;
        this.baseHandler.clearSession(ctx);
        return;
      }

      await ctx.reply(`✅ Description saved: "${description}"`);

      // Reset session flags
      ctx.session.waitingForDescription = false;

      // If single item review, end the flow. Otherwise show next
      if (ctx.session.reviewSingleItem) {
        this.baseHandler.clearSession(ctx);
      } else {
        await this.showNextTransaction(ctx);
      }
    } catch (error) {
      this.logger.error(`Error saving description: ${error.message}`);
      await ctx.reply('Error saving description. Please try again.');
    }
  }

  @Action(/^view_bill_(\d+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleViewBill(@Ctx() ctx: SessionContext) {
    try {
      if (!('data' in ctx.callbackQuery)) {
        await ctx.answerCbQuery('Invalid callback');
        return;
      }

      const match = ctx.callbackQuery.data.match(/^view_bill_(\d+)$/);
      const transactionId = parseInt(match[1], 10);
      await ctx.answerCbQuery();

      const transaction = await this.transactionsService.findOne(transactionId);
      if (!transaction?.imageUrl) {
        await ctx.reply('No bill image found for this transaction.');
        return;
      }

      // Delete previous bill photo if exists
      await this.deleteBillMessage(ctx);

      const signedUrl = await this.b2Storage.getSignedUrl(transaction.imageUrl);
      const sentMsg = await ctx.replyWithPhoto({ url: signedUrl });
      ctx.session.registerBillMessageId = sentMsg.message_id;
    } catch (error) {
      this.logger.error(`Error viewing bill: ${error.message}`);
      await ctx.reply('Error loading bill image.');
    }
  }


  async deleteBillMessage(ctx: SessionContext): Promise<void> {
    const messageId = ctx.session.registerBillMessageId;
    if (!messageId) return;

    try {
      const chatId = ctx.callbackQuery?.message?.chat?.id ?? (ctx.message as any)?.chat?.id;
      if (chatId) {
        await ctx.telegram.deleteMessage(chatId, messageId);
      }
    } catch (e) {
      // Message may already be deleted
    }
    ctx.session.registerBillMessageId = undefined;
  }

  private async showNextTransaction(ctx: SessionContext) {
    try {
      const transaction = await this.telegramService.transactions.getNextForReview();

      if (!transaction) {
        await ctx.reply('✅ No more transactions to review!');
        this.baseHandler.clearSession(ctx);
        return;
      }

      // Store previous transaction ID in history before moving to next
      if (ctx.session.currentTransactionId) {
        this.baseHandler.addToReviewHistory(ctx, 'transactions', ctx.session.currentTransactionId);
      }

      // Increment progress index
      this.baseHandler.incrementReviewIndex(ctx);

      // Store current transaction in session and wait for description by default
      ctx.session.currentTransactionId = transaction.id;
      ctx.session.waitingForDescription = true;

      const message = await this.telegramService.transactions.formatTransactionForReview(transaction);

      // Build title with progress
      const progressText = this.baseHandler.buildProgressText(
        ctx.session.reviewCurrentIndex,
        ctx.session.reviewTotalCount
      );
      const titleWithProgress = message.replace(
        '<b>Transaction Review</b>',
        `<b>Transaction Review${progressText}</b>`
      );

      // Check if transaction has a group
      const fullTransaction = await this.transactionsService.findOne(transaction.id);
      const hasGroup = fullTransaction?.groupId !== null;

      // Add "Go Back" button if there's history
      const hasHistory = this.baseHandler.hasReviewHistory(ctx, 'transactions');

      const groupButton = hasGroup
        ? Markup.button.callback('🔗 Ungroup', 'ungroup_transaction')
        : Markup.button.callback('📎 Group', 'group_transaction');

      const buttons = [];

      if (fullTransaction?.imageUrl) {
        buttons.push([Markup.button.callback('🧾 View Bill', `view_bill_${transaction.id}`)]);
      }

      buttons.push([
        Markup.button.callback('📅 Change Date', 'review_date'),
        Markup.button.callback('✏️ Change Name', 'review_name'),
      ]);

      buttons.push([
        Markup.button.callback('💲 Change Amount', 'review_amount'),
        groupButton,
      ]);

      buttons.push([
        Markup.button.callback('⏭️ Skip', 'review_skip'),
        Markup.button.callback('❌ Reject', 'review_reject'),
        Markup.button.callback('✅ Mark Reviewed', 'review_mark_reviewed'),
      ]);

      if (hasHistory) {
        buttons.push([
          Markup.button.callback('⬅️ Go Back', 'review_go_back'),
        ]);
      }

      // Only show Stop button when reviewing multiple items (not in review_one mode)
      if (!ctx.session.reviewSingleItem) {
        buttons.push([
          Markup.button.callback('🚫 Stop', 'review_cancel'),
        ]);
      }

      const keyboard = Markup.inlineKeyboard(buttons);

      await ctx.reply(
        titleWithProgress + '\n\n💬 <i>Type a description or use the buttons below:</i>',
        {
          parse_mode: 'HTML',
          ...keyboard,
        }
      );
    } catch (error) {
      this.logger.error(`Error showing next transaction: ${error.message}`);
      await ctx.reply('Error loading transaction.');
    }
  }

  @Action(/^search_tx_(\d+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleSearchSelectTransaction(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();

      if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

      const match = ctx.callbackQuery.data.match(/^search_tx_(\d+)$/);
      if (!match) return;

      const transactionId = parseInt(match[1], 10);
      const transaction = await this.transactionsService.findOne(transactionId);

      if (!transaction) {
        await ctx.reply('❌ Transaction not found.');
        return;
      }

      await this.showTransactionForReviewOne(ctx, transaction);
    } catch (error) {
      this.logger.error(`Error selecting search result: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('❌ Error loading transaction.');
    }
  }

  @Action('search_tx_cancel')
  @UseGuards(TelegramAuthGuard)
  async handleSearchCancel(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Cancelled');
      this.baseHandler.clearSession(ctx);
      await ctx.reply('🚫 Search cancelled.');
    } catch (error) {
      await ctx.answerCbQuery('Error');
    }
  }

  private async handleTransactionSearch(ctx: SessionContext) {
    if (!('text' in ctx.message)) return;

    try {
      const searchText = ctx.message.text.trim();

      await ctx.reply('🔍 Searching...');

      // Parse search query with LLM
      const criteria = await this.transactionSearchService.parseSearchQuery(searchText);

      // Only search NEW and REVIEWED transactions for /review_one
      criteria.statusIn = [TransactionStatus.NEW, TransactionStatus.REVIEWED];

      // Search transactions
      const results = await this.transactionsService.searchTransactions(criteria);

      if (results.length === 0) {
        await ctx.reply('❌ No transactions found. Try a different search.');
        return;
      }

      if (results.length === 1) {
        // Single result - go directly to review
        await this.showTransactionForReviewOne(ctx, results[0]);
        return;
      }

      // Multiple results - show buttons
      const buttons = results.map(tx => {
        const amount = Number(tx.amount).toFixed(2);
        const desc = tx.description || 'No description';
        const maxLen = 40;
        const truncated = desc.length > maxLen ? desc.substring(0, maxLen) + '...' : desc;
        return [Markup.button.callback(`${truncated} - ${amount} ${tx.currency}`, `search_tx_${tx.id}`)];
      });

      buttons.push([Markup.button.callback('❌ Cancel', 'search_tx_cancel')]);

      await ctx.reply(
        `🔍 Found ${results.length} transaction(s):`,
        { ...Markup.inlineKeyboard(buttons) },
      );
    } catch (error) {
      this.logger.error(`Error searching transactions: ${error.message}`);
      await ctx.reply('❌ Error searching. Please try again.');
    }
  }

  private async showTransactionForReviewOne(ctx: SessionContext, transaction: Transaction) {
    ctx.session.reviewOneMode = undefined;
    ctx.session.reviewOneType = undefined;
    ctx.session.reviewType = 'transactions';
    ctx.session.reviewSingleItem = true;
    ctx.session.currentTransactionId = transaction.id;
    ctx.session.waitingForDescription = true;

    const message = await this.telegramService.transactions.formatTransactionForReview(transaction);

    const hasGroup = transaction.groupId !== null;
    const groupButton = hasGroup
      ? Markup.button.callback('🔗 Ungroup', 'ungroup_transaction')
      : Markup.button.callback('📎 Group', 'group_transaction');

    const buttons = [];

    if (transaction.imageUrl) {
      buttons.push([Markup.button.callback('🧾 View Bill', `view_bill_${transaction.id}`)]);
    }

    buttons.push([
      Markup.button.callback('📅 Change Date', 'review_date'),
      Markup.button.callback('✏️ Change Name', 'review_name'),
    ]);

    buttons.push([
      Markup.button.callback('💲 Change Amount', 'review_amount'),
      groupButton,
    ]);

    buttons.push([Markup.button.callback('❌ Reject', 'review_reject')]);

    const keyboard = Markup.inlineKeyboard(buttons);

    await ctx.reply(
      `<b>Transaction ID: ${transaction.id}</b>\n\n` +
      message +
      '\n\n💬 <i>Type a description or use the buttons below:</i>',
      {
        parse_mode: 'HTML',
        ...keyboard,
      },
    );
  }

  public async showPreviousTransactionPublic(ctx: SessionContext) {
    try {
      const previousId = this.baseHandler.popFromReviewHistory(ctx, 'transactions');

      if (previousId === null) {
        await ctx.reply('⚠️ No previous transaction to go back to.');
        return;
      }

      // Decrement progress index
      this.baseHandler.decrementReviewIndex(ctx);

      // Fetch the transaction
      const transaction = await this.transactionsService.findOne(previousId);

      if (!transaction) {
        await ctx.reply('❌ Previous transaction not found.');
        return;
      }

      // Update current transaction ID
      ctx.session.currentTransactionId = transaction.id;
      ctx.session.waitingForDescription = true;

      const message = await this.telegramService.transactions.formatTransactionForReview(transaction);

      // Build title with progress
      const progressText = this.baseHandler.buildProgressText(
        ctx.session.reviewCurrentIndex,
        ctx.session.reviewTotalCount
      );
      const titleWithProgress = message.replace(
        '<b>Transaction Review</b>',
        `<b>Transaction Review${progressText}</b>`
      );

      // Check if transaction has a group
      const hasGroup = transaction.groupId !== null;
      const groupButton = hasGroup
        ? Markup.button.callback('🔗 Ungroup', 'ungroup_transaction')
        : Markup.button.callback('📎 Group', 'group_transaction');

      // Check if there's still more history
      const hasHistory = this.baseHandler.hasReviewHistory(ctx, 'transactions');

      const buttons = [];

      if (transaction.imageUrl) {
        buttons.push([Markup.button.callback('🧾 View Bill', `view_bill_${transaction.id}`)]);
      }

      buttons.push([
        Markup.button.callback('📅 Change Date', 'review_date'),
        Markup.button.callback('✏️ Change Name', 'review_name'),
      ]);

      buttons.push([
        Markup.button.callback('💲 Change Amount', 'review_amount'),
        groupButton,
      ]);

      buttons.push([
        Markup.button.callback('⏭️ Skip', 'review_skip'),
        Markup.button.callback('❌ Reject', 'review_reject'),
        Markup.button.callback('✅ Mark Reviewed', 'review_mark_reviewed'),
      ]);

      if (hasHistory) {
        buttons.push([
          Markup.button.callback('⬅️ Go Back', 'review_go_back'),
        ]);
      }

      // Only show Stop button when reviewing multiple items (not in review_one mode)
      if (!ctx.session.reviewSingleItem) {
        buttons.push([
          Markup.button.callback('🚫 Stop', 'review_cancel'),
        ]);
      }

      const keyboard = Markup.inlineKeyboard(buttons);

      await ctx.reply(
        titleWithProgress +
        '\n\n💬 <i>Type a description or use the buttons below:</i>',
        {
          parse_mode: 'HTML',
          ...keyboard,
        }
      );
    } catch (error) {
      this.logger.error(`Error showing previous transaction: ${error.message}`);
      await ctx.reply('Error loading previous transaction.');
    }
  }

  async startTransactionReview(ctx: SessionContext) {
    await this.showNextTransaction(ctx);
  }

}
