import { Injectable, Logger } from '@nestjs/common';
import { Markup } from 'telegraf';
import { SessionContext } from '../telegram.types';
import { TelegramPagoMovilService } from './telegram-pago-movil.service';
import { TelegramPagoMovilPresenter } from './telegram-pago-movil.presenter';
import { PagoMovilData } from '../../transactions/ocr/parsers/pago-movil-llm-parser.service';
import axios from 'axios';
import * as https from 'https';

@Injectable()
export class TelegramPagoMovilUpdate {
  private readonly logger = new Logger(TelegramPagoMovilUpdate.name);

  constructor(
    private readonly pagoMovilService: TelegramPagoMovilService,
    private readonly presenter: TelegramPagoMovilPresenter,
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

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons } as any,
    });
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
