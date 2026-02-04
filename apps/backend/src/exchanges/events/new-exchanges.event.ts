import { Exchange } from '@prisma/client';

export class NewExchangesEvent {
  constructor(
    public readonly exchanges: Exchange[],
  ) {}
}
