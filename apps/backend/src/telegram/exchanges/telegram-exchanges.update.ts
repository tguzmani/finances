import { Update, Ctx, Command, Action } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { TelegramService } from '../telegram.service';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { SessionContext } from '../telegram.types';
import { ExchangesService } from '../../exchanges/exchanges.service';
import { ExchangeStatus } from '@prisma/client';
import { TelegramBaseHandler } from '../telegram-base.handler';

@Update()
export class TelegramExchangesUpdate {
  private readonly logger = new Logger(TelegramExchangesUpdate.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly exchangesService: ExchangesService,
    private readonly baseHandler: TelegramBaseHandler,
  ) { }

  @Command('exchanges')
  @UseGuards(TelegramAuthGuard)
  async handleExchanges(@Ctx() ctx: SessionContext) {
    try {
      const message = await this.telegramService.exchanges.getRecentExchangesList();
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Show all', 'exchanges_show_all')],
      ]);
      await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
    } catch (error) {
      await ctx.reply('Error getting exchanges.');
    }
  }


  @Action('exchanges_show_all')
  @UseGuards(TelegramAuthGuard)
  async handleExchangesShowAll(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      const message = await this.telegramService.exchanges.getRecentExchangesList(true);
      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (error) {
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error getting all exchanges.');
    }
  }

  @Action('register_start_exchanges')
  @UseGuards(TelegramAuthGuard)
  async handleRegisterStartExchanges(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      await this.startExchangeRegistration(ctx);
    } catch (error) {
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error starting exchange registration.');
    }
  }

  @Action('register_confirm')
  @UseGuards(TelegramAuthGuard)
  async handleRegisterConfirm(@Ctx() ctx: SessionContext) {
    try {
      const exchangeIds = ctx.session.registerExchangeIds;
      const wavg = ctx.session.registerWavg;

      if (!exchangeIds || !wavg) {
        await ctx.answerCbQuery('Session expired. Please run /register again.');
        return;
      }

      await ctx.answerCbQuery('Registering exchanges...');

      // Perform registration
      await this.telegramService.exchanges.registerExchanges(exchangeIds, wavg);

      // Store IDs in session for undo
      ctx.session.lastRegisteredExchangeIds = exchangeIds;
      ctx.session.lastRegisteredWavg = wavg;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('↩️ Undo', 'register_ex_undo')],
      ]);

      await ctx.reply(
        `✅ <b>Registration Complete!</b>\n\n` +
        `Registered ${exchangeIds.length} exchanges\n` +
        `Exchange rate saved: ${wavg} VES/USD`,
        { parse_mode: 'HTML', ...keyboard }
      );

      // Don't clear session yet - keep it for undo
      // this.baseHandler.clearSession(ctx);
    } catch (error) {
      this.logger.error(`Error confirming registration: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error completing registration. Please try again.');
    }
  }

  @Action('register_ex_undo')
  @UseGuards(TelegramAuthGuard)
  async handleRegisterExUndo(@Ctx() ctx: SessionContext) {
    try {
      const exchangeIds = ctx.session.lastRegisteredExchangeIds;

      if (!exchangeIds || exchangeIds.length === 0) {
        await ctx.answerCbQuery('Nothing to undo.');
        return;
      }

      await ctx.answerCbQuery('Undoing registration...');

      // Revert exchanges back to REVIEWED status
      await Promise.all(
        exchangeIds.map(id =>
          this.exchangesService.update(id, {
            status: ExchangeStatus.REVIEWED,
          })
        )
      );

      // Note: The exchange rate remains in the database but exchanges are reverted
      // If needed, we could also delete the exchange rate, but that's more complex

      await ctx.reply(
        `↩️ <b>Registration Undone!</b>\n\n` +
        `${exchangeIds.length} exchanges reverted to REVIEWED status`,
        { parse_mode: 'HTML' }
      );

      // Clear session
      this.baseHandler.clearSession(ctx);
    } catch (error) {
      this.logger.error(`Error undoing exchange registration: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error undoing registration. Please try again.');
    }
  }

  @Action('register_update_rate_only')
  @UseGuards(TelegramAuthGuard)
  async handleRegisterUpdateRateOnly(@Ctx() ctx: SessionContext) {
    try {
      const wavg = ctx.session.registerWavg;

      if (!wavg) {
        await ctx.answerCbQuery('Session expired. Please run /register again.');
        return;
      }

      await ctx.answerCbQuery('Checking exchange rate...');

      // Update rate only (does not change exchange status)
      const result = await this.telegramService.exchanges.updateExchangeRateOnly(wavg);

      if (result.updated) {
        const message = this.telegramService.exchanges.formatExchangeRateUpdated(result.value);
        await ctx.reply(message, { parse_mode: 'HTML' });
      } else {
        const message = this.telegramService.exchanges.formatExchangeRateUnchanged(result.value);
        await ctx.reply(message, { parse_mode: 'HTML' });
      }

      // Don't clear session - user might still want to register or exit
    } catch (error) {
      this.logger.error(`Error updating exchange rate: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error updating exchange rate. Please try again.');
    }
  }


  async startExchangeRegistration(ctx: SessionContext) {
    try {
      // Get reviewed exchanges
      const reviewedExchanges = await this.telegramService.exchanges.getReviewedExchanges();

      if (reviewedExchanges.length === 0) {
        await ctx.reply('No reviewed exchanges to register.');
        return;
      }

      // Calculate metrics
      const metrics = this.telegramService.exchanges.calculateRegisterMetrics(reviewedExchanges);

      // Store in session for Register action
      ctx.session.registerExchangeIds = reviewedExchanges.map(e => e.id);
      ctx.session.registerWavg = metrics.wavg;

      // Format message
      const message = this.telegramService.exchanges.formatRegisterSummary({
        ...metrics,
        count: reviewedExchanges.length,
      });

      // Create keyboard with copy buttons and action buttons
      const keyboard = {
        inline_keyboard: [
          [
            {
              text: 'Copy Terminal List',
              copy_text: { text: metrics.terminalList }
            } as any
          ],
          [
            {
              text: `${metrics.wavg} VES/USD`,
              copy_text: { text: String(metrics.wavg) }
            } as any
          ],
          [
            {
              text: `${metrics.totalAmount} USD`,
              copy_text: { text: metrics.sumFormula }
            } as any
          ],
          [
            {
              text: '📊 Update Exchange Rate',
              callback_data: 'register_update_rate_only'
            }
          ],
          [
            {
              text: '✅ Register',
              callback_data: 'register_confirm'
            },
            {
              text: '🚫 Exit',
              callback_data: 'register_cancel'
            }
          ]
        ]
      };

      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: keyboard as any,
      });
    } catch (error) {
      this.logger.error(`Error starting exchange registration: ${error.message}`);
      await ctx.reply('Error starting exchange registration.');
    }
  }
}
