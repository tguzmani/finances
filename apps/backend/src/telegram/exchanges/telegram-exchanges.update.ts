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

  @Action('review_start_exchanges')
  @UseGuards(TelegramAuthGuard)
  async handleReviewStartExchanges(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      ctx.session.reviewType = 'exchanges';

      // Initialize progress tracking
      const totalCount = await this.telegramService.exchanges.getPendingReviewCount();
      this.baseHandler.initializeReviewProgress(ctx, totalCount);

      await this.showNextExchange(ctx);
    } catch (error) {
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error starting exchange review.');
    }
  }

  @Action('review_one_exchange')
  @UseGuards(TelegramAuthGuard)
  async handleReviewOneExchange(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      ctx.session.reviewOneMode = 'waiting_for_ex_id';
      ctx.session.reviewOneType = 'exchange';

      await ctx.reply(
        '🔢 Please enter the Exchange ID:',
        { reply_markup: { force_reply: true } }
      );
    } catch (error) {
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error. Please try again.');
    }
  }

  @Action('review_exchange_accept')
  @UseGuards(TelegramAuthGuard)
  async handleExchangeAccept(@Ctx() ctx: SessionContext) {
    try {
      const exchangeId = ctx.session.currentExchangeId;

      if (!exchangeId) {
        await ctx.answerCbQuery('No active exchange');
        return;
      }

      // Update exchange status to REVIEWED
      await this.exchangesService.update(exchangeId, {
        status: ExchangeStatus.REVIEWED,
      });

      await ctx.answerCbQuery('Exchange accepted');
      await ctx.reply('✅ Exchange accepted');

      // If single item review, end the flow. Otherwise show next
      if (ctx.session.reviewSingleItem) {
        this.baseHandler.clearSession(ctx);
      } else {
        await this.showNextExchange(ctx);
      }
    } catch (error) {
      await ctx.answerCbQuery('Error accepting exchange');
    }
  }

  @Action('review_exchange_reject')
  @UseGuards(TelegramAuthGuard)
  async handleExchangeReject(@Ctx() ctx: SessionContext) {
    try {
      const exchangeId = ctx.session.currentExchangeId;

      if (!exchangeId) {
        await ctx.answerCbQuery('No active exchange');
        return;
      }

      // Update exchange status to REJECTED
      await this.exchangesService.update(exchangeId, {
        status: ExchangeStatus.REJECTED,
      });

      await ctx.answerCbQuery('Exchange rejected');
      await ctx.reply('❌ Exchange rejected');

      // If single item review, end the flow. Otherwise show next
      if (ctx.session.reviewSingleItem) {
        this.baseHandler.clearSession(ctx);
      } else {
        await this.showNextExchange(ctx);
      }
    } catch (error) {
      await ctx.answerCbQuery('Error rejecting exchange');
    }
  }

  @Action('review_exchange_skip')
  @UseGuards(TelegramAuthGuard)
  async handleExchangeSkip(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Skipped');
      await ctx.reply('⏭️ Skipped');

      // If single item review, end the flow. Otherwise show next
      if (ctx.session.reviewSingleItem) {
        this.baseHandler.clearSession(ctx);
      } else {
        await this.showNextExchange(ctx);
      }
    } catch (error) {
      await ctx.answerCbQuery('Error');
    }
  }

  @Action(/^notification_ex_accept_(\d+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleNotificationExchangeAccept(@Ctx() ctx: SessionContext) {
    try {
      const match = ctx.match;
      if (!match || !match[1]) {
        await ctx.answerCbQuery('Invalid exchange ID');
        return;
      }

      const exchangeId = parseInt(match[1], 10);

      // Update exchange status to REVIEWED
      await this.exchangesService.update(exchangeId, {
        status: ExchangeStatus.REVIEWED,
      });

      await ctx.answerCbQuery('Exchange accepted');
      await ctx.editMessageText(
        `${ctx.callbackQuery?.message?.text || ''}\n\n✅ <b>Accepted</b>`,
        { parse_mode: 'HTML' }
      );

      this.logger.log(`Exchange ${exchangeId} accepted from notification`);
    } catch (error) {
      this.logger.error(`Error accepting exchange from notification: ${error.message}`);
      await ctx.answerCbQuery('Error accepting exchange');
    }
  }

  @Action(/^notification_ex_reject_(\d+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleNotificationExchangeReject(@Ctx() ctx: SessionContext) {
    try {
      const match = ctx.match;
      if (!match || !match[1]) {
        await ctx.answerCbQuery('Invalid exchange ID');
        return;
      }

      const exchangeId = parseInt(match[1], 10);

      // Update exchange status to REJECTED
      await this.exchangesService.update(exchangeId, {
        status: ExchangeStatus.REJECTED,
      });

      await ctx.answerCbQuery('Exchange rejected');
      await ctx.editMessageText(
        `${ctx.callbackQuery?.message?.text || ''}\n\n❌ <b>Rejected</b>`,
        { parse_mode: 'HTML' }
      );

      this.logger.log(`Exchange ${exchangeId} rejected from notification`);
    } catch (error) {
      this.logger.error(`Error rejecting exchange from notification: ${error.message}`);
      await ctx.answerCbQuery('Error rejecting exchange');
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

  private async showNextExchange(ctx: SessionContext) {
    try {
      const exchange = await this.telegramService.exchanges.getNextForReview();

      if (!exchange) {
        await ctx.reply('✅ No more exchanges to review!');
        this.baseHandler.clearSession(ctx);
        return;
      }

      // Store previous exchange ID in history before moving to next
      if (ctx.session.currentExchangeId) {
        this.baseHandler.addToReviewHistory(ctx, 'exchanges', ctx.session.currentExchangeId);
      }

      // Increment progress index
      this.baseHandler.incrementReviewIndex(ctx);

      // Store current exchange in session
      ctx.session.currentExchangeId = exchange.id;

      const message = this.telegramService.exchanges.formatExchangeForReview(exchange);

      // Build title with progress
      const progressText = this.baseHandler.buildProgressText(
        ctx.session.reviewCurrentIndex,
        ctx.session.reviewTotalCount
      );
      const titleWithProgress = message.replace(
        '<b>Exchange Review</b>',
        `<b>Exchange Review${progressText}</b>`
      );

      // Add "Go Back" button if there's history
      const hasHistory = this.baseHandler.hasReviewHistory(ctx, 'exchanges');

      const buttons = [];

      buttons.push(
        [
          Markup.button.callback('✅ Accept', 'review_exchange_accept'),
          Markup.button.callback('❌ Reject', 'review_exchange_reject'),
        ],
        [
          Markup.button.callback('⏭️ Skip', 'review_exchange_skip'),
        ]
      );

      if (hasHistory) {
        buttons.push([
          Markup.button.callback('⬅️ Go Back', 'review_go_back'),
        ]);
      }

      // Only show Stop button when reviewing multiple items (not in review_one mode)
      if (!ctx.session.reviewSingleItem) {
        buttons.push([
          Markup.button.callback('🚫 Stop', 'review_cancel'),
        ]);
      }

      const keyboard = Markup.inlineKeyboard(buttons);

      await ctx.reply(
        titleWithProgress,
        {
          parse_mode: 'HTML',
          ...keyboard,
        }
      );
    } catch (error) {
      this.logger.error(`Error showing next exchange: ${error.message}`);
      await ctx.reply('Error loading exchange.');
    }
  }

  public async handleReviewOneExchangeIdPublic(ctx: SessionContext) {
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

      // Fetch exchange
      const exchange = await this.exchangesService.findOne(id);

      if (!exchange) {
        await ctx.reply(`❌ Exchange with ID ${id} not found.`);
        return;
      }

      // Clear review one mode and set up normal review mode
      ctx.session.reviewOneMode = undefined;
      ctx.session.reviewOneType = undefined;
      ctx.session.reviewType = 'exchanges';
      ctx.session.reviewSingleItem = true; // Mark as single item review
      ctx.session.currentExchangeId = exchange.id;

      const message = this.telegramService.exchanges.formatExchangeForReview(exchange);

      const buttons = [
        [
          Markup.button.callback('✅ Accept', 'review_exchange_accept'),
          Markup.button.callback('❌ Reject', 'review_exchange_reject'),
        ],
      ];

      // Add Skip and optionally Stop buttons
      const lastRow = [Markup.button.callback('⏭️ Skip', 'review_exchange_skip')];
      if (!ctx.session.reviewSingleItem) {
        lastRow.push(Markup.button.callback('🚫 Stop', 'review_cancel'));
      }
      buttons.push(lastRow);

      const keyboard = Markup.inlineKeyboard(buttons);

      await ctx.reply(
        `<b>Exchange ID: ${id}</b>\n\n` + message,
        {
          parse_mode: 'HTML',
          ...keyboard,
        }
      );
    } catch (error) {
      this.logger.error(`Error loading exchange by ID: ${error.message}`);
      await ctx.reply('❌ Error loading exchange. Please try again.');
    }
  }

  public async showPreviousExchangePublic(ctx: SessionContext) {
    try {
      const previousId = this.baseHandler.popFromReviewHistory(ctx, 'exchanges');

      if (previousId === null) {
        await ctx.reply('⚠️ No previous exchange to go back to.');
        return;
      }

      // Decrement progress index
      this.baseHandler.decrementReviewIndex(ctx);

      // Fetch the exchange
      const exchange = await this.exchangesService.findOne(previousId);

      if (!exchange) {
        await ctx.reply('❌ Previous exchange not found.');
        return;
      }

      // Update current exchange ID
      ctx.session.currentExchangeId = exchange.id;

      const message = this.telegramService.exchanges.formatExchangeForReview(exchange);

      // Build title with progress
      const progressText = this.baseHandler.buildProgressText(
        ctx.session.reviewCurrentIndex,
        ctx.session.reviewTotalCount
      );
      const titleWithProgress = message.replace(
        '<b>Exchange Review</b>',
        `<b>Exchange Review${progressText}</b>`
      );

      // Check if there's still more history
      const hasHistory = this.baseHandler.hasReviewHistory(ctx, 'exchanges');

      const buttons = [];

      buttons.push(
        [
          Markup.button.callback('✅ Accept', 'review_exchange_accept'),
          Markup.button.callback('❌ Reject', 'review_exchange_reject'),
        ],
        [
          Markup.button.callback('⏭️ Skip', 'review_exchange_skip'),
        ]
      );

      if (hasHistory) {
        buttons.push([
          Markup.button.callback('⬅️ Go Back', 'review_go_back'),
        ]);
      }

      // Only show Stop button when reviewing multiple items (not in review_one mode)
      if (!ctx.session.reviewSingleItem) {
        buttons.push([
          Markup.button.callback('🚫 Stop', 'review_cancel'),
        ]);
      }

      const keyboard = Markup.inlineKeyboard(buttons);

      await ctx.reply(
        titleWithProgress,
        {
          parse_mode: 'HTML',
          ...keyboard,
        }
      );
    } catch (error) {
      this.logger.error(`Error showing previous exchange: ${error.message}`);
      await ctx.reply('Error loading previous exchange.');
    }
  }

  private async startExchangeRegistration(ctx: SessionContext) {
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
