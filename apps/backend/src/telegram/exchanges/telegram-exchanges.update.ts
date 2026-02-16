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


  // ==================== Review One Exchange ====================

  @Action('review_one_exchange')
  @UseGuards(TelegramAuthGuard)
  async handleReviewOneExchange(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      ctx.session.reviewOneMode = 'waiting_for_ex_id';
      ctx.session.reviewOneType = 'exchange';

      await ctx.reply('🔢 Please enter the Exchange ID:', { reply_markup: { force_reply: true } });
    } catch (error) {
      await ctx.answerCbQuery('Error');
    }
  }

  async handleReviewOneExchangeId(ctx: SessionContext) {
    if (!('text' in ctx.message)) {
      return;
    }

    try {
      const idStr = ctx.message.text.trim();
      const id = parseInt(idStr, 10);

      if (isNaN(id)) {
        await ctx.reply('❌ Invalid ID. Please enter a numeric ID.');
        return;
      }

      const exchange = await this.exchangesService.findOne(id);

      if (!exchange) {
        await ctx.reply(`❌ Exchange with ID ${id} not found.`);
        return;
      }

      // Clear review one mode
      ctx.session.reviewOneMode = undefined;
      ctx.session.reviewOneType = undefined;
      ctx.session.currentExchangeId = exchange.id;
      ctx.session.reviewSingleItem = true;

      // Format exchange details
      const icon = exchange.tradeType === 'SELL' ? '💵' : '🪙';
      const tradeTypeLabel = exchange.tradeType === 'SELL' ? 'Sell' : 'Buy';
      const statusLabels: Record<string, string> = {
        'COMPLETED': 'Completed', 'PROCESSING': 'Processing', 'PENDING': 'Pending',
        'CANCELLED': 'Cancelled', 'FAILED': 'Failed', 'REVIEWED': 'Reviewed',
        'REJECTED': 'Rejected', 'REGISTERED': 'Registered',
      };
      const statusLabel = statusLabels[exchange.status] || exchange.status;

      const date = new Date(exchange.binanceCreatedAt).toLocaleDateString('es-VE', { timeZone: 'UTC' });
      const time = new Date(exchange.binanceCreatedAt).toLocaleTimeString('es-VE', {
        hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC',
      });

      const message =
        `<b>Exchange ID: ${id}</b>\n\n` +
        `${icon} <b>${exchange.asset} ${Number(exchange.amountGross).toFixed(2)}</b>\n` +
        `→ ${exchange.fiatSymbol} ${Number(exchange.fiatAmount).toFixed(2)}\n\n` +
        `Rate: ${Number(exchange.exchangeRate).toFixed(2)} VES/USD\n` +
        `Type: ${tradeTypeLabel}\n` +
        `Status: ${statusLabel}\n` +
        `Date: ${date} ${time}` +
        (exchange.counterparty ? `\nCounterparty: ${exchange.counterparty}` : '');

      const buttons = [
        [
          Markup.button.callback('❌ Reject', 'review_one_ex_reject'),
          Markup.button.callback('🚫 Cancel', 'review_one_ex_cancel'),
        ],
      ];

      const sentMessage = await ctx.reply(message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons),
      });

      // Store the message ID for editing later
      ctx.session.registerMessageId = sentMessage.message_id;
    } catch (error) {
      this.logger.error(`Error loading exchange by ID: ${error.message}`);
      await ctx.reply('❌ Error loading exchange. Please try again.');
    }
  }

  @Action('review_one_ex_reject')
  @UseGuards(TelegramAuthGuard)
  async handleReviewOneExReject(@Ctx() ctx: SessionContext) {
    try {
      const exchangeId = ctx.session.currentExchangeId;

      if (!exchangeId) {
        await ctx.answerCbQuery('No active exchange');
        return;
      }

      await this.exchangesService.update(exchangeId, {
        status: ExchangeStatus.REJECTED,
      });

      await ctx.answerCbQuery('Rejected');

      // Edit the message to show rejection
      if (ctx.callbackQuery?.message) {
        const originalText = 'text' in ctx.callbackQuery.message ? ctx.callbackQuery.message.text : '';
        await ctx.editMessageText(
          originalText + '\n\n❌ <b>REJECTED</b>',
          { parse_mode: 'HTML' }
        );
      }

      this.baseHandler.clearSession(ctx);
    } catch (error) {
      this.logger.error(`Error rejecting exchange: ${error.message}`);
      await ctx.answerCbQuery('Error');
    }
  }

  @Action('review_one_ex_cancel')
  @UseGuards(TelegramAuthGuard)
  async handleReviewOneExCancel(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Cancelled');

      // Edit the message to remove buttons
      if (ctx.callbackQuery?.message) {
        const originalText = 'text' in ctx.callbackQuery.message ? ctx.callbackQuery.message.text : '';
        await ctx.editMessageText(
          originalText + '\n\n🚫 <i>Review cancelled</i>',
          { parse_mode: 'HTML' }
        );
      }

      this.baseHandler.clearSession(ctx);
    } catch (error) {
      this.logger.error(`Error cancelling exchange review: ${error.message}`);
      await ctx.answerCbQuery('Error');
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
