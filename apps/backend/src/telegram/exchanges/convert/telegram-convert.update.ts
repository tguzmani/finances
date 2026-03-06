import { Update, Ctx, Command } from 'nestjs-telegraf';
import { UseGuards, Logger } from '@nestjs/common';
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

      const message = await this.convertService.handleConvert(ctx.message.text);
      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error(`Error in convert: ${error.message}`);
      await ctx.reply('Error performing conversion. Please try again later.');
    }
  }
}
