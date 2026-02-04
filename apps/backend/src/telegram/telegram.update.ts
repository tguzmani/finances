import { Update, Ctx, Command, Action, On } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramAuthGuard } from './guards/telegram-auth.guard';
import { SessionContext } from './telegram.types';
import { TransactionsService } from '../transactions/transactions.service';
import { TransactionStatus } from '../transactions/transaction.types';
import { ExchangesService } from '../exchanges/exchanges.service';
import { ExchangeStatus } from '@prisma/client';
import { PagoMovilOcrService } from '../transactions/pago-movil-ocr.service';
import { PagoMovilParser } from '../transactions/pago-movil.parser';
import axios from 'axios';
import * as https from 'https';

@Update()
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly transactionsService: TransactionsService,
    private readonly exchangesService: ExchangesService,
    private readonly pagoMovilOcr: PagoMovilOcrService,
    private readonly pagoMovilParser: PagoMovilParser,
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
      '/transactions - View recent expenses\n' +
      '/exchanges - View recent exchanges\n' +
      '/review - Review pending items\n' +
      '/register - Register reviewed items\n' +
      '/sync - Sync data from Banesco and Binance\n' +
      '/help - Show this help'
    );
  }

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

  @Command('exchanges')
  @UseGuards(TelegramAuthGuard)
  async handleExchanges(@Ctx() ctx: SessionContext) {
    try {
      const message = await this.telegramService.exchanges.getRecentExchangesList();
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Show all', 'exchanges_show_all')],
      ]);
      await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
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

  @Command('register')
  @UseGuards(TelegramAuthGuard)
  async handleRegister(@Ctx() ctx: SessionContext) {
    try {
      // Clear any previous session state
      ctx.session = {};

      // Get counts
      const [reviewedTxCount, reviewedExCount] = await Promise.all([
        this.telegramService.transactions.getReviewedTransactions().then(txs => txs.length),
        this.telegramService.exchanges.getReviewedExchanges().then(exs => exs.length),
      ]);

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`💸 Transactions (${reviewedTxCount})`, 'register_start_transactions')],
        [Markup.button.callback(`💱 Exchanges (${reviewedExCount})`, 'register_start_exchanges')],
      ]);

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
      ctx.session = {};

      // Get counts
      const [transactionsCount, exchangesCount] = await Promise.all([
        this.telegramService.transactions.getPendingReviewCount(),
        this.telegramService.exchanges.getPendingReviewCount(),
      ]);

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`💸 Transactions (${transactionsCount})`, 'review_start_transactions')],
        [Markup.button.callback(`💱 Exchanges (${exchangesCount})`, 'review_start_exchanges')],
      ]);

      await ctx.reply(
        '<b>What would you like to review?</b>',
        {
          parse_mode: 'HTML',
          ...keyboard,
        }
      );
    } catch (error) {
      await ctx.reply('Error starting review process.');
    }
  }

  @Action('review_start_transactions')
  @UseGuards(TelegramAuthGuard)
  async handleReviewStartTransactions(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      ctx.session.reviewType = 'transactions';
      await this.showNextTransaction(ctx);
    } catch (error) {
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error starting transaction review.');
    }
  }

  @Action('review_start_exchanges')
  @UseGuards(TelegramAuthGuard)
  async handleReviewStartExchanges(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      ctx.session.reviewType = 'exchanges';
      await this.showNextExchange(ctx);
    } catch (error) {
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error starting exchange review.');
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

  @Action('review_exchange_accept')
  @UseGuards(TelegramAuthGuard)
  async handleExchangeAccept(@Ctx() ctx: SessionContext) {
    try {
      const exchangeId = ctx.session.currentExchangeId;

      if (!exchangeId) {
        await ctx.answerCbQuery('No active exchange');
        return;
      }

      // Update exchange status to REVIEWED
      await this.exchangesService.update(exchangeId, {
        status: ExchangeStatus.REVIEWED,
      });

      await ctx.answerCbQuery('Exchange accepted');
      await ctx.reply('✅ Exchange accepted');

      // Show next exchange
      await this.showNextExchange(ctx);
    } catch (error) {
      await ctx.answerCbQuery('Error accepting exchange');
    }
  }

  @Action('review_exchange_reject')
  @UseGuards(TelegramAuthGuard)
  async handleExchangeReject(@Ctx() ctx: SessionContext) {
    try {
      const exchangeId = ctx.session.currentExchangeId;

      if (!exchangeId) {
        await ctx.answerCbQuery('No active exchange');
        return;
      }

      // Update exchange status to REJECTED
      await this.exchangesService.update(exchangeId, {
        status: ExchangeStatus.REJECTED,
      });

      await ctx.answerCbQuery('Exchange rejected');
      await ctx.reply('❌ Exchange rejected');

      // Show next exchange
      await this.showNextExchange(ctx);
    } catch (error) {
      await ctx.answerCbQuery('Error rejecting exchange');
    }
  }

  @Action('review_exchange_skip')
  @UseGuards(TelegramAuthGuard)
  async handleExchangeSkip(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Skipped');
      await ctx.reply('⏭️ Skipped');

      // Show next exchange
      await this.showNextExchange(ctx);
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

  @Action('register_confirm')
  @UseGuards(TelegramAuthGuard)
  async handleRegisterConfirm(@Ctx() ctx: SessionContext) {
    try {
      const exchangeIds = ctx.session.registerExchangeIds;
      const wavg = ctx.session.registerWavg;

      if (!exchangeIds || !wavg) {
        await ctx.answerCbQuery('Session expired. Please run /register again.');
        return;
      }

      await ctx.answerCbQuery('Registering exchanges...');

      // Perform registration
      await this.telegramService.exchanges.registerExchanges(exchangeIds, wavg);

      await ctx.reply(
        `✅ <b>Registration Complete!</b>\n\n` +
        `Registered ${exchangeIds.length} exchanges\n` +
        `Exchange rate saved: ${wavg} VES/USD`,
        { parse_mode: 'HTML' }
      );

      // Clear session
      ctx.session = {};
    } catch (error) {
      this.logger.error(`Error confirming registration: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error completing registration. Please try again.');
    }
  }

  @Action('register_cancel')
  @UseGuards(TelegramAuthGuard)
  async handleRegisterCancel(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Cancelled');
      await ctx.reply('🚫 Registration cancelled.');
      ctx.session = {};
    } catch (error) {
      await ctx.answerCbQuery('Error');
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

  @Action('register_start_exchanges')
  @UseGuards(TelegramAuthGuard)
  async handleRegisterStartExchanges(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();

      // Get reviewed exchanges
      const reviewedExchanges = await this.telegramService.exchanges.getReviewedExchanges();

      if (reviewedExchanges.length === 0) {
        await ctx.reply('No reviewed exchanges to register.');
        return;
      }

      // Calculate metrics
      const metrics = this.telegramService.exchanges.calculateRegisterMetrics(reviewedExchanges);

      // Store in session for Register action
      ctx.session.registerExchangeIds = reviewedExchanges.map(e => e.id);
      ctx.session.registerWavg = metrics.wavg;

      // Format message
      const message = this.telegramService.exchanges.formatRegisterSummary({
        ...metrics,
        count: reviewedExchanges.length,
      });

      // Create keyboard with copy buttons and action buttons
      const keyboard = {
        inline_keyboard: [
          [
            {
              text: 'Copy Terminal List',
              copy_text: { text: metrics.terminalList }
            } as any
          ],
          [
            {
              text: `${metrics.wavg} VES/USD`,
              copy_text: { text: String(metrics.wavg) }
            } as any
          ],
          [
            {
              text: `${metrics.totalAmount} USD`,
              copy_text: { text: metrics.sumFormula }
            } as any
          ],
          [
            {
              text: '✅ Register',
              callback_data: 'register_confirm'
            },
            {
              text: '🚫 Exit',
              callback_data: 'register_cancel'
            }
          ]
        ]
      };

      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: keyboard as any,
      });
    } catch (error) {
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error starting exchange registration.');
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

  @Action('exchanges_show_all')
  @UseGuards(TelegramAuthGuard)
  async handleExchangesShowAll(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      const message = await this.telegramService.exchanges.getRecentExchangesList(true);
      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (error) {
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error getting all exchanges.');
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

  @Action('register_tx_next')
  @UseGuards(TelegramAuthGuard)
  async handleRegisterTxNext(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();

      const currentIndex = ctx.session.registerTransactionIndex || 0;
      const transactionIds = ctx.session.registerTransactionIds || [];
      const exchangeRate = ctx.session.registerTransactionExchangeRate;

      if (!exchangeRate || transactionIds.length === 0) {
        await ctx.reply('Session expired. Please run /register_transactions again.');
        return;
      }

      const nextIndex = currentIndex + 1;

      if (nextIndex >= transactionIds.length) {
        // Reached the end, show confirmation
        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Register', 'register_tx_confirm'),
            Markup.button.callback('🚫 Cancel', 'register_tx_cancel'),
          ],
        ]);

        await ctx.reply(
          `✅ <b>Review Complete!</b>\n\n` +
          `You have reviewed all ${transactionIds.length} transactions.\n` +
          `Ready to register them?`,
          {
            parse_mode: 'HTML',
            ...keyboard,
          }
        );
        return;
      }

      // Update index
      ctx.session.registerTransactionIndex = nextIndex;

      // Get all transactions and find the one we need
      const allTransactions = await this.transactionsService.findAll({});
      const nextTransaction = allTransactions.find(t => t.id === transactionIds[nextIndex]);

      if (!nextTransaction) {
        await ctx.reply('Error loading next transaction.');
        return;
      }

      await this.showTransactionForRegister(ctx, nextTransaction, exchangeRate);
    } catch (error) {
      this.logger.error(`Error showing next transaction: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error loading next transaction.');
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

      await ctx.reply(
        `✅ <b>Registration Complete!</b>\n\n` +
        `Registered ${transactionIds.length} transactions`,
        { parse_mode: 'HTML' }
      );

      // Clear session
      ctx.session = {};
    } catch (error) {
      this.logger.error(`Error confirming transaction registration: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error completing registration. Please try again.');
    }
  }

  @Action('register_tx_cancel')
  @UseGuards(TelegramAuthGuard)
  async handleRegisterTxCancel(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Cancelled');
      await ctx.reply('🚫 Transaction registration cancelled.');
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
          `Date: ${parsed.date.toLocaleString('es-VE', { timeZone: 'America/Caracas' })}`
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
        ctx.session = {};
        return;
      }

      // Store current transaction in session and wait for description by default
      ctx.session.currentTransactionId = transaction.id;
      ctx.session.waitingForDescription = true;

      const message = await this.telegramService.transactions.formatTransactionForReview(transaction);

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('⏭️ Skip', 'review_skip'),
          Markup.button.callback('❌ Reject', 'review_reject'),
        ],
        [
          Markup.button.callback('🚫 Stop', 'review_cancel'),
        ],
      ]);

      await ctx.reply(
        message + '\n\n💬 <i>Type a description or use the buttons below:</i>',
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

  private async showNextExchange(ctx: SessionContext) {
    try {
      const exchange = await this.telegramService.exchanges.getNextForReview();

      if (!exchange) {
        await ctx.reply('✅ No more exchanges to review!');
        ctx.session = {};
        return;
      }

      // Store current exchange in session
      ctx.session.currentExchangeId = exchange.id;

      const message = this.telegramService.exchanges.formatExchangeForReview(exchange);

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Accept', 'review_exchange_accept'),
          Markup.button.callback('❌ Reject', 'review_exchange_reject'),
        ],
        [
          Markup.button.callback('⏭️ Skip', 'review_exchange_skip'),
          Markup.button.callback('🚫 Stop', 'review_cancel'),
        ],
      ]);

      await ctx.reply(
        message,
        {
          parse_mode: 'HTML',
          ...keyboard,
        }
      );
    } catch (error) {
      this.logger.error(`Error showing next exchange: ${error.message}`);
      await ctx.reply('Error loading exchange.');
    }
  }

  private async startTransactionRegistration(ctx: SessionContext) {
    try {
      const result = await this.telegramService.transactions.getRegistrationData();

      if (!result.hasTransactions) {
        await ctx.reply('No reviewed transactions to register.');
        return;
      }

      if (!result.exchangeRate) {
        await ctx.reply('Cannot register transactions: Exchange rate not available. Please register exchanges first.');
        return;
      }

      // Store in session
      ctx.session.registerTransactionIds = result.transactions.map(t => t.id);
      ctx.session.registerTransactionIndex = 0;
      ctx.session.registerTransactionExchangeRate = result.exchangeRate;

      // Show first transaction
      await this.showTransactionForRegister(ctx, result.transactions[0], result.exchangeRate);
    } catch (error) {
      this.logger.error(`Error starting transaction registration: ${error.message}`);
      await ctx.reply('Error starting registration.');
    }
  }

  private async showTransactionForRegister(ctx: SessionContext, transaction: any, exchangeRate: number) {
    try {
      const message = this.telegramService.transactions.formatTransactionForRegister(transaction, exchangeRate);

      const vesAmount = Number(transaction.amount);
      const usdAmount = (vesAmount / exchangeRate).toFixed(2);
      const excelFormula = `=${vesAmount.toFixed(2)}/${exchangeRate.toFixed(2)}`;

      const currentIndex = ctx.session.registerTransactionIndex || 0;
      const totalCount = ctx.session.registerTransactionIds?.length || 0;

      const keyboard = {
        inline_keyboard: [
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
          ],
          [
            {
              text: `⏭️ Next (${currentIndex + 1}/${totalCount})`,
              callback_data: 'register_tx_next'
            }
          ],
          [
            {
              text: '🚫 Cancel',
              callback_data: 'register_tx_cancel'
            }
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
