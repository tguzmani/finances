import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { ExchangesModule } from '../exchanges/exchanges.module';
import { TransactionGroupsModule } from '../transaction-groups/transaction-groups.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AccountsModule } from '../accounts/accounts.module';
import { ExpensesModule } from '../expenses/expenses.module';

const isTelegramEnabled = process.env.TELEGRAM_BOT_ENABLED === 'true';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    TransactionsModule,
    ExchangesModule,
    TransactionGroupsModule,
    AccountsModule,
    ExpensesModule,
    ...(isTelegramEnabled ? [TelegramModule] : []),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
