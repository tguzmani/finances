import { Update, Ctx, Command, Action, On } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { Transaction, TransactionGroup } from '@prisma/client';
import { TelegramService } from '../telegram.service';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { SessionContext } from '../telegram.types';
import { TransactionsService } from '../../transactions/transactions.service';
import { TransactionStatus, TransactionType, TransactionPlatform, PaymentMethod } from '../../transactions/transaction.types';
import { TransactionOcrParser } from '../../transactions/ocr/parsers/transaction-ocr-parser';
import { TransactionSearchService } from '../../transactions/transaction-search.service';
import { TelegramBaseHandler } from '../telegram-base.handler';
import { TelegramExchangesUpdate } from '../exchanges/telegram-exchanges.update';
import { TelegramManualTransactionUpdate } from './telegram-manual-transaction.update';
import { TelegramAccountsUpdate } from '../accounts/telegram-accounts.update';
import { TransactionGroupsService } from '../../transaction-groups/transaction-groups.service';
import { TransactionGroupStatus } from '../../transaction-groups/transaction-group.types';
import { TelegramGroupsPresenter } from './telegram-groups.presenter';
import { TelegramGroupFlowUpdate } from './telegram-group-flow.update';
import { DateParserService } from '../../common/date-parser.service';
import axios from 'axios';
import * as https from 'https';

@Update()
export class TelegramTransactionsUpdate {
  private readonly logger = new Logger(TelegramTransactionsUpdate.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly transactionsService: TransactionsService,
    private readonly transactionOcrParser: TransactionOcrParser,
    private readonly transactionSearchService: TransactionSearchService,
    private readonly baseHandler: TelegramBaseHandler,
    private readonly exchangesUpdate: TelegramExchangesUpdate,
    private readonly manualTransactionUpdate: TelegramManualTransactionUpdate,
    private readonly accountsUpdate: TelegramAccountsUpdate,
    private readonly transactionGroupsService: TransactionGroupsService,
    private readonly groupsPresenter: TelegramGroupsPresenter,
    private readonly groupFlowUpdate: TelegramGroupFlowUpdate,
    private readonly dateParser: DateParserService,
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
      await ctx.reply(`❌ Transaction rejected${ungroupedMessage}`);

      // If single item review, end the flow. Otherwise show next
      if (ctx.session.reviewSingleItem) {
        this.baseHandler.clearSession(ctx);
      } else {
        await this.showNextTransaction(ctx);
      }
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
        await ctx.reply('❌ Transaction not found');
        return;
      }

      // Set session state for text input
      ctx.session.currentTransactionId = transactionId;
      ctx.session.waitingForDescription = true;
      ctx.session.reviewSingleItem = true; // Important: close session after

      // Ask for description
      await ctx.reply(
        '✏️ Please type a description for this transaction:',
        { reply_markup: { force_reply: true } }
      );
    } catch (error) {
      this.logger.error(`Error handling notification name: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('❌ Error processing action');
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
        await ctx.reply('❌ Transaction not found');
        return;
      }

      // Update status to REJECTED
      await this.transactionsService.update(transactionId, {
        status: TransactionStatus.REJECTED,
      });

      await ctx.reply('❌ Transaction rejected');

      // Clear session (single item, no continuation)
      this.baseHandler.clearSession(ctx);
    } catch (error) {
      this.logger.error(`Error handling notification reject: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('❌ Error processing action');
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

  @Action('register_start_transactions')
  @UseGuards(TelegramAuthGuard)
  async handleRegisterStartTransactions(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();

      // Check if there are NEW transactions pending review
      const hasNew = await this.telegramService.transactions.hasNewTransactions();

      if (hasNew) {
        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Yes', 'register_tx_review_new'),
            Markup.button.callback('❌ No', 'register_tx_continue'),
          ],
        ]);

        await ctx.reply(
          'There are still new transactions to be reviewed. Review them first?',
          keyboard
        );
        return;
      }

      // No NEW transactions, proceed with registration
      await this.startTransactionRegistration(ctx);
    } catch (error) {
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error starting transaction registration.');
    }
  }

  @Action('register_tx_review_new')
  @UseGuards(TelegramAuthGuard)
  async handleRegisterTxReviewNew(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      ctx.session.reviewType = 'transactions';
      await this.showNextTransaction(ctx);
    } catch (error) {
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error starting review.');
    }
  }

  @Action('register_tx_continue')
  @UseGuards(TelegramAuthGuard)
  async handleRegisterTxContinue(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      await this.startTransactionRegistration(ctx);
    } catch (error) {
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error starting registration.');
    }
  }

  @Action('register_tx_confirm')
  @UseGuards(TelegramAuthGuard)
  async handleRegisterTxConfirm(@Ctx() ctx: SessionContext) {
    try {
      const transactionIds = ctx.session.registerTransactionIds || [];
      const groupIds = ctx.session.registerTransactionGroupIds || [];

      if (transactionIds.length === 0 && groupIds.length === 0) {
        await ctx.answerCbQuery('Session expired. Please run /register again.');
        return;
      }

      await ctx.answerCbQuery('Registering...');

      // Register singles
      if (transactionIds.length > 0) {
        await this.telegramService.transactions.registerTransactions(transactionIds);
      }

      // Register groups (NEW → REGISTERED) and their transactions
      if (groupIds.length > 0) {
        for (const groupId of groupIds) {
          await this.transactionGroupsService.update(groupId, { status: TransactionGroupStatus.REGISTERED });
          const group = await this.transactionGroupsService.findOneWithTransactions(groupId);
          for (const tx of group.transactions) {
            await this.transactionsService.update(tx.id, {
              status: TransactionStatus.REGISTERED,
            });
          }
        }
      }

      // Store IDs in session for undo
      ctx.session.lastRegisteredTransactionIds = transactionIds;
      ctx.session.lastRegisteredGroupIds = groupIds;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('↩️ Undo', 'register_tx_undo')],
      ]);

      await ctx.reply(
        `✅ <b>Registration Complete!</b>\n\n` +
        `Registered:\n` +
        `- ${transactionIds.length} transaction(s)\n` +
        `- ${groupIds.length} group(s)`,
        { parse_mode: 'HTML', ...keyboard }
      );

      // Don't clear session yet - keep it for undo
      // this.baseHandler.clearSession(ctx);
    } catch (error) {
      this.logger.error(`Error confirming transaction registration: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error completing registration. Please try again.');
    }
  }

  @Action('register_tx_undo')
  @UseGuards(TelegramAuthGuard)
  async handleRegisterTxUndo(@Ctx() ctx: SessionContext) {
    try {
      const transactionIds = ctx.session.lastRegisteredTransactionIds || [];
      const groupIds = ctx.session.lastRegisteredGroupIds || [];

      if (transactionIds.length === 0 && groupIds.length === 0) {
        await ctx.answerCbQuery('Nothing to undo.');
        return;
      }

      await ctx.answerCbQuery('Undoing registration...');

      // Revert transactions back to REVIEWED status
      if (transactionIds.length > 0) {
        await Promise.all(
          transactionIds.map(id =>
            this.transactionsService.update(id, {
              status: TransactionStatus.REVIEWED,
            })
          )
        );
      }

      // Revert groups back to NEW status and their transactions to REVIEWED
      if (groupIds.length > 0) {
        for (const groupId of groupIds) {
          await this.transactionGroupsService.update(groupId, { status: TransactionGroupStatus.NEW });
          const group = await this.transactionGroupsService.findOneWithTransactions(groupId);
          for (const tx of group.transactions) {
            await this.transactionsService.update(tx.id, {
              status: TransactionStatus.REVIEWED,
            });
          }
        }
      }

      await ctx.reply(
        `↩️ <b>Registration Undone!</b>\n\n` +
        `Reverted:\n` +
        `- ${transactionIds.length} transaction(s) to REVIEWED\n` +
        `- ${groupIds.length} group(s) to NEW`,
        { parse_mode: 'HTML' }
      );

      // Clear session
      this.baseHandler.clearSession(ctx);
    } catch (error) {
      this.logger.error(`Error undoing transaction registration: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error undoing registration. Please try again.');
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

    // /group flow - description input
    if (ctx.session.groupFlowWaitingForDescription) {
      await this.groupFlowUpdate.handleDescriptionInput(ctx);
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

    // Only process if we're waiting for a description
    if (!ctx.session.waitingForDescription || !ctx.session.currentTransactionId) {
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

  @On('photo')
  @UseGuards(TelegramAuthGuard)
  async handlePhoto(@Ctx() ctx: SessionContext) {
    // Type guard for photo messages
    if (!('photo' in ctx.message)) {
      return;
    }

    try {
      // Get highest resolution photo
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      this.logger.log(`Photo received: ${photo.file_id}`);

      // Extract caption if present
      const caption = 'caption' in ctx.message ? ctx.message.caption : undefined;
      if (caption) {
        this.logger.log(`Photo caption: ${caption}`);
      }

      await ctx.reply('📸 Processing image with OCR...');

      // Download and process image directly
      const imageBuffer = await this.downloadImage(photo.file_id, ctx);

      // Parse with unified OCR parser
      this.logger.log('Parsing transaction with Google Vision...');
      const transactionData = await this.transactionOcrParser.parseTransaction(imageBuffer, caption);

      this.logger.log(`Parsed transaction: ${JSON.stringify(transactionData)}`);

      const isDebugMode = process.env.DEBUG_OCR === 'true';

      // Handle based on payment method detected
      if (!transactionData.paymentMethod) {
        // Could not determine payment method
        await ctx.reply(
          '❌ Could not recognize this image as a transaction.\n\n' +
          'Supported formats:\n' +
          '• Pago Móvil screenshots\n' +
          '• Bank transfers\n' +
          '• Store receipts\n\n' +
          'Please try again with a clearer photo.'
        );
        return;
      }

      // Show OCR text if debug mode is enabled
      if (isDebugMode) {
        const ocrPreview = transactionData.ocrText.length > 4000
          ? transactionData.ocrText.substring(0, 4000) + '...'
          : transactionData.ocrText;

        await ctx.reply(
          `📝 <b>OCR Text (Debug)</b>\n\n` +
          `<code>${ocrPreview}</code>`,
          { parse_mode: 'HTML' }
        );
      }

      if (transactionData.paymentMethod === PaymentMethod.PAGO_MOVIL) {
        // Pago Móvil: Show preview
        await this.handlePagoMovilTransaction(ctx, transactionData, isDebugMode);
      } else {
        // Bill/Receipt/Transfer: Show preview with action buttons
        await this.handleBillTransaction(ctx, transactionData, isDebugMode);
      }

    } catch (error) {
      this.logger.error(`Photo handling failed: ${error?.message || 'Unknown error'}`);
      this.logger.error(error);
      await ctx.reply('❌ Error processing image. Please try again.');
    }
  }

  @Action('bill_save')
  @UseGuards(TelegramAuthGuard)
  async handleBillSave(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Saving transaction...');

      const billData = ctx.session.pendingBillData;
      if (!billData) {
        await ctx.reply('❌ Session expired. Please send the photo again.');
        return;
      }

      // Validate required fields
      if (!billData.datetime || !billData.amount) {
        await ctx.reply('❌ Cannot save transaction: Missing required data (date or amount).');
        return;
      }

      // Create transaction from bill data
      const transaction = await this.transactionsService.createManualTransaction({
        type: TransactionType.EXPENSE, // Bills are usually expenses
        platform: TransactionPlatform.BANESCO, // Default platform for bills
        currency: billData.currency,
        amount: billData.amount,
        description: billData.transactionId ? `Bill #${billData.transactionId}` : 'Bill purchase',
        method: PaymentMethod.DEBIT_CARD, // Default payment method
        date: billData.datetime,
      });

      await ctx.reply(
        `✅ <b>Transaction saved!</b>\n\n` +
        `Amount: ${billData.currency} ${billData.amount.toFixed(2)}\n` +
        `Date: ${billData.datetime.toLocaleString('es-VE', { timeZone: 'America/Caracas' })}\n` +
        `Transaction ID: ${billData.transactionId || 'N/A'}\n\n` +
        `<i>Status: Unreviewed</i>`,
        { parse_mode: 'HTML' }
      );

      // Ask if user wants to add/change description
      await ctx.reply(
        '📝 Do you want to add a description?',
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✏️ Add Description', callback_data: `add_desc_${transaction.id}` },
                { text: '⏭️ Skip', callback_data: 'add_desc_skip' },
              ],
            ],
          },
        }
      );

      // Clear session
      ctx.session.pendingBillData = undefined;

    } catch (error) {
      this.logger.error(`Bill save failed: ${error?.message || 'Unknown error'}`);
      this.logger.error(error);
      await ctx.reply('❌ Error saving transaction. Please try again.');
    }
  }

  @Action('bill_manual')
  @UseGuards(TelegramAuthGuard)
  async handleBillManual(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Starting manual entry...');

      // Clear bill data
      ctx.session.pendingBillData = undefined;

      // Delegate to manual transaction flow
      await this.manualTransactionUpdate.handleAddTransaction(ctx);

    } catch (error) {
      this.logger.error(`Bill manual entry failed: ${error?.message || 'Unknown error'}`);
      this.logger.error(error);
      await ctx.reply('❌ Error starting manual entry. Please try again.');
    }
  }

  @Action(/^add_desc_(\d+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleAddDescription(@Ctx() ctx: SessionContext) {
    try {
      if (!('data' in ctx.callbackQuery)) {
        await ctx.answerCbQuery('Invalid callback');
        return;
      }

      const match = ctx.callbackQuery.data.match(/^add_desc_(\d+)$/);
      const transactionId = parseInt(match[1], 10);

      await ctx.answerCbQuery();

      // Set session state for description input
      ctx.session.currentTransactionId = transactionId;
      ctx.session.waitingForDescription = true;
      ctx.session.reviewSingleItem = true; // End session after description

      await ctx.reply(
        '✏️ Please type a description for this transaction:',
        { reply_markup: { force_reply: true } }
      );
    } catch (error) {
      this.logger.error(`Error handling add description: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('❌ Error processing action');
    }
  }

  @Action('add_desc_skip')
  @UseGuards(TelegramAuthGuard)
  async handleAddDescriptionSkip(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Skipped');
      await ctx.reply('⏭️ Description skipped. Transaction saved without description.');
    } catch (error) {
      this.logger.error(`Error handling skip description: ${error.message}`);
      await ctx.answerCbQuery('Error');
    }
  }

  @Action('pago_movil_save')
  @UseGuards(TelegramAuthGuard)
  async handlePagoMovilSave(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Saving transaction...');

      const pagoMovilData = ctx.session.pendingBillData;
      if (!pagoMovilData) {
        await ctx.reply('❌ Session expired. Please send the photo again.');
        return;
      }

      // Validate required fields
      if (!pagoMovilData.datetime || !pagoMovilData.amount || !pagoMovilData.transactionId) {
        await ctx.reply('❌ Cannot save transaction: Missing required data.');
        return;
      }

      this.logger.log(`Creating Pago Móvil transaction: ${JSON.stringify(pagoMovilData)}`);

      // Create Pago Móvil transaction
      try {
        const transaction = await this.transactionsService.createFromPagoMovil({
          date: pagoMovilData.datetime,
          amount: pagoMovilData.amount,
          currency: pagoMovilData.currency,
          transactionId: pagoMovilData.transactionId,
        });

        await ctx.reply(
          `✅ <b>Pago Móvil Transaction Saved!</b>\n\n` +
          `Amount: ${pagoMovilData.currency} ${pagoMovilData.amount.toFixed(2)}\n` +
          `Reference: ${pagoMovilData.transactionId}\n` +
          `Date: ${pagoMovilData.datetime.toLocaleString('es-VE', { timeZone: 'America/Caracas' })}`,
          { parse_mode: 'HTML' }
        );

        // Ask if user wants to add description
        await ctx.reply(
          '📝 Do you want to add a description?',
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✏️ Add Description', callback_data: `add_desc_${transaction.id}` },
                  { text: '⏭️ Skip', callback_data: 'add_desc_skip' },
                ],
              ],
            },
          }
        );

        // Clear pending data
        ctx.session.pendingBillData = undefined;

      } catch (dbError) {
        if (dbError.message === 'Transaction already exists') {
          await ctx.reply(
            `⚠️ This transaction already exists in the database.\n\n` +
            `Reference: ${pagoMovilData.transactionId}\n` +
            `Amount: ${pagoMovilData.currency} ${pagoMovilData.amount.toFixed(2)}`
          );
          // Clear session even on duplicate
          ctx.session.pendingBillData = undefined;
        } else {
          throw dbError;
        }
      }

    } catch (error) {
      this.logger.error(`Pago Móvil save failed: ${error?.message || 'Unknown error'}`);
      this.logger.error(error);
      await ctx.reply('❌ Error saving transaction. Please try again.');
    }
  }

  private async handlePagoMovilTransaction(ctx: SessionContext, transactionData: any, isDebugMode = false) {
    // Validate all required fields
    if (!transactionData.datetime || !transactionData.amount || !transactionData.transactionId) {
      this.logger.warn('Missing required Pago Móvil data');
      await ctx.reply('❌ Could not extract all transaction data. Please try again with a clearer photo.');
      return;
    }

    this.logger.log(`Showing Pago Móvil preview: ${JSON.stringify(transactionData)}`);

    // Format preview message with extracted data (display in Venezuela timezone)
    const dateStr = transactionData.datetime.toLocaleString('es-VE', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const footerText = isDebugMode ? '<i>⚠️ DEBUG MODE IS ON</i>' : '<i>Confirm to save:</i>';
    const keyboard = isDebugMode ? [] : [[{ text: '✅ OK', callback_data: 'pago_movil_save' }]];

    // Show preview with confirmation button
    await ctx.reply(
      `💸 <b>Pago Móvil Data (Preview)</b>\n\n` +
      `📅 Date: ${dateStr}\n` +
      `💰 Amount: ${transactionData.currency} ${transactionData.amount.toFixed(2)}\n` +
      `🔢 Reference: ${transactionData.transactionId}\n\n` +
      footerText,
      {
        parse_mode: 'HTML',
        reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
      }
    );

    // Store Pago Móvil data in session for confirmation (only if not debug mode)
    if (!isDebugMode) {
      ctx.session.pendingBillData = transactionData;
    }
  }

  private async handleBillTransaction(ctx: SessionContext, transactionData: any, isDebugMode = false) {
    // Format message with extracted data (display in Venezuela timezone)
    const dateStr = transactionData.datetime
      ? transactionData.datetime.toLocaleString('es-VE', {
          timeZone: 'America/Caracas',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Not detected';

    const amountStr = transactionData.amount !== null
      ? `${transactionData.currency} ${transactionData.amount.toFixed(2)}`
      : 'Not detected';

    const transactionIdStr = transactionData.transactionId || 'Not detected';
    const methodStr = transactionData.paymentMethod ? `\n💳 Method: ${transactionData.paymentMethod}` : '';

    const footerText = isDebugMode ? '<i>⚠️ DEBUG MODE IS ON</i>' : '<i>Choose an action:</i>';
    const keyboard = isDebugMode ? [] : [[
      { text: '✅ OK', callback_data: 'bill_save' },
      { text: '✏️ Enter Manually', callback_data: 'bill_manual' },
    ]];

    // Send parsed data with action buttons
    await ctx.reply(
      `🧾 <b>Bill Data (Preview)</b>\n\n` +
      `📅 Date: ${dateStr}\n` +
      `💰 Amount: ${amountStr}\n` +
      `🔢 Transaction ID: ${transactionIdStr}${methodStr}\n\n` +
      footerText,
      {
        parse_mode: 'HTML',
        reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
      }
    );

    // Store bill data in session for later use (only if not debug mode)
    if (!isDebugMode) {
      ctx.session.pendingBillData = transactionData;
    }
  }

  private async downloadImage(fileId: string, ctx: SessionContext): Promise<Buffer> {
    // Get file URL from Telegram
    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    this.logger.log(`File URL: ${file.file_path}`);

    // Download image using axios with custom HTTPS agent
    const httpsAgent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      timeout: 60000,
      family: 4, // Force IPv4
    });

    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      httpsAgent,
      timeout: 60000,
    });
    const imageBuffer = Buffer.from(response.data);
    this.logger.log(`Image downloaded: ${imageBuffer.length} bytes`);

    return imageBuffer;
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

      const buttons = [];

      buttons.push(
        [
          Markup.button.callback('⏭️ Skip', 'review_skip'),
          Markup.button.callback('❌ Reject', 'review_reject'),
          Markup.button.callback('✅ Mark Reviewed', 'review_mark_reviewed'),
        ]
      );

      // Add Group or Ungroup button
      if (hasGroup) {
        buttons.push([
          Markup.button.callback('🔗 Ungroup', 'ungroup_transaction'),
        ]);
      } else {
        buttons.push([
          Markup.button.callback('📎 Group', 'group_transaction'),
        ]);
      }

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

    const buttons = [];

    buttons.push([
      Markup.button.callback('❌ Reject', 'review_reject'),
    ]);

    if (hasGroup) {
      buttons.push([
        Markup.button.callback('🔗 Ungroup', 'ungroup_transaction'),
      ]);
    } else {
      buttons.push([
        Markup.button.callback('📎 Group', 'group_transaction'),
      ]);
    }

    buttons.push([
      Markup.button.callback('✏️ Change Name', 'review_name'),
      Markup.button.callback('📅 Change Date', 'review_date'),
    ]);

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

      // Check if there's still more history
      const hasHistory = this.baseHandler.hasReviewHistory(ctx, 'transactions');

      const buttons = [];

      buttons.push(
        [
          Markup.button.callback('⏭️ Skip', 'review_skip'),
          Markup.button.callback('❌ Reject', 'review_reject'),
          Markup.button.callback('✅ Mark Reviewed', 'review_mark_reviewed'),
        ]
      );

      // Add Group or Ungroup button
      if (hasGroup) {
        buttons.push([
          Markup.button.callback('🔗 Ungroup', 'ungroup_transaction'),
        ]);
      } else {
        buttons.push([
          Markup.button.callback('📎 Group', 'group_transaction'),
        ]);
      }

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

  async startTransactionRegistration(ctx: SessionContext) {
    try {
      const result = await this.telegramService.transactions.getRegistrationDataWithGroups();

      if (!result.hasItems) {
        await ctx.reply('No reviewed transactions or groups to register.');
        return;
      }

      // Validate exchange rate for VES transactions/groups
      const hasVES = result.singleTransactions.some(t => t.currency === 'VES') ||
        result.groups.some(g => g.transactions.some(t => t.currency === 'VES'));

      if (hasVES && !result.exchangeRate) {
        await ctx.reply('Cannot register VES transactions/groups: Exchange rate not available. Please register exchanges first.');
        return;
      }

      // Store exchange rate in session
      ctx.session.registerTransactionExchangeRate = result.exchangeRate || null;

      // Combine transactions and groups into a single chronologically ordered list
      const combinedItems: Array<{type: 'transaction' | 'group', date: Date, id: number, data: any}> = [
        ...result.singleTransactions.map(tx => ({
          type: 'transaction' as const,
          date: new Date(tx.date),
          id: tx.id,
          data: tx,
        })),
        ...result.groupsWithDates.map(item => ({
          type: 'group' as const,
          date: item.date,
          id: item.group.id,
          data: item.group,
        })),
      ];

      // Sort by date (oldest first)
      combinedItems.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Store items in session for iterative flow
      ctx.session.registerItems = combinedItems.map(item => ({
        type: item.type,
        id: item.id,
        data: item.data,
      }));
      ctx.session.registerCurrentIndex = 0;
      ctx.session.registerTotalCount = combinedItems.length;

      // Show first item
      await this.showCurrentRegisterItem(ctx);
    } catch (error) {
      this.logger.error(`Error starting transaction registration: ${error.message}`);
      await ctx.reply('Error starting registration.');
    }
  }

  private async showCurrentRegisterItem(ctx: SessionContext, editMode = false) {
    const items = ctx.session.registerItems || [];
    const currentIndex = ctx.session.registerCurrentIndex ?? 0;
    const totalCount = ctx.session.registerTotalCount ?? 0;
    const exchangeRate = ctx.session.registerTransactionExchangeRate || 0;

    // Check if we've finished all items
    if (currentIndex >= items.length) {
      const completionMessage = `✅ <b>Registration Complete!</b>\n\n` +
        `All ${totalCount} item(s) have been processed.`;

      if (editMode) {
        await ctx.editMessageText(completionMessage, { parse_mode: 'HTML' });
      } else {
        await ctx.reply(completionMessage, { parse_mode: 'HTML' });
      }
      this.baseHandler.clearSession(ctx);
      return;
    }

    const item = items[currentIndex];
    const progress = `(${currentIndex + 1}/${totalCount})`;

    // Show item details
    if (item.type === 'transaction') {
      await this.showTransactionForRegisterIterative(ctx, item.data, exchangeRate, progress, editMode);
    } else {
      await this.showGroupForRegisterIterative(ctx, item.data, exchangeRate, progress, editMode);
    }
  }

  private async showTransactionForRegisterIterative(ctx: SessionContext, transaction: any, exchangeRate: number, progress: string, editMode = false) {
    try {
      const message = this.telegramService.transactions.formatTransactionForRegister(transaction, exchangeRate);

      const amount = Number(transaction.amount);
      let usdAmount: string;
      let excelFormula: string;

      if (transaction.currency === 'VES') {
        usdAmount = (amount / exchangeRate).toFixed(2);
        excelFormula = `=${amount.toFixed(2)}/${exchangeRate.toFixed(2)}`;
      } else {
        usdAmount = amount.toFixed(2);
        excelFormula = amount.toFixed(2);
      }

      // Format date as "1-Feb"
      const transactionDate = new Date(transaction.date);
      const day = transactionDate.getUTCDate();
      const monthShort = transactionDate.toLocaleDateString('en-US', {
        month: 'short',
        timeZone: 'UTC'
      });
      const dateFormatted = `${day}-${monthShort}`;

      // Show Commit if REVIEWED, Revert if already REGISTERED
      const isRegistered = transaction.status === TransactionStatus.REGISTERED;
      const actionButton = isRegistered
        ? { text: '↩️ Revert', callback_data: 'register_item_revert' }
        : { text: '✅ Commit', callback_data: 'register_item_commit' };

      // Build keyboard rows
      const keyboardRows: any[][] = [
        [{ text: 'Copy Date', copy_text: { text: dateFormatted } } as any],
        [{ text: 'Copy Description', copy_text: { text: transaction.description || 'No description' } } as any],
        [{ text: `${usdAmount} USD`, copy_text: { text: excelFormula } } as any],
        [actionButton],
      ];

      // Add Undo button if not on first item
      const currentIndex = ctx.session.registerCurrentIndex ?? 0;
      if (currentIndex > 0) {
        keyboardRows.push([{ text: '⬅️ Undo', callback_data: 'register_item_undo' }]);
      }

      // Always add Cancel button
      keyboardRows.push([{ text: '❌ Cancel', callback_data: 'register_item_cancel' }]);

      const keyboard = { inline_keyboard: keyboardRows };

      const fullMessage = `<b>Transaction ${progress}</b>\n\n${message}`;

      if (editMode) {
        await ctx.editMessageText(fullMessage, {
          parse_mode: 'HTML',
          reply_markup: keyboard as any,
        });
      } else {
        await ctx.reply(fullMessage, {
          parse_mode: 'HTML',
          reply_markup: keyboard as any,
        });
      }
    } catch (error) {
      this.logger.error(`Error showing transaction for register: ${error.message}`);
      await ctx.reply('Error displaying transaction.');
    }
  }

  private async showGroupForRegisterIterative(ctx: SessionContext, group: TransactionGroup & { transactions: Transaction[] }, exchangeRate: number, progress: string, editMode = false) {
    try {
      const calculation = await this.transactionGroupsService.calculateGroupAmount(group.id, exchangeRate);
      const groupDate = await this.transactionGroupsService.calculateGroupDate(group.id);

      // Use presenter to format the message
      const message = this.groupsPresenter.formatGroupForDisplay(group, calculation, groupDate, exchangeRate);

      // Build keyboard with Commit/Revert buttons
      const buttons: any[][] = [];

      // If it's a group with monetary value, add copy buttons
      if (calculation.hasMonetaryValue && calculation.type !== 'NEUTRAL') {
        const dateFormatted = `${groupDate.getUTCDate()}-${groupDate.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}`;
        buttons.push([{ text: 'Copy Date', copy_text: { text: dateFormatted } } as any]);
        buttons.push([{ text: 'Copy Description', copy_text: { text: group.description } } as any]);
        buttons.push([{ text: `${calculation.totalAmount.toFixed(2)} USD`, copy_text: { text: calculation.excelFormula } } as any]);
      }

      // Show Commit if NEW, Revert if already REGISTERED
      const isRegistered = group.status === TransactionGroupStatus.REGISTERED;
      const actionButton = isRegistered
        ? { text: '↩️ Revert', callback_data: 'register_item_revert' }
        : { text: '✅ Commit', callback_data: 'register_item_commit' };
      buttons.push([actionButton]);

      // Add Undo button if not on first item
      const currentIndex = ctx.session.registerCurrentIndex ?? 0;
      if (currentIndex > 0) {
        buttons.push([{ text: '⬅️ Undo', callback_data: 'register_item_undo' }]);
      }

      // Always add Cancel button
      buttons.push([{ text: '❌ Cancel', callback_data: 'register_item_cancel' }]);

      const fullMessage = `<b>Group ${progress}</b>\n\n${message}`;

      if (editMode) {
        await ctx.editMessageText(fullMessage, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: buttons } as any,
        });
      } else {
        await ctx.reply(fullMessage, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: buttons } as any,
        });
      }
    } catch (error) {
      this.logger.error(`Error showing group for register: ${error.message}`);
      await ctx.reply('Error displaying group.');
    }
  }

  @Action('register_item_commit')
  @UseGuards(TelegramAuthGuard)
  async handleRegisterItemCommit(@Ctx() ctx: SessionContext) {
    try {
      const items = ctx.session.registerItems || [];
      const currentIndex = ctx.session.registerCurrentIndex ?? 0;

      if (currentIndex >= items.length) {
        await ctx.answerCbQuery('No item to commit');
        return;
      }

      const item = items[currentIndex];

      // Mark as REGISTERED
      if (item.type === 'transaction') {
        await this.transactionsService.update(item.id, {
          status: TransactionStatus.REGISTERED,
        });
        // Update the cached data as well
        item.data.status = TransactionStatus.REGISTERED;
      } else {
        await this.transactionGroupsService.update(item.id, {
          status: TransactionGroupStatus.REGISTERED,
        });
        // Also mark all transactions in the group as REGISTERED
        const group = await this.transactionGroupsService.findOneWithTransactions(item.id);
        for (const tx of group.transactions) {
          await this.transactionsService.update(tx.id, {
            status: TransactionStatus.REGISTERED,
          });
        }
        // Update the cached data as well
        item.data.status = TransactionGroupStatus.REGISTERED;
      }

      await ctx.answerCbQuery(`✅ ${item.type === 'transaction' ? 'Transaction' : 'Group'} committed`);

      // Move to next item and edit the same message
      ctx.session.registerCurrentIndex = currentIndex + 1;
      await this.showCurrentRegisterItem(ctx, true);
    } catch (error) {
      this.logger.error(`Error committing item: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error committing item.');
    }
  }

  @Action('register_item_revert')
  @UseGuards(TelegramAuthGuard)
  async handleRegisterItemRevert(@Ctx() ctx: SessionContext) {
    try {
      const items = ctx.session.registerItems || [];
      const currentIndex = ctx.session.registerCurrentIndex ?? 0;

      if (currentIndex >= items.length) {
        await ctx.answerCbQuery('No item to revert');
        return;
      }

      const item = items[currentIndex];

      // Mark as REVIEWED (revert from ready-to-register state)
      if (item.type === 'transaction') {
        await this.transactionsService.update(item.id, {
          status: TransactionStatus.REVIEWED,
        });
        // Update the cached data as well
        item.data.status = TransactionStatus.REVIEWED;
      } else {
        await this.transactionGroupsService.update(item.id, {
          status: TransactionGroupStatus.NEW,
        });
        // Also revert all transactions in the group to REVIEWED
        const group = await this.transactionGroupsService.findOneWithTransactions(item.id);
        for (const tx of group.transactions) {
          await this.transactionsService.update(tx.id, {
            status: TransactionStatus.REVIEWED,
          });
        }
        // Update the cached data as well
        item.data.status = TransactionGroupStatus.NEW;
      }

      await ctx.answerCbQuery(`↩️ ${item.type === 'transaction' ? 'Transaction' : 'Group'} reverted`);

      // Move to next item and edit the same message
      ctx.session.registerCurrentIndex = currentIndex + 1;
      await this.showCurrentRegisterItem(ctx, true);
    } catch (error) {
      this.logger.error(`Error reverting item: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error reverting item.');
    }
  }

  @Action('register_item_undo')
  @UseGuards(TelegramAuthGuard)
  async handleRegisterItemUndo(@Ctx() ctx: SessionContext) {
    try {
      const items = ctx.session.registerItems || [];
      const currentIndex = ctx.session.registerCurrentIndex ?? 0;

      if (currentIndex <= 0) {
        await ctx.answerCbQuery('Nothing to undo');
        return;
      }

      // Go back to previous item
      const previousIndex = currentIndex - 1;
      const previousItem = items[previousIndex];

      // Revert previous item's status
      if (previousItem.type === 'transaction') {
        await this.transactionsService.update(previousItem.id, {
          status: TransactionStatus.REVIEWED,
        });
        // Update the cached data as well
        previousItem.data.status = TransactionStatus.REVIEWED;
      } else {
        await this.transactionGroupsService.update(previousItem.id, {
          status: TransactionGroupStatus.NEW,
        });
        // Also revert all transactions in the group to REVIEWED
        const group = await this.transactionGroupsService.findOneWithTransactions(previousItem.id);
        for (const tx of group.transactions) {
          await this.transactionsService.update(tx.id, {
            status: TransactionStatus.REVIEWED,
          });
        }
        // Update the cached data as well
        previousItem.data.status = TransactionGroupStatus.NEW;
      }

      await ctx.answerCbQuery(`⬅️ Undone: ${previousItem.type === 'transaction' ? 'Transaction' : 'Group'}`);

      // Move back and edit the message
      ctx.session.registerCurrentIndex = previousIndex;
      await this.showCurrentRegisterItem(ctx, true);
    } catch (error) {
      this.logger.error(`Error undoing item: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error undoing item.');
    }
  }

  @Action('register_item_cancel')
  @UseGuards(TelegramAuthGuard)
  async handleRegisterItemCancel(@Ctx() ctx: SessionContext) {
    try {
      const items = ctx.session.registerItems || [];

      // Revert all items that were registered during this flow back to reviewed
      let revertedCount = 0;
      for (const item of items) {
        if (item.type === 'transaction') {
          // Check if it was registered (from cached data)
          if (item.data.status === TransactionStatus.REGISTERED) {
            await this.transactionsService.update(item.id, {
              status: TransactionStatus.REVIEWED,
            });
            revertedCount++;
          }
        } else {
          // Check if group was registered
          if (item.data.status === TransactionGroupStatus.REGISTERED) {
            await this.transactionGroupsService.update(item.id, {
              status: TransactionGroupStatus.NEW,
            });
            // Also revert all transactions in the group to REVIEWED
            const group = await this.transactionGroupsService.findOneWithTransactions(item.id);
            for (const tx of group.transactions) {
              await this.transactionsService.update(tx.id, {
                status: TransactionStatus.REVIEWED,
              });
            }
            revertedCount++;
          }
        }
      }

      await ctx.answerCbQuery('Registration canceled');

      // Edit message with cancellation
      await ctx.editMessageText(
        `❌ <b>Registration Canceled</b>\n\n` +
        `${revertedCount} item(s) reverted to review.`,
        { parse_mode: 'HTML' }
      );

      this.baseHandler.clearSession(ctx);
    } catch (error) {
      this.logger.error(`Error canceling registration: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error canceling registration.');
    }
  }
}
