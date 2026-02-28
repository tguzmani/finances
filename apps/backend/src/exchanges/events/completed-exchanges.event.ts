import { Exchange } from '@prisma/client';

export class CompletedExchangesEvent {
  constructor(
    public readonly exchanges: Exchange[],
  ) {}
}
