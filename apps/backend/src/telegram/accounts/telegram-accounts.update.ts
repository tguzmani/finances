import { Update, Ctx, Command, Action } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { SessionContext } from '../telegram.types';
import { TelegramAccountsService } from './telegram-accounts.service';

@Update()
export class TelegramAccountsUpdate {
  private readonly logger = new Logger(TelegramAccountsUpdate.name);

  constructor(private readonly accountsService: TelegramAccountsService) {}

  @Command('accounts')
  @UseGuards(TelegramAuthGuard)
  async handleAccounts(@Ctx() ctx: SessionContext) {
    try {
      this.logger.log('Handling /accounts command');

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Binance Stablecoin', 'accounts_binance_stablecoin')],
      ]);

      await ctx.reply('<b>Accounts</b>\n\nSelect an option:', {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } catch (error) {
      this.logger.error(`Error in /accounts command: ${error.message}`);
      await ctx.reply('Error loading accounts menu. Please try again.');
    }
  }

  @Action('accounts_binance_stablecoin')
  @UseGuards(TelegramAuthGuard)
  async handleBinanceStablecoin(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      await ctx.reply('Fetching Binance stablecoin balance...');

      const message = await this.accountsService.getStablecoinBalanceMessage();
      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error(`Error fetching stablecoin balance: ${error.message}`);
      await ctx.reply('Error fetching balance. Please try again.');
    }
  }
}
