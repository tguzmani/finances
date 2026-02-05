import { Update, Ctx, Command, Action, On } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { TelegramService } from '../telegram.service';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { SessionContext } from '../telegram.types';
import { TransactionsService } from '../../transactions/transactions.service';
import { TransactionStatus } from '../../transactions/transaction.types';
import { PagoMovilOcrService } from '../../transactions/pago-movil-ocr.service';
import { PagoMovilParser } from '../../transactions/pago-movil.parser';
import { TelegramBaseHandler } from '../telegram-base.handler';
import { TelegramExchangesUpdate } from '../exchanges/telegram-exchanges.update';
import { TelegramManualTransactionUpdate } from './telegram-manual-transaction.update';
import axios from 'axios';
import * as https from 'https';

@Update()
export class TelegramTransactionsUpdate {
  private readonly logger = new Logger(TelegramTransactionsUpdate.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly transactionsService: TransactionsService,
    private readonly pagoMovilOcr: PagoMovilOcrService,
    private readonly pagoMovilParser: PagoMovilParser,
    private readonly baseHandler: TelegramBaseHandler,
    private readonly exchangesUpdate: TelegramExchangesUpdate,
    private readonly manualTransactionUpdate: TelegramManualTransactionUpdate,
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
      ctx.session.reviewOneMode = 'waiting_for_tx_id';
      ctx.session.reviewOneType = 'transaction';

      await ctx.reply(
        '🔢 Please enter the Transaction ID:',
        { reply_markup: { force_reply: true } }
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

      // Update transaction status to REJECTED
      await this.transactionsService.update(transactionId, {
        status: TransactionStatus.REJECTED,
      });

      await ctx.answerCbQuery('Transaction rejected');
      await ctx.reply('❌ Transaction rejected');

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
      const transactionIds = ctx.session.registerTransactionIds;

      if (!transactionIds || transactionIds.length === 0) {
        await ctx.answerCbQuery('Session expired. Please run /register_transactions again.');
        return;
      }

      await ctx.answerCbQuery('Registering transactions...');

      // Perform registration
      await this.telegramService.transactions.registerTransactions(transactionIds);

      // Store IDs in session for undo
      ctx.session.lastRegisteredTransactionIds = transactionIds;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('↩️ Undo', 'register_tx_undo')],
      ]);

      await ctx.reply(
        `✅ <b>Registration Complete!</b>\n\n` +
        `Registered ${transactionIds.length} transactions`,
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
      const transactionIds = ctx.session.lastRegisteredTransactionIds;

      if (!transactionIds || transactionIds.length === 0) {
        await ctx.answerCbQuery('Nothing to undo.');
        return;
      }

      await ctx.answerCbQuery('Undoing registration...');

      // Revert transactions back to REVIEWED status
      await Promise.all(
        transactionIds.map(id =>
          this.transactionsService.update(id, {
            status: TransactionStatus.REVIEWED,
          })
        )
      );

      await ctx.reply(
        `↩️ <b>Registration Undone!</b>\n\n` +
        `${transactionIds.length} transactions reverted to REVIEWED status`,
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

  @On('text')
  async handleText(@Ctx() ctx: SessionContext) {
    // Type guard for text messages
    if (!('text' in ctx.message)) {
      return;
    }

    // Manual transaction flow is handled by TelegramManualTransactionUpdate
    if (ctx.session.manualTransactionState === 'waiting_amount' ||
        ctx.session.manualTransactionState === 'waiting_description') {
      await this.manualTransactionUpdate.handleManualAmountOrDescription(ctx);
      return;
    }

    // Handle review by ID for exchange flow - delegate to exchanges handler
    if (ctx.session.reviewOneMode === 'waiting_for_ex_id') {
      await this.exchangesUpdate.handleReviewOneExchangeIdPublic(ctx);
      return;
    }

    // Handle review by ID for transaction flow
    if (ctx.session.reviewOneMode === 'waiting_for_tx_id') {
      await this.handleReviewOneTransactionId(ctx);
      return;
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
      await ctx.reply('📸 Processing image...');

      // Get highest resolution photo
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      this.logger.log(`Photo received: ${photo.file_id}`);

      // Get file URL from Telegram
      const file = await ctx.telegram.getFile(photo.file_id);
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

      // OCR
      this.logger.log('Starting OCR...');
      const ocrText = await this.pagoMovilOcr.extractText(imageBuffer);
      this.logger.log(`OCR completed: ${ocrText.substring(0, 100)}...`);

      // Parse
      this.logger.log('Parsing OCR text...');
      const parsed = this.pagoMovilParser.parse(ocrText);

      if (!parsed) {
        this.logger.warn('Failed to parse transaction data from OCR text');
        await ctx.reply('❌ Could not extract transaction data from image. Please try again with a clearer photo.');
        return;
      }

      this.logger.log(`Parsed transaction: ${JSON.stringify(parsed)}`);

      // Create transaction
      try {
        await this.transactionsService.createFromPagoMovil(parsed);

        await ctx.reply(
          `✅ Transaction saved!\n\n` +
          `Amount: ${parsed.currency} ${parsed.amount}\n` +
          `Reference: ${parsed.transactionId}\n` +
          `Date: ${parsed.date.toLocaleString('es-VE')}`
        );
      } catch (dbError) {
        if (dbError.message === 'Transaction already exists') {
          await ctx.reply(
            `⚠️ This transaction already exists in the database.\n\n` +
            `Reference: ${parsed.transactionId}\n` +
            `Amount: ${parsed.currency} ${parsed.amount}`
          );
        } else {
          throw dbError; // Re-throw if it's a different error
        }
      }

    } catch (error) {
      this.logger.error(`Photo processing failed: ${error?.message || 'Unknown error'}`);
      this.logger.error(error);
      await ctx.reply('❌ Error processing image. Please try again.');
    }
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

      // Add "Go Back" button if there's history
      const hasHistory = this.baseHandler.hasReviewHistory(ctx, 'transactions');

      const buttons = [];

      buttons.push(
        [
          Markup.button.callback('⏭️ Skip', 'review_skip'),
          Markup.button.callback('❌ Reject', 'review_reject'),
        ]
      );

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

  private async handleReviewOneTransactionId(ctx: SessionContext) {
    if (!('text' in ctx.message)) {
      return;
    }

    try {
      const idStr = ctx.message.text.trim();
      const id = parseInt(idStr, 10);

      if (isNaN(id)) {
        await ctx.reply('❌ Invalid ID. Please enter a numeric ID.');
        return;
      }

      // Fetch transaction
      const transaction = await this.transactionsService.findOne(id);

      if (!transaction) {
        await ctx.reply(`❌ Transaction with ID ${id} not found.`);
        return;
      }

      // Clear review one mode and set up normal review mode
      ctx.session.reviewOneMode = undefined;
      ctx.session.reviewOneType = undefined;
      ctx.session.reviewType = 'transactions';
      ctx.session.reviewSingleItem = true; // Mark as single item review
      ctx.session.currentTransactionId = transaction.id;
      ctx.session.waitingForDescription = true;

      const message = await this.telegramService.transactions.formatTransactionForReview(transaction);

      const buttons = [];
      buttons.push([
        Markup.button.callback('⏭️ Skip', 'review_skip'),
        Markup.button.callback('❌ Reject', 'review_reject'),
      ]);

      // Don't show Stop button for single item review
      if (!ctx.session.reviewSingleItem) {
        buttons.push([
          Markup.button.callback('🚫 Stop', 'review_cancel'),
        ]);
      }

      const keyboard = Markup.inlineKeyboard(buttons);

      await ctx.reply(
        `<b>Transaction ID: ${id}</b>\n\n` +
        message +
        '\n\n💬 <i>Type a description or use the buttons below:</i>',
        {
          parse_mode: 'HTML',
          ...keyboard,
        }
      );
    } catch (error) {
      this.logger.error(`Error loading transaction by ID: ${error.message}`);
      await ctx.reply('❌ Error loading transaction. Please try again.');
    }
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

      // Check if there's still more history
      const hasHistory = this.baseHandler.hasReviewHistory(ctx, 'transactions');

      const buttons = [];

      buttons.push(
        [
          Markup.button.callback('⏭️ Skip', 'review_skip'),
          Markup.button.callback('❌ Reject', 'review_reject'),
        ]
      );

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

  private async startTransactionRegistration(ctx: SessionContext) {
    try {
      const result = await this.telegramService.transactions.getRegistrationData();

      if (!result.hasTransactions) {
        await ctx.reply('No reviewed transactions to register.');
        return;
      }

      // Check if there are VES transactions that require exchange rate
      const hasVESTransactions = result.transactions.some(t => t.currency === 'VES');

      if (hasVESTransactions && !result.exchangeRate) {
        await ctx.reply('Cannot register VES transactions: Exchange rate not available. Please register exchanges first.');
        return;
      }

      // Store in session (no need for index anymore)
      ctx.session.registerTransactionIds = result.transactions.map(t => t.id);
      ctx.session.registerTransactionExchangeRate = result.exchangeRate || null;

      // Show ALL transactions
      for (const transaction of result.transactions) {
        await this.showTransactionForRegister(ctx, transaction, result.exchangeRate || 0);
      }

      // Show final commit button
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Commit', 'register_tx_confirm')],
      ]);

      await ctx.reply(
        `<b>Ready to register ${result.transactions.length} transaction(s)</b>\n\n` +
        `Click Commit to complete the registration.`,
        {
          parse_mode: 'HTML',
          ...keyboard,
        }
      );
    } catch (error) {
      this.logger.error(`Error starting transaction registration: ${error.message}`);
      await ctx.reply('Error starting registration.');
    }
  }

  private async showTransactionForRegister(ctx: SessionContext, transaction: any, exchangeRate: number) {
    try {
      const message = this.telegramService.transactions.formatTransactionForRegister(transaction, exchangeRate);

      const amount = Number(transaction.amount);
      let usdAmount: string;
      let excelFormula: string;

      if (transaction.currency === 'VES') {
        // For VES, divide by exchange rate
        usdAmount = (amount / exchangeRate).toFixed(2);
        excelFormula = `=${amount.toFixed(2)}/${exchangeRate.toFixed(2)}`;
      } else {
        // For non-VES (USD, USDT, etc.), use amount directly
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

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: 'Copy Date',
              copy_text: { text: dateFormatted }
            } as any
          ],
          [
            {
              text: 'Copy Description',
              copy_text: { text: transaction.description || 'No description' }
            } as any
          ],
          [
            {
              text: `${usdAmount} USD`,
              copy_text: { text: excelFormula }
            } as any
          ]
        ]
      };

      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: keyboard as any,
      });
    } catch (error) {
      this.logger.error(`Error showing transaction for register: ${error.message}`);
      await ctx.reply('Error displaying transaction.');
    }
  }
}
