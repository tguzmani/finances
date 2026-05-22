import { Update, Ctx, Action, On } from 'nestjs-telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { SessionContext } from '../telegram.types';
import { TransactionsService } from '../../transactions/transactions.service';
import { TransactionStatus, TransactionType, TransactionPlatform, PaymentMethod } from '../../transactions/transaction.types';
import { TransactionOcrParser } from '../../transactions/ocr/parsers/transaction-ocr-parser';
import { B2StorageService } from '../../common/b2-storage.service';
import { ExchangeRateService } from '../../exchanges/exchange-rate.service';
import { AutoRegistrationService } from '../../journal-entry/auto-registration.service';
import { SheetUpdateService } from '../../journal-entry/sheet-update.service';
import { TelegramPagoMovilUpdate } from '../pago-movil/telegram-pago-movil.update';
import axios from 'axios';
import * as https from 'https';

@Update()
export class TelegramTransactionPhotoUpdate {
  private readonly logger = new Logger(TelegramTransactionPhotoUpdate.name);
  private readonly pendingImageBuffers = new Map<number, Buffer>();

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly transactionOcrParser: TransactionOcrParser,
    private readonly b2Storage: B2StorageService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly pagoMovilUpdate: TelegramPagoMovilUpdate,
    private readonly sheetUpdateService: SheetUpdateService,
    private readonly autoRegistrationService: AutoRegistrationService,
  ) { }

  @On('photo')
  @UseGuards(TelegramAuthGuard)
  async handlePhoto(@Ctx() ctx: SessionContext) {
    // Type guard for photo messages
    if (!('photo' in ctx.message)) {
      return;
    }

    // Delegate to Pago Móvil handler if that flow is active
    if (ctx.session.pagoMovilWaiting) {
      await this.pagoMovilUpdate.handlePhoto(ctx);
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

      const processingMsg = await ctx.reply('📸 Processing image with OCR...');

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
        await ctx.telegram.editMessageText(
          ctx.message.chat.id,
          processingMsg.message_id,
          undefined,
          '❌ Could not recognize this image as a transaction.\n\n' +
          'Supported formats:\n' +
          '• Pago Móvil screenshots\n' +
          '• Bank transfers\n' +
          '• Store receipts\n\n' +
          'Please try again with a clearer photo.',
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

      // Store image buffer for later upload when transaction is saved
      const chatId = ctx.message.chat.id;
      this.pendingImageBuffers.set(chatId, imageBuffer);

      // Store caption for use as description when saving
      if (caption) {
        transactionData.caption = caption;
      }

      if (transactionData.paymentMethod === PaymentMethod.PAGO_MOVIL) {
        // Pago Móvil: Edit processing message with preview
        await this.handlePagoMovilTransaction(ctx, transactionData, isDebugMode, processingMsg.message_id);
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

      // Show loading state and hide buttons
      await ctx.editMessageText('⏳ <b>Processing...</b>', { parse_mode: 'HTML' });

      const description = billData.transactionId ? `Bill #${billData.transactionId}` : 'Bill purchase';

      // Create transaction from bill data
      const transaction = await this.transactionsService.createManualTransaction({
        type: TransactionType.EXPENSE,
        platform: TransactionPlatform.BANESCO,
        currency: billData.currency,
        amount: billData.amount,
        description,
        method: PaymentMethod.DEBIT_CARD,
        date: billData.datetime,
      });

      // If caption was provided, use it as description
      if (billData.caption) {
        await this.transactionsService.update(transaction.id, {
          description: billData.caption,
        });
      }

      // Upload image to B2 if available
      await this.uploadPendingImage(ctx, transaction.id, transaction.transactionId);

      // Try auto-registration if description (caption) is available
      let statusText = '';
      const updatedTransaction = await this.transactionsService.findOne(transaction.id);
      try {
        const sheetResult = await this.sheetUpdateService.trySheetUpdate(updatedTransaction);
        if (sheetResult) {
          await this.transactionsService.update(transaction.id, {
            status: TransactionStatus.REGISTERED,
          });
          statusText = `\n\n<i>✅ Auto-Registered</i>`;
        }
      } catch (err) {
        this.logger.error(`Sheet update error for bill: ${err.message}`);
      }

      if (!statusText) {
        try {
          const autoResult = await this.autoRegistrationService.tryAutoRegister(updatedTransaction);
          if (autoResult) {
            await this.transactionsService.update(transaction.id, {
              status: TransactionStatus.REGISTERED,
            });
            statusText = `\n\n<i>✅ Auto-Registered</i>`;
          }
        } catch (err) {
          this.logger.error(`Auto-registration error for bill: ${err.message}`);
        }
      }

      const usdSuffix = await this.formatVesUsdSuffix(billData.currency, billData.amount);
      const captionLine = billData.caption ? `📝 ${billData.caption}\n\n` : '';

      await ctx.editMessageText(
        `✅ <b>Transaction Saved!</b>\n\n` +
        captionLine +
        `💰 Amount: ${billData.currency} ${billData.amount.toFixed(2)}${usdSuffix}\n` +
        `🔢 Transaction ID: ${billData.transactionId || 'N/A'}\n` +
        `📅 Date: ${billData.datetime.toLocaleString('es-VE', { timeZone: 'America/Caracas' })}` +
        statusText,
        { parse_mode: 'HTML' }
      );

      if (!billData.caption) {
        // No caption provided, ask for description
        ctx.session.currentTransactionId = transaction.id;
        ctx.session.waitingForDescription = true;
        ctx.session.reviewSingleItem = true;

        await ctx.reply(
          '✏️ Please type a description for this transaction:',
          { reply_markup: { force_reply: true } }
        );
      }

      // Clear session
      ctx.session.pendingBillData = undefined;

    } catch (error) {
      this.logger.error(`Bill save failed: ${error?.message || 'Unknown error'}`);
      this.logger.error(error);
      await ctx.reply('❌ Error saving transaction. Please try again.');
    }
  }

  @Action('bill_reject')
  @UseGuards(TelegramAuthGuard)
  async handleBillReject(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Transaction rejected');

      ctx.session.pendingBillData = undefined;

      const chatId = ctx.callbackQuery?.message?.chat?.id;
      if (chatId) {
        this.pendingImageBuffers.delete(chatId);
      }

      await ctx.editMessageText(
        '❌ <b>Transaction Rejected</b>',
        { parse_mode: 'HTML' },
      );
    } catch (error) {
      this.logger.error(`Bill reject failed: ${error?.message}`);
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

  @Action('pago_movil_save')
  @UseGuards(TelegramAuthGuard)
  async handlePagoMovilSave(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Saving transaction...');

      const pagoMovilData = ctx.session.pendingBillData;
      if (!pagoMovilData) {
        await ctx.editMessageText('❌ Session expired. Please send the photo again.');
        return;
      }

      // Validate required fields
      if (!pagoMovilData.datetime || !pagoMovilData.amount || !pagoMovilData.transactionId) {
        await ctx.editMessageText('❌ Cannot save transaction: Missing required data.');
        return;
      }

      // Show loading state and hide buttons
      await ctx.editMessageText('⏳ <b>Processing...</b>', { parse_mode: 'HTML' });

      this.logger.log(`Creating Pago Móvil transaction: ${JSON.stringify(pagoMovilData)}`);

      // Create Pago Móvil transaction
      try {
        let transaction = await this.transactionsService.createFromPagoMovil({
          date: pagoMovilData.datetime,
          amount: pagoMovilData.amount,
          currency: pagoMovilData.currency,
          transactionId: pagoMovilData.transactionId,
        });

        // If caption was provided, use it as description and mark as REVIEWED
        if (pagoMovilData.caption) {
          await this.transactionsService.update(transaction.id, {
            description: pagoMovilData.caption,
            status: TransactionStatus.REVIEWED,
          });
          // Reload transaction with description for sheet update
          transaction = await this.transactionsService.findOne(transaction.id);
        }

        // Upload image to B2 if available
        await this.uploadPendingImage(ctx, transaction.id, transaction.transactionId);

        // Try auto-registration if description (caption) is available
        let statusText = '';
        try {
          const sheetResult = await this.sheetUpdateService.trySheetUpdate(transaction);
          if (sheetResult) {
            await this.transactionsService.update(transaction.id, {
              status: TransactionStatus.REGISTERED,
            });
            statusText = `\n\n<i>✅ Auto-Registered</i>`;
          }
        } catch (err) {
          this.logger.error(`Sheet update error for Pago Móvil: ${err.message}`);
        }

        if (!statusText) {
          try {
            const autoResult = await this.autoRegistrationService.tryAutoRegister(transaction);
            if (autoResult) {
              await this.transactionsService.update(transaction.id, {
                status: TransactionStatus.REGISTERED,
              });
              statusText = `\n\n<i>✅ Auto-Registered</i>`;
            }
          } catch (err) {
            this.logger.error(`Auto-registration error for Pago Móvil: ${err.message}`);
          }
        }

        const pmUsdSuffix = await this.formatVesUsdSuffix(pagoMovilData.currency, pagoMovilData.amount);
        const captionLine = pagoMovilData.caption ? `📝 ${pagoMovilData.caption}\n\n` : '';

        await ctx.editMessageText(
          `✅ <b>Pago Móvil Transaction Saved!</b>\n\n` +
          captionLine +
          `💰 Amount: ${pagoMovilData.currency} ${pagoMovilData.amount.toFixed(2)}${pmUsdSuffix}\n` +
          `🔢 Reference: ${pagoMovilData.transactionId}\n` +
          `📅 Date: ${pagoMovilData.datetime.toLocaleString('es-VE', { timeZone: 'America/Caracas' })}` +
          statusText,
          { parse_mode: 'HTML' }
        );

        if (!pagoMovilData.caption) {
          // No caption provided, ask for description
          ctx.session.currentTransactionId = transaction.id;
          ctx.session.waitingForDescription = true;
          ctx.session.reviewSingleItem = true;

          await ctx.reply(
            '✏️ Please type a description for this transaction:',
            { reply_markup: { force_reply: true } }
          );
        }

        // Clear pending data
        ctx.session.pendingBillData = undefined;

      } catch (dbError) {
        if (dbError.message === 'Transaction already exists') {
          await ctx.editMessageText(
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

  @Action('pago_movil_reject')
  @UseGuards(TelegramAuthGuard)
  async handlePagoMovilReject(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Transaction rejected');

      ctx.session.pendingBillData = undefined;

      // Clean up pending image
      const chatId = ctx.callbackQuery?.message?.chat?.id;
      if (chatId) {
        this.pendingImageBuffers.delete(chatId);
      }

      await ctx.editMessageText(
        '❌ <b>Transaction Rejected</b>',
        { parse_mode: 'HTML' },
      );
    } catch (error) {
      this.logger.error(`Pago Móvil reject failed: ${error?.message}`);
    }
  }

  private async handlePagoMovilTransaction(ctx: SessionContext, transactionData: any, isDebugMode = false, messageId?: number) {
    // Validate all required fields
    if (!transactionData.datetime || !transactionData.amount || !transactionData.transactionId) {
      this.logger.warn('Missing required Pago Móvil data');
      const errorText = '❌ Could not extract all transaction data. Please try again with a clearer photo.';
      if (messageId) {
        const chatId = ctx.message?.chat?.id ?? (ctx.callbackQuery?.message as any)?.chat?.id;
        await ctx.telegram.editMessageText(chatId, messageId, undefined, errorText);
      } else {
        await ctx.reply(errorText);
      }
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

    const usdSuffix = await this.formatVesUsdSuffix(transactionData.currency, transactionData.amount);

    const footerText = isDebugMode ? '<i>⚠️ DEBUG MODE IS ON</i>' : '';
    const keyboard = isDebugMode ? [] : [[
      { text: '✅ OK', callback_data: 'pago_movil_save' },
      { text: '❌ Reject', callback_data: 'pago_movil_reject' },
    ]];

    const captionLine = transactionData.caption ? `📝 ${transactionData.caption}\n\n` : '';

    const text =
      `💸 <b>Pago Móvil Data (Preview)</b>\n\n` +
      captionLine +
      `📅 Date: ${dateStr}\n` +
      `💰 Amount: ${transactionData.currency} ${transactionData.amount.toFixed(2)}${usdSuffix}\n` +
      `🔢 Reference: ${transactionData.transactionId}\n\n` +
      footerText;

    const replyMarkup = keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined;

    // Edit the processing message with preview
    if (messageId) {
      const chatId = ctx.message?.chat?.id ?? (ctx.callbackQuery?.message as any)?.chat?.id;
      await ctx.telegram.editMessageText(chatId, messageId, undefined, text, {
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      });
    } else {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      });
    }

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

    let amountStr: string;
    if (transactionData.amount !== null) {
      const usdSuffix = await this.formatVesUsdSuffix(transactionData.currency, transactionData.amount);
      amountStr = `${transactionData.currency} ${transactionData.amount.toFixed(2)}${usdSuffix}`;
    } else {
      amountStr = 'Not detected';
    }

    const transactionIdStr = transactionData.transactionId || 'Not detected';
    const methodStr = transactionData.paymentMethod ? `\n💳 Method: ${transactionData.paymentMethod}` : '';

    const footerText = isDebugMode ? '<i>⚠️ DEBUG MODE IS ON</i>' : '';
    const keyboard = isDebugMode ? [] : [[
      { text: '✅ OK', callback_data: 'bill_save' },
      { text: '❌ Reject', callback_data: 'bill_reject' },
    ]];

    const captionLine = transactionData.caption ? `📝 ${transactionData.caption}\n\n` : '';

    // Send parsed data with action buttons
    await ctx.reply(
      `🧾 <b>Bill Data (Preview)</b>\n\n` +
      captionLine +
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

  private async uploadPendingImage(ctx: SessionContext, transactionDbId: number, transactionId: string): Promise<void> {
    const chatId = ctx.callbackQuery?.message?.chat?.id ?? (ctx.message as any)?.chat?.id;
    if (!chatId) return;

    const imageBuffer = this.pendingImageBuffers.get(chatId);
    if (!imageBuffer) return;

    try {
      const key = await this.b2Storage.uploadTransactionImage(imageBuffer, transactionId);
      await this.transactionsService.updateImageUrl(transactionDbId, key);
      this.logger.log(`Image stored for transaction ${transactionId}: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to upload image for transaction ${transactionId}: ${error.message}`);
    } finally {
      this.pendingImageBuffers.delete(chatId);
    }
  }

  private async formatVesUsdSuffix(currency: string, amount: number): Promise<string> {
    if (currency !== 'VES') return '';
    try {
      const latestRate = await this.exchangeRateService.findLatest();
      if (latestRate) {
        const usd = amount / Number(latestRate.value);
        return ` (${usd.toFixed(2)} USD)`;
      }
    } catch (e) { /* rate unavailable */ }
    return '';
  }
}
