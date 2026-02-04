import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { ExchangesModule } from '../exchanges/exchanges.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    TransactionsModule,
    ExchangesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
