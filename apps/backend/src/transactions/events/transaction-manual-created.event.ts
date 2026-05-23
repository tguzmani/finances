import { Transaction } from '@prisma/client';

export class TransactionManualCreatedEvent {
  constructor(public readonly transaction: Transaction) {}
}
