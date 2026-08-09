import { Update, Ctx, Command } from 'nestjs-telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { SessionContext } from '../telegram.types';
import { DcaPricesService } from '../../dca/dca-prices.service';

@Update()
export class TelegramDcaUpdate {
  private readonly logger = new Logger(TelegramDcaUpdate.name);

  constructor(private readonly dcaPricesService: DcaPricesService) {}

  @Command('dca_prices')
  @UseGuards(TelegramAuthGuard)
  async handleDcaPrices(@Ctx() ctx: SessionContext) {
    try {
      this.logger.log('Handling /dca_prices command');
      await ctx.reply('⏳ Refreshing DCA prices from Binance...');

      const { assets, written, missing } = await this.dcaPricesService.refreshPrices();

      let message = `✅ <b>DCA prices updated</b>\n\nAssets: ${written}/${assets}`;
      if (missing.length > 0) {
        message += `\n⚠️ No Binance price for: ${missing.join(', ')}`;
      }

      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error(`Error in /dca_prices command: ${error.message}`);
      await ctx.reply('Error refreshing DCA prices. Please try again later.');
    }
  }
}
