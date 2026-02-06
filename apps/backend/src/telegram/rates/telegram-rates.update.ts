import { Update, Ctx, Command } from 'nestjs-telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { SessionContext } from '../telegram.types';
import { TelegramRatesService } from './telegram-rates.service';

@Update()
export class TelegramRatesUpdate {
  private readonly logger = new Logger(TelegramRatesUpdate.name);

  constructor(
    private readonly ratesService: TelegramRatesService,
  ) {}

  @Command('rates')
  @UseGuards(TelegramAuthGuard)
  async handleRates(@Ctx() ctx: SessionContext) {
    try {
      this.logger.log('Handling /rates command');

      // Send "fetching" message
      await ctx.reply('⏳ Fetching rates...');

      const message = await this.ratesService.getRatesMessage();

      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error(`Error in /rates command: ${error.message}`);
      await ctx.reply('Error fetching rates. Please try again later.');
    }
  }
}
