import { Module } from '@nestjs/common';
import { TransactionGroupsService } from './transaction-groups.service';
import { TransactionGroupsController } from './transaction-groups.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TransactionGroupsController],
  providers: [TransactionGroupsService],
  exports: [TransactionGroupsService],
})
export class TransactionGroupsModule {}
