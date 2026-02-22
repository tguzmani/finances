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
    try {
      const text = 'text' in ctx.message ? ctx.message.text : '';
      const input = text.replace(/^\/convert\s*/, '');

      const message = await this.convertService.handleConvert(input);
      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error(`Error in convert command: ${error.message}`);
      await ctx.reply('Error performing conversion. Please try again later.');
    }
  }
}
