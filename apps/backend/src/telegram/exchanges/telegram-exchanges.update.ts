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
}
