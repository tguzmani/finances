import { Update, Ctx, Command, Action } from 'nestjs-telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { TelegramAuthGuard } from '../../guards/telegram-auth.guard';
import { SessionContext } from '../../telegram.types';
import { TelegramConvertService } from './telegram-convert.service';
import { TelegramBaseHandler } from '../../telegram-base.handler';

@Update()
export class TelegramConvertUpdate {
  private readonly logger = new Logger(TelegramConvertUpdate.name);

  constructor(
    private readonly convertService: TelegramConvertService,
    private readonly baseHandler: TelegramBaseHandler,
  ) {}

  @Command('convert')
  @UseGuards(TelegramAuthGuard)
  async handleConvert(@Ctx() ctx: SessionContext) {
    ctx.session.convertWaitingForInput = true;
    await ctx.reply(
      'Enter amount and currency:\n' +
      '<i>Any format works: 100 USD, $18,68, 27.837,82 bs, 50 euros</i>',
      { parse_mode: 'HTML' },
    );
  }

  async handleConvertInput(@Ctx() ctx: SessionContext) {
    if (!ctx.message || !('text' in ctx.message)) return;

    try {
      ctx.session.convertWaitingForInput = false;

      const result = await this.baseHandler.withTyping(ctx, () =>
        this.convertService.handleConvert((ctx.message as { text: string }).text),
      );

      const buttons: any[][] = [];
      if (result.bcvAmount) {
        buttons.push([{ text: '📋 Copy BCV', copy_text: { text: result.bcvAmount.toFixed(2) } }]);
        ctx.session.convertVesAmount = result.bcvAmount;
        ctx.session.convertRatesSnapshot = result.rates;
      }
      if (result.internalAmount) {
        buttons.push([{ text: '📋 Copy Internal', copy_text: { text: result.internalAmount.toFixed(2) } }]);
      }
      if (result.bcvAmount) {
        buttons.push([{ text: '🏦 Check with Banesco', callback_data: 'convert_check_banesco' }]);
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

  @Action('convert_check_banesco')
  async handleCheckBanesco(@Ctx() ctx: SessionContext) {
    const vesAmount = ctx.session.convertVesAmount;
    const rates = ctx.session.convertRatesSnapshot;

    if (!vesAmount || !rates) {
      await ctx.answerCbQuery('No conversion data available');
      return;
    }

    try {
      await ctx.answerCbQuery();
      const banescoLine = await this.convertService.checkBanesco(vesAmount, rates);

      const currentMessage = (ctx.callbackQuery as any)?.message;
      if (currentMessage && 'text' in currentMessage) {
        await ctx.editMessageText(currentMessage.text + '\n' + banescoLine, { parse_mode: 'HTML' });
      }
    } catch (error) {
      this.logger.error(`Error checking Banesco: ${error.message}`);
      await ctx.answerCbQuery('Error checking Banesco balance');
    }
  }
}
