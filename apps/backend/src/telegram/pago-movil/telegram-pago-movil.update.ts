import { Injectable, Logger } from '@nestjs/common';
import { Markup } from 'telegraf';
import { SessionContext } from '../telegram.types';
import { TelegramPagoMovilService } from './telegram-pago-movil.service';
import { TelegramPagoMovilPresenter } from './telegram-pago-movil.presenter';
import { DESCRIPTION_PROMPT } from '../transactions/telegram-transactions.presenter';
import { PagoMovilData } from '../../transactions/ocr/parsers/pago-movil-llm-parser.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { TelegramBaseHandler } from '../telegram-base.handler';
import { PaymentMethod, TransactionPlatform, TransactionType } from '../../transactions/transaction.types';
import axios from 'axios';
import * as https from 'https';

@Injectable()
export class TelegramPagoMovilUpdate {
  private readonly logger = new Logger(TelegramPagoMovilUpdate.name);

  constructor(
    private readonly pagoMovilService: TelegramPagoMovilService,
    private readonly presenter: TelegramPagoMovilPresenter,
    private readonly transactionsService: TransactionsService,
    private readonly baseHandler: TelegramBaseHandler,
  ) {}

  async handlePagoMovil(ctx: SessionContext) {
    ctx.session.pagoMovilWaiting = true;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🚫 Cancel', 'pago_movil_cancel')],
    ]);

    const sent = await ctx.reply(
      '📲 <b>Pago Móvil Data</b>\n\n' +
      'Send me the payment data as:\n' +
      '• A <b>photo</b> (screenshot)\n' +
      '• A <b>text</b> message\n' +
      '• A <b>photo with caption</b> for extra context',
      { parse_mode: 'HTML', ...keyboard },
    );

    ctx.session.pagoMovilMessageId = sent.message_id;
  }

  async handlePhoto(ctx: SessionContext): Promise<void> {
    if (!('photo' in ctx.message)) return;

    await this.dismissPromptMessage(ctx);

    try {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const caption = 'caption' in ctx.message ? ctx.message.caption : undefined;

      await ctx.reply('📸 Processing image...');

      const imageBuffer = await this.downloadImage(photo.file_id, ctx);
      const data = await this.pagoMovilService.parseFromImage(imageBuffer, caption);

      await this.sendResult(ctx, data);
    } catch (error) {
      this.logger.error(`Pago Móvil photo handling failed: ${error?.message}`);
      await ctx.reply('❌ Error processing image. Please try again.');
    } finally {
      ctx.session.pagoMovilWaiting = false;
      ctx.session.pagoMovilMessageId = undefined;
    }
  }

  async handleTextInput(ctx: SessionContext): Promise<void> {
    if (!('text' in ctx.message)) return;

    await this.dismissPromptMessage(ctx);

    try {
      await ctx.reply('🔍 Parsing payment data...');
      const data = await this.pagoMovilService.parseFromText(ctx.message.text);
      await this.sendResult(ctx, data);
    } catch (error) {
      this.logger.error(`Pago Móvil text handling failed: ${error?.message}`);
      await ctx.reply('❌ Error parsing text. Please try again.');
    } finally {
      ctx.session.pagoMovilWaiting = false;
      ctx.session.pagoMovilMessageId = undefined;
    }
  }

  private async dismissPromptMessage(ctx: SessionContext): Promise<void> {
    const messageId = ctx.session.pagoMovilMessageId;
    if (!messageId) return;

    try {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        messageId,
        undefined,
        '📲 <b>Pago Móvil Data</b>',
        { parse_mode: 'HTML' },
      );
    } catch (error) {
      this.logger.warn(`Could not edit prompt message: ${error?.message}`);
    }
  }

  private async sendResult(ctx: SessionContext, data: PagoMovilData): Promise<void> {
    const message = this.presenter.formatPagoMovilMessage(data);
    const copyText = this.presenter.buildCopyText(data);

    if (!copyText) {
      await ctx.reply(message, { parse_mode: 'HTML' });
      return;
    }

    const buttons: any[][] = [
      [{ text: 'Copy', copy_text: { text: copyText } }],
    ];

    // Only offer to book it when there is an amount to book
    if (data.amount != null) {
      ctx.session.pagoMovilData = data;
      buttons.push([{ text: '💾 Store as Tx', callback_data: 'pago_movil_store_tx' }]);
    }

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons } as any,
    });
  }

  /**
   * Books the parsed payment as a Banesco expense, the same as a Pago Móvil
   * photo would, using the data already on screen instead of a receipt. The
   * description is asked for afterwards, which is what puts the transaction
   * through auto-registration.
   */
  async handleStoreAsTx(ctx: SessionContext): Promise<void> {
    const data = ctx.session.pagoMovilData;

    if (!data?.amount) {
      await ctx.answerCbQuery('No payment data left to store');
      return;
    }

    try {
      await ctx.answerCbQuery();
      await this.baseHandler.removeButtons(ctx);

      const transaction = await this.transactionsService.createManualTransaction({
        type: TransactionType.EXPENSE,
        platform: TransactionPlatform.BANESCO,
        currency: 'VES',
        amount: data.amount,
        description: this.buildDescription(data),
        method: PaymentMethod.PAGO_MOVIL,
      });

      ctx.session.pagoMovilData = undefined;
      ctx.session.currentTransactionId = transaction.id;
      ctx.session.waitingForDescription = true;
      ctx.session.reviewSingleItem = true;

      await ctx.reply(
        `✅ <b>Transaction Created!</b>\n\n` +
        `💸 Amount: VES ${data.amount.toFixed(2)}\n` +
        `Account: Banesco\n` +
        `Method: Pago Móvil\n` +
        `Status: Reviewed (ready to register)`,
        { parse_mode: 'HTML' },
      );

      await this.baseHandler.askForReply(ctx, DESCRIPTION_PROMPT);
    } catch (error) {
      this.logger.error(`Storing Pago Móvil as transaction failed: ${error?.message}`);
      await ctx.reply('❌ Error storing the transaction. Please try again.');
    }
  }

  /** A placeholder until the user names it, so the row is never blank. */
  private buildDescription(data: PagoMovilData): string {
    const target = data.bankName || data.phone || data.idDocument;
    return target ? `Pago Móvil ${target}` : 'Pago Móvil';
  }

  private async downloadImage(fileId: string, ctx: SessionContext): Promise<Buffer> {
    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    const httpsAgent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      timeout: 60000,
      family: 4,
    });

    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      httpsAgent,
      timeout: 60000,
    });

    return Buffer.from(response.data);
  }
}
