import { Transaction } from '@prisma/client';

export class NewTransactionsEvent {
  constructor(
    public readonly transactions: Transaction[],
    public readonly totalAmount: number,
    public readonly currency: string,
  ) {}
}
