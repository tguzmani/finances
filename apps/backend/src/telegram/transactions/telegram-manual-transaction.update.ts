import { Update, Ctx, Action } from 'nestjs-telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { SessionContext } from '../telegram.types';
import { TransactionsService } from '../../transactions/transactions.service';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { TelegramBaseHandler } from '../telegram-base.handler';

@Update()
export class TelegramManualTransactionUpdate {
  private readonly logger = new Logger(TelegramManualTransactionUpdate.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly baseHandler: TelegramBaseHandler,
  ) {
    this.logger.log('TelegramManualTransactionUpdate instantiated');
  }

  async handleAddTransaction(@Ctx() ctx: SessionContext) {
    this.logger.log('handleAddTransaction');
    try {
      // Clear any existing session data
      this.baseHandler.clearSession(ctx);

      await ctx.reply(
        '➕ <b>Manual Transaction Entry</b>\n\n' +
        'What type of transaction is this?',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '💰 Income', callback_data: 'manual_type_INCOME' },
                { text: '💸 Expense', callback_data: 'manual_type_EXPENSE' },
              ],
              [
                { text: '🚫 Cancel', callback_data: 'manual_cancel' },
              ],
            ],
          },
        }
      );

      ctx.session.manualTransactionState = 'waiting_type';
    } catch (error) {
      this.logger.error(`Error starting manual transaction: ${error.message}`);
      await ctx.reply('Error starting manual entry. Please try again.');
    }
  }

  @Action(/^manual_type_(.+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleManualType(@Ctx() ctx: SessionContext) {
    try {
      const match = (ctx as any).match as RegExpMatchArray;
      const type = match[1] as 'INCOME' | 'EXPENSE';

      await ctx.answerCbQuery();

      ctx.session.manualTransactionType = type;
      ctx.session.manualTransactionState = 'waiting_account';

      const typeLabel = type === 'INCOME' ? '💰 Income' : '💸 Expense';

      await ctx.reply(
        `${typeLabel} transaction\n\n` +
        'Which account?',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🏦 Bank of America', callback_data: 'manual_account_BANK_OF_AMERICA' },
              ],
              [
                { text: '🏦 Banesco', callback_data: 'manual_account_BANESCO' },
              ],
              [
                { text: '💱 Binance', callback_data: 'manual_account_BINANCE' },
              ],
              [
                { text: '👛 Wallet', callback_data: 'manual_account_WALLET' },
                { text: '💵 Cash Box', callback_data: 'manual_account_CASH_BOX' },
              ],
              [
                { text: '🚫 Cancel', callback_data: 'manual_cancel' },
              ],
            ],
          },
        }
      );
    } catch (error) {
      this.logger.error(`Error handling manual type: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error processing selection. Please try again.');
    }
  }

  @Action(/^manual_account_(.+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleManualAccount(@Ctx() ctx: SessionContext) {
    try {
      const match = (ctx as any).match as RegExpMatchArray;
      const platform = match[1];

      await ctx.answerCbQuery();

      ctx.session.manualTransactionPlatform = platform;

      // Infer currency
      const currency = this.transactionsService.getCurrencyForPlatform(platform as any);
      ctx.session.manualTransactionCurrency = currency;

      // Get available payment methods
      const methods = this.transactionsService.getAvailablePaymentMethods(platform as any);

      if (methods.length === 0) {
        // Skip payment method for Wallet/Cash Box
        ctx.session.manualTransactionState = 'waiting_amount';

        await ctx.reply(
          `Account: ${this.getPlatformLabel(platform)}\n` +
          `Currency: ${currency}\n\n` +
          'Enter the amount:',
          { parse_mode: 'HTML' }
        );
      } else {
        // Show payment method options
        ctx.session.manualTransactionState = 'waiting_method';

        const buttons = methods.map(method => [
          { text: this.getMethodLabel(method), callback_data: `manual_method_${method}` }
        ]);

        buttons.push([{ text: '🚫 Cancel', callback_data: 'manual_cancel' }]);

        await ctx.reply(
          `Account: ${this.getPlatformLabel(platform)}\n` +
          `Currency: ${currency}\n\n` +
          'Select payment method:',
          {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: buttons },
          }
        );
      }
    } catch (error) {
      this.logger.error(`Error handling manual account: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error processing selection. Please try again.');
    }
  }

  @Action(/^manual_method_(.+)$/)
  @UseGuards(TelegramAuthGuard)
  async handleManualMethod(@Ctx() ctx: SessionContext) {
    try {
      const match = (ctx as any).match as RegExpMatchArray;
      const method = match[1];

      await ctx.answerCbQuery();

      ctx.session.manualTransactionMethod = method;
      ctx.session.manualTransactionState = 'waiting_amount';

      await ctx.reply(
        `Payment method: ${this.getMethodLabel(method)}\n\n` +
        'Enter the amount:',
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      this.logger.error(`Error handling manual method: ${error.message}`);
      await ctx.answerCbQuery('Error');
      await ctx.reply('Error processing selection. Please try again.');
    }
  }

  // This method is called by TelegramTransactionsUpdate when in manual transaction state
  async handleManualAmountOrDescription(@Ctx() ctx: SessionContext) {
    // Type guard for text messages
    if (!('text' in ctx.message)) {
      return;
    }

    try {
      const text = ctx.message.text.trim();

      if (ctx.session.manualTransactionState === 'waiting_amount') {
        // Parse amount
        const amount = parseFloat(text.replace(/,/g, ''));

        if (isNaN(amount) || amount <= 0) {
          await ctx.reply('Invalid amount. Please enter a positive number.');
          return;
        }

        ctx.session.manualTransactionAmount = amount;
        ctx.session.manualTransactionState = 'waiting_description';

        await ctx.reply(
          `Amount: ${ctx.session.manualTransactionCurrency} ${amount.toFixed(2)}\n\n` +
          'Enter a description for this transaction:',
          { parse_mode: 'HTML' }
        );
      } else if (ctx.session.manualTransactionState === 'waiting_description') {
        // Save description and create transaction
        const description = text;

        await ctx.reply('Creating transaction...');

        const transaction = await this.transactionsService.createManualTransaction({
          type: ctx.session.manualTransactionType as any,
          platform: ctx.session.manualTransactionPlatform as any,
          currency: ctx.session.manualTransactionCurrency!,
          amount: ctx.session.manualTransactionAmount!,
          description,
          method: ctx.session.manualTransactionMethod as any || undefined,
        });

        // Format success message
        const typeIcon = transaction.type === 'INCOME' ? '💰' : '💸';
        const platformLabel = this.getPlatformLabel(transaction.platform);
        const methodLabel = transaction.method ? this.getMethodLabel(transaction.method) : 'N/A';

        await ctx.reply(
          `✅ <b>Transaction Created!</b>\n\n` +
          `${typeIcon} <b>${description}</b>\n\n` +
          `Amount: ${transaction.currency} ${Number(transaction.amount).toFixed(2)}\n` +
          `Account: ${platformLabel}\n` +
          `Method: ${methodLabel}\n` +
          `Status: Reviewed (ready to register)`,
          { parse_mode: 'HTML' }
        );

        // Clear session
        this.baseHandler.clearSession(ctx);
      }
    } catch (error) {
      this.logger.error(`Error handling manual text input: ${error.message}`);
      await ctx.reply('Error processing input. Please try again or use /add_transaction to restart.');
      this.baseHandler.clearSession(ctx);
    }
  }

  @Action('manual_cancel')
  @UseGuards(TelegramAuthGuard)
  async handleManualCancel(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery('Cancelled');
      await ctx.reply('❌ Manual transaction entry cancelled.');
      this.baseHandler.clearSession(ctx);
    } catch (error) {
      this.logger.error(`Error cancelling manual transaction: ${error.message}`);
    }
  }

  private getPlatformLabel(platform: string): string {
    const labels: Record<string, string> = {
      'BANESCO': 'Banesco',
      'BANK_OF_AMERICA': 'Bank of America',
      'BINANCE': 'Binance',
      'WALLET': 'Wallet',
      'CASH_BOX': 'Cash Box',
    };
    return labels[platform] || platform;
  }

  private getMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      'DEBIT_CARD': 'Debit Card',
      'PAGO_MOVIL': 'Pago Móvil',
      'ZELLE': 'Zelle',
      'CREDIT_CARD': 'Credit Card',
      'BINANCE_PAY': 'Binance Pay',
      'DEPOSIT': 'Deposit',
      'WITHDRAWAL': 'Withdrawal',
    };
    return labels[method] || method;
  }
}
