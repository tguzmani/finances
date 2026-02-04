import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { ExchangesModule } from '../exchanges/exchanges.module';
import { TelegramModule } from '../telegram/telegram.module';

const isTelegramEnabled = process.env.TELEGRAM_BOT_ENABLED === 'true';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    TransactionsModule,
    ExchangesModule,
    ...(isTelegramEnabled ? [TelegramModule] : []),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
