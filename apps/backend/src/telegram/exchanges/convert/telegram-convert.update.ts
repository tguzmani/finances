import { Update, Ctx, Command } from 'nestjs-telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { Markup } from 'telegraf';
import { TelegramAuthGuard } from '../../guards/telegram-auth.guard';
import { SessionContext } from '../../telegram.types';
import { TelegramConvertService } from './telegram-convert.service';

@Update()
export class TelegramConvertUpdate {
  private readonly logger = new Logger(TelegramConvertUpdate.name);

  constructor(
    private readonly convertService: TelegramConvertService,
  ) {}

  @Command('convert')
  @UseGuards(TelegramAuthGuard)
  async handleConvert(@Ctx() ctx: SessionContext) {
    ctx.session.convertWaitingForInput = true;
    await ctx.reply(
      'Enter amount and currency:\n' +
      '<i>Example: 100 USD, 8177.49 VES, 50 EUR</i>',
      { parse_mode: 'HTML' },
    );
  }

  async handleConvertInput(@Ctx() ctx: SessionContext) {
    if (!ctx.message || !('text' in ctx.message)) return;

    try {
      ctx.session.convertWaitingForInput = false;

      const result = await this.convertService.handleConvert(ctx.message.text);

      const buttons: any[][] = [];
      if (result.bcvAmount) {
        buttons.push([{ text: '📋 Copy BCV', copy_text: { text: result.bcvAmount.toFixed(2) } }]);
      }
      if (result.internalAmount) {
        buttons.push([{ text: '📋 Copy Internal', copy_text: { text: result.internalAmount.toFixed(2) } }]);
      }

      const extra: any = { parse_mode: 'HTML' };
      if (buttons.length > 0) {
        extra.reply_markup = { inline_keyboard: buttons };
      }

      await ctx.reply(result.message, extra);
    } catch (error) {
      this.logger.error(`Error in convert: ${error.message}`);
      await ctx.reply('Error performing conversion. Please try again later.');
    }
  }
}
