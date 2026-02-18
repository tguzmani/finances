import { Update, Ctx, Action } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { SessionContext } from '../telegram.types';
import { TransactionsService } from '../../transactions/transactions.service';
import { TransactionGroupsService } from '../../transaction-groups/transaction-groups.service';
import { TelegramBaseHandler } from '../telegram-base.handler';
import { ExchangeRateService } from '../../exchanges/exchange-rate.service';

@Update()
export class TelegramGroupFlowUpdate {
  private readonly logger = new Logger(TelegramGroupFlowUpdate.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly transactionGroupsService: TransactionGroupsService,
    private readonly baseHandler: TelegramBaseHandler,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  /**
   * Entry point: called by /group command handler in telegram.update.ts
   */
  async startGroupFlow(ctx: SessionContext) {
    try {
      this.baseHandler.clearSession(ctx);

      const groups = await this.transactionGroupsService.findGroupsForRegistration();

      if (groups.length === 0) {
        // Case 1: No groups — ask if user wants to create one
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('Create New Group', 'gf_create')],
          [Markup.button.callback('Cancel', 'gf_cancel')],
        ]);

        await ctx.reply(
          '<b>No unregistered groups.</b>\n\nWould you like to create a new group?',
          { parse_mode: 'HTML', ...keyboard },
        );
      } else {
        // Case 2: Groups exist — list them + option to create new
        const buttons = [];

        for (const group of groups) {
          const count = group.transactions.length;
          const desc = group.description.length > 40
            ? group.description.substring(0, 40) + '...'
            : group.description;
          buttons.push([
            Markup.button.callback(`📦 ${desc} (${count} txns)`, `gf_select_${group.id}`),
          ]);
        }

        buttons.push([Markup.button.callback('➕ Create New Group', 'gf_create')]);
        buttons.push([Markup.button.callback('Cancel', 'gf_cancel')]);

        await ctx.reply(
          '<b>Select a group to add transactions, or create a new one:</b>',
          { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) },
        );
      }
    } catch (error) {
      this.logger.error(`Error starting group flow: ${error.message}`);
      await ctx.reply('Error starting group flow.');
    }
  }

  @Action('gf_create')
  @UseGuards(TelegramAuthGuard)
  async handleCreate(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      ctx.session.groupFlowWaitingForDescription = true;

      await ctx.editMessageText(
        '<b>New Group</b>\n\nPlease type a description for this group:',
        { parse_mode: 'HTML' },
      );
    } catch (error) {
      this.logger.error(`Error in gf_create: ${error.message}`);
      await ctx.answerCbQuery('Error');
    }
  }

  @Action('gf_cancel')
  @UseGuards(TelegramAuthGuard)
  async handleCancel(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Cancelled');

      // If a group was created with < 2 transactions, clean it up
      await this.cleanupIncompleteGroup(ctx);

      await ctx.editMessageText('Group flow cancelled.', { parse_mode: 'HTML' });
      this.baseHandler.clearSession(ctx);
    } catch (error) {
      this.logger.error(`Error in gf_cancel: ${error.message}`);
      await ctx.answerCbQuery('Error');
    }
  }

  @Action(/^gf_select_(\d+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleSelectGroup(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();

      if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

      const match = ctx.callbackQuery.data.match(/^gf_select_(\d+)$/);
      if (!match) return;

      const groupId = parseInt(match[1]);
      const group = await this.transactionGroupsService.findOneWithTransactions(groupId);

      ctx.session.groupFlowGroupId = groupId;
      ctx.session.groupFlowTransactionIds = group.transactions.map(t => t.id);

      await this.showTransactionList(ctx, true);
    } catch (error) {
      this.logger.error(`Error in gf_select: ${error.message}`);
      await ctx.answerCbQuery('Error');
    }
  }

  /**
   * Called from text handler when groupFlowWaitingForDescription is true
   */
  async handleDescriptionInput(ctx: SessionContext) {
    if (!('text' in ctx.message)) return;

    try {
      const description = ctx.message.text;
      ctx.session.groupFlowWaitingForDescription = false;

      // Create the group (empty initially, transactions added one by one)
      const group = await this.transactionGroupsService.create(description);
      ctx.session.groupFlowGroupId = group.id;
      ctx.session.groupFlowTransactionIds = [];

      // Show transaction list (new message since user just typed text)
      await this.showTransactionList(ctx, false);
    } catch (error) {
      this.logger.error(`Error handling group description: ${error.message}`);
      await ctx.reply('Error creating group. Please try again.');
      ctx.session.groupFlowWaitingForDescription = false;
    }
  }

  @Action(/^gf_tx_(\d+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleSelectTransaction(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();

      if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

      const match = ctx.callbackQuery.data.match(/^gf_tx_(\d+)$/);
      if (!match) return;

      const txId = parseInt(match[1]);
      const groupId = ctx.session.groupFlowGroupId;

      if (!groupId) {
        await ctx.editMessageText('Session expired. Please run /group again.');
        this.baseHandler.clearSession(ctx);
        return;
      }

      // Add transaction to group
      await this.transactionGroupsService.addTransactionToGroup(txId, groupId);

      // Track added transaction IDs
      if (!ctx.session.groupFlowTransactionIds) {
        ctx.session.groupFlowTransactionIds = [];
      }
      ctx.session.groupFlowTransactionIds.push(txId);

      const group = await this.transactionGroupsService.findOneWithTransactions(groupId);
      const txCount = group.transactions.length;

      // Show continue/done options
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Add More', 'gf_continue')],
        [Markup.button.callback('Done', 'gf_done')],
        [Markup.button.callback('Cancel', 'gf_cancel')],
      ]);

      await ctx.editMessageText(
        `<b>📦 ${group.description}</b>\n\n` +
        `Transaction added! Group now has ${txCount} transaction(s).\n\n` +
        this.formatGroupTransactions(group.transactions) +
        `\n\nAdd more transactions or finish?`,
        { parse_mode: 'HTML', ...keyboard },
      );
    } catch (error) {
      this.logger.error(`Error in gf_tx: ${error.message}`);
      await ctx.answerCbQuery('Error');
    }
  }

  @Action('gf_continue')
  @UseGuards(TelegramAuthGuard)
  async handleContinue(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      await this.showTransactionList(ctx, true);
    } catch (error) {
      this.logger.error(`Error in gf_continue: ${error.message}`);
      await ctx.answerCbQuery('Error');
    }
  }

  @Action('gf_done')
  @UseGuards(TelegramAuthGuard)
  async handleDone(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();

      const groupId = ctx.session.groupFlowGroupId;

      if (!groupId) {
        await ctx.editMessageText('Session expired. Please run /group again.');
        this.baseHandler.clearSession(ctx);
        return;
      }

      const group = await this.transactionGroupsService.findOneWithTransactions(groupId);

      if (group.transactions.length < 2) {
        // Group needs at least 2 transactions
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('Add More', 'gf_continue')],
          [Markup.button.callback('Delete Group', 'gf_delete')],
        ]);

        await ctx.editMessageText(
          `<b>⚠️ Group needs at least 2 transactions</b>\n\n` +
          `"${group.description}" currently has ${group.transactions.length} transaction(s).\n` +
          `Add more or delete the group?`,
          { parse_mode: 'HTML', ...keyboard },
        );
        return;
      }

      // Group is valid — show summary
      const exchangeRate = await this.getExchangeRate();
      const calculation = await this.transactionGroupsService.calculateGroupAmount(groupId, exchangeRate);

      let summaryAmount = '';
      if (calculation.hasMonetaryValue && calculation.type !== 'NEUTRAL') {
        summaryAmount = `\nTotal: ${calculation.totalAmount.toFixed(2)} USD (${calculation.type})`;
      }

      await ctx.editMessageText(
        `<b>✅ Group Complete</b>\n\n` +
        `<b>📦 ${group.description}</b>\n` +
        `${group.transactions.length} transactions` +
        summaryAmount + `\n\n` +
        this.formatGroupTransactions(group.transactions),
        { parse_mode: 'HTML' },
      );

      this.baseHandler.clearSession(ctx);
    } catch (error) {
      this.logger.error(`Error in gf_done: ${error.message}`);
      await ctx.answerCbQuery('Error');
    }
  }

  @Action('gf_delete')
  @UseGuards(TelegramAuthGuard)
  async handleDelete(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Group deleted');

      await this.cleanupIncompleteGroup(ctx);

      await ctx.editMessageText('🗑️ Group deleted.', { parse_mode: 'HTML' });
      this.baseHandler.clearSession(ctx);
    } catch (error) {
      this.logger.error(`Error in gf_delete: ${error.message}`);
      await ctx.answerCbQuery('Error');
    }
  }

  // ==================== Private Helpers ====================

  private async showTransactionList(ctx: SessionContext, editMode: boolean) {
    const groupId = ctx.session.groupFlowGroupId;
    const addedTxIds = ctx.session.groupFlowTransactionIds || [];

    if (!groupId) {
      const msg = 'Session expired. Please run /group again.';
      if (editMode) {
        await ctx.editMessageText(msg);
      } else {
        await ctx.reply(msg);
      }
      this.baseHandler.clearSession(ctx);
      return;
    }

    const group = await this.transactionGroupsService.findOneWithTransactions(groupId);

    // Get ungrouped transactions (NEW or REVIEWED, no group)
    const allTransactions = await this.transactionsService.findAll({});
    const available = allTransactions.filter(t =>
      (t.status === 'NEW' || t.status === 'REVIEWED') &&
      t.groupId === null,
    );

    if (available.length === 0) {
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Done', 'gf_done')],
        [Markup.button.callback('Cancel', 'gf_cancel')],
      ]);

      const msg =
        `<b>📦 ${group.description}</b>\n\n` +
        `No ungrouped transactions available.\n\n` +
        (group.transactions.length > 0
          ? this.formatGroupTransactions(group.transactions) + '\n'
          : '');

      if (editMode) {
        await ctx.editMessageText(msg, { parse_mode: 'HTML', ...keyboard });
      } else {
        await ctx.reply(msg, { parse_mode: 'HTML', ...keyboard });
      }
      return;
    }

    // Build transaction buttons
    const buttons = [];
    for (const tx of available) {
      const amount = Number(tx.amount).toFixed(2);
      const desc = tx.description || 'No description';
      const maxLen = 35;
      const truncated = desc.length > maxLen ? desc.substring(0, maxLen) + '...' : desc;
      buttons.push([
        Markup.button.callback(`${truncated} - ${amount} ${tx.currency}`, `gf_tx_${tx.id}`),
      ]);
    }

    buttons.push([Markup.button.callback('Done', 'gf_done')]);
    buttons.push([Markup.button.callback('Cancel', 'gf_cancel')]);

    const currentTxs = group.transactions.length > 0
      ? `\nCurrent transactions:\n${this.formatGroupTransactions(group.transactions)}\n`
      : '';

    const msg =
      `<b>📦 ${group.description}</b>${currentTxs}\n` +
      `Select a transaction to add:`;

    if (editMode) {
      await ctx.editMessageText(msg, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons),
      });
    } else {
      await ctx.reply(msg, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons),
      });
    }
  }

  private formatGroupTransactions(transactions: any[]): string {
    return transactions
      .map(tx => {
        const amount = Number(tx.amount).toFixed(2);
        const icon = tx.type === 'INCOME' ? '💰' : '💸';
        const desc = tx.description || 'N/A';
        return `  ${icon} ${desc} - ${amount} ${tx.currency}`;
      })
      .join('\n');
  }

  private async cleanupIncompleteGroup(ctx: SessionContext) {
    const groupId = ctx.session.groupFlowGroupId;
    if (!groupId) return;

    try {
      const group = await this.transactionGroupsService.findOneWithTransactions(groupId);

      // Remove all transactions from the group first
      for (const tx of group.transactions) {
        await this.transactionGroupsService.removeTransactionFromGroup(tx.id);
      }

      // Delete the group
      await this.transactionGroupsService.delete(groupId);
    } catch (error) {
      this.logger.error(`Error cleaning up group ${groupId}: ${error.message}`);
    }
  }

  private async getExchangeRate(): Promise<number> {
    const latestRate = await this.exchangeRateService.findLatest();
    return latestRate ? Number(latestRate.value) : 0;
  }
}
