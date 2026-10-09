import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { SubscriptionsSheetsService } from './subscriptions-sheets.service';
import { SubscriptionMatchService } from './subscription-match.service';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [CommonModule],
  providers: [SubscriptionsSheetsService, SubscriptionMatchService, SubscriptionsService],
  exports: [SubscriptionsService, SubscriptionsSheetsService],
})
export class SubscriptionsModule {}
