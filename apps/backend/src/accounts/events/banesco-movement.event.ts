/**
 * Emitted every time something is written to the ledger that moves money in or
 * out of Banesco: a P2P sell landing as "Binance a Banesco", any transaction
 * whose platform is BANESCO (regardless of payment method), a transfer with
 * Banesco on either leg, or a manual balance adjustment.
 *
 * The listener answers a single question: how much is left in Banesco now.
 */
export const BANESCO_MOVEMENT_EVENT = 'banesco.movement';

export class BanescoMovementEvent {
  constructor(
    /** Short human label for what moved, shown in the balance message. */
    public readonly reason: string,
  ) {}
}
