import { Update, Ctx, Action } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { Transaction, TransactionGroup } from '@prisma/client';
import { TelegramService } from '../telegram.service';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { SessionContext } from '../telegram.types';
import { TransactionsService } from '../../transactions/transactions.service';
import { TransactionStatus } from '../../transactions/transaction.types';
import { TelegramBaseHandler } from '../telegram-base.handler';
import { TransactionGroupsService } from '../../transaction-groups/transaction-groups.service';
import { TransactionGroupStatus } from '../../transaction-groups/transaction-group.types';
import { TelegramGroupsPresenter } from './telegram-groups.presenter';
import { JournalEntryService } from '../../journal-entry/journal-entry.service';
import { GoogleSheetConfigService } from '../../google-sheet-config/google-sheet-config.service';
import { TelegramTransactionsUpdate } from './telegram-transactions.update';

@Update()
export class TelegramTransactionRegisterUpdate {
  private readonly logger = new Logger(TelegramTransactionRegisterUpdate.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly transactionsService: TransactionsService,
    private readonly transactionGroupsService: TransactionGroupsService,
    private readonly baseHandler: TelegramBaseHandler,
    private readonly groupsPresenter: TelegramGroupsPresenter,
    private readonly journalEntryService: JournalEntryService,
    private readonly googleSheetConfigService: GoogleSheetConfigService,
    private readonly transactionsUpdate: TelegramTransactionsUpdate,
  ) { }

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
      await this.transactionsUpdate.startTransactionReview(ctx);
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

      // Delete bill photo if it was shown
      await this.transactionsUpdate.deleteBillMessage(ctx);

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

      // Delete bill photo if it was shown
      await this.transactionsUpdate.deleteBillMessage(ctx);

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

      // Delete bill photo if it was shown
      await this.transactionsUpdate.deleteBillMessage(ctx);

      // Move back and edit the message
      ctx.session.registerCurrentIndex = previousIndex;
      await this.showCurrentRegisterItem(ctx, true);
    } catch (error) {
      this.logger.error(`Error undoing item: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error undoing item.');
    }
  }

  @Action(/^journal_entry_(\d+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleJournalEntry(@Ctx() ctx: SessionContext) {
    try {
      const match = (ctx.callbackQuery as any).data.match(/^journal_entry_(\d+)$/);
      const transactionId = parseInt(match[1], 10);

      const transaction = await this.transactionsService.findOne(transactionId);
      if (!transaction) {
        await ctx.answerCbQuery('Transaction not found.');
        return;
      }

      await this.journalEntryService.createJournalEntry(transaction);
      await ctx.answerCbQuery('✅ Journal entry inserted in Sheets');
    } catch (error) {
      this.logger.error(`Error generating journal entry: ${error.message}`);
      await ctx.reply(`❌ Error generating journal entry: ${error.message}`);
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

      // Delete bill photo if it was shown
      await this.transactionsUpdate.deleteBillMessage(ctx);

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
      const combinedItems: Array<{ type: 'transaction' | 'group', date: Date, id: number, data: any }> = [
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

      // Show link to Google Sheets
      const sheetId = await this.googleSheetConfigService.getCurrentSheetId();
      if (sheetId) {
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit?gid=1400547069#gid=1400547069`;
        await ctx.reply(`📊 <b>Registration started</b> — ${combinedItems.length} item(s) to process.`, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.url('Open Google Sheets', sheetUrl)],
          ]),
        });
      }

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
      const day = transactionDate.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/Caracas' });
      const monthShort = transactionDate.toLocaleDateString('en-US', {
        month: 'short',
        timeZone: 'America/Caracas'
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
        [actionButton, { text: '📒 Journal Entry', callback_data: `journal_entry_${transaction.id}` }],
      ];

      // Add View Bill button if transaction has an image
      if (transaction.imageUrl) {
        keyboardRows.push([{ text: '🧾 View Bill', callback_data: `view_bill_${transaction.id}` }]);
      }

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
        const dateFormatted = `${groupDate.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/Caracas' })}-${groupDate.toLocaleDateString('en-US', { month: 'short', timeZone: 'America/Caracas' })}`;
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
}
