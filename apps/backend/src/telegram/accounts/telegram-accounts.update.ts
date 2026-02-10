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
        [Markup.button.callback('Update Banesco', 'accounts_update_banesco')],
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

  @Action('accounts_update_banesco')
  @UseGuards(TelegramAuthGuard)
  async handleUpdateBanesco(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      ctx.session.waitingForBanescoAmount = true;
      await ctx.reply('Enter new Banesco balance amount (in Bs):');
    } catch (error) {
      this.logger.error(`Error starting Banesco update: ${error.message}`);
      await ctx.reply('Error starting update. Please try again.');
    }
  }

  // Public method to be called by the central text handler
  async handleBanescoAmountInput(@Ctx() ctx: SessionContext) {
    try {
      // Type guard to ensure we have a text message
      if (!ctx.message || !('text' in ctx.message)) {
        return;
      }

      const text = ctx.message.text;
      if (!text) return;

      const amount = parseFloat(text.replace(/,/g, ''));

      if (isNaN(amount) || amount < 0) {
        await ctx.reply('❌ Invalid amount. Please enter a valid positive number.');
        return;
      }

      ctx.session.waitingForBanescoAmount = false;

      await ctx.reply('⏳ Updating Banesco balance...');

      const result = await this.accountsService.adjustBanescoBalance(amount);
      await ctx.reply(result.message);
    } catch (error) {
      ctx.session.waitingForBanescoAmount = false;
      this.logger.error(`Error updating Banesco balance: ${error.message}`);
      await ctx.reply('❌ Error updating balance. Please try again.');
    }
  }
}
