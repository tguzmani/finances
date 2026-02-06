import { Module, Logger } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { session } from 'telegraf';
import { TelegramUpdate } from './telegram.update';
import { TelegramService } from './telegram.service';
import { TelegramAuthGuard } from './guards/telegram-auth.guard';
import { TelegramBotInit } from './telegram-bot.init';
import { TelegramExchangesService } from './exchanges/telegram-exchanges.service';
import { TelegramExchangesPresenter } from './exchanges/telegram-exchanges.presenter';
import { TelegramTransactionsService } from './transactions/telegram-transactions.service';
import { TelegramTransactionsPresenter } from './transactions/telegram-transactions.presenter';
import { TelegramGroupsPresenter } from './transactions/telegram-groups.presenter';
import { TelegramNotificationListener } from './listeners/telegram-notification.listener';
import { TelegramBaseHandler } from './telegram-base.handler';
import { TelegramTransactionsUpdate } from './transactions/telegram-transactions.update';
import { TelegramManualTransactionUpdate } from './transactions/telegram-manual-transaction.update';
import { TelegramExchangesUpdate } from './exchanges/telegram-exchanges.update';
import { TelegramRatesUpdate } from './rates/telegram-rates.update';
import { TelegramRatesService } from './rates/telegram-rates.service';
import { TelegramRatesPresenter } from './rates/telegram-rates.presenter';
import { TelegramRatesScheduler } from './rates/telegram-rates.scheduler';
import { TransactionsModule } from '../transactions/transactions.module';
import { ExchangesModule } from '../exchanges/exchanges.module';
import { TransactionGroupsModule } from '../transaction-groups/transaction-groups.module';
import { PagoMovilOcrService } from '../transactions/pago-movil-ocr.service';
import { PagoMovilParser } from '../transactions/pago-movil.parser';
import * as https from 'https';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      useFactory: () => {
        const logger = new Logger('TelegramModule');
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const enabled = process.env.TELEGRAM_BOT_ENABLED;

        if (enabled !== 'true') {
          logger.warn('⚠️  Telegram bot is disabled via TELEGRAM_BOT_ENABLED env var');
          throw new Error('Telegram bot is disabled via TELEGRAM_BOT_ENABLED env var');
        }

        if (!token) {
          logger.error('❌ TELEGRAM_BOT_TOKEN is required');
          throw new Error('TELEGRAM_BOT_TOKEN is required');
        }

        logger.log('🤖 Initializing Telegram bot...');

        // Custom HTTPS agent to handle SSL/TLS issues
        const agent = new https.Agent({
          keepAlive: true,
          keepAliveMsecs: 30000,
          timeout: 60000,
          family: 4, // Force IPv4 to avoid IPv6 issues
        });

        return {
          token,
          middlewares: [session()],
          launchOptions: {
            webhook: undefined, // Use long polling (simpler, no SSL needed)
          },
          options: {
            telegram: {
              agent,
            },
          },
        };
      },
    }),
    TransactionsModule,      // Para usar TransactionsService
    ExchangesModule,         // Para usar ExchangesService
    TransactionGroupsModule, // Para usar TransactionGroupsService
  ],
  providers: [
    TelegramUpdate,
    TelegramService,
    TelegramAuthGuard,
    TelegramBotInit,
    TelegramExchangesService,
    TelegramExchangesPresenter,
    TelegramTransactionsService,
    TelegramTransactionsPresenter,
    TelegramGroupsPresenter,
    TelegramNotificationListener,
    TelegramBaseHandler,
    TelegramTransactionsUpdate,
    TelegramManualTransactionUpdate,
    TelegramExchangesUpdate,
    TelegramRatesUpdate,
    TelegramRatesService,
    TelegramRatesPresenter,
    TelegramRatesScheduler,
    PagoMovilOcrService,
    PagoMovilParser,
  ],
  exports: [TelegramService],
})
export class TelegramModule {}
