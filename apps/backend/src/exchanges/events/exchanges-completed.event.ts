import { Exchange } from '@prisma/client';

export class ExchangesCompletedEvent {
  constructor(public readonly exchanges: Exchange[]) {}
}
