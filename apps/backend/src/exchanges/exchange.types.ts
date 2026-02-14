export enum ExchangeStatus {
  COMPLETED = 'COMPLETED',
  PROCESSING = 'PROCESSING',
  PENDING = 'PENDING',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
  REVIEWED = 'REVIEWED',
  REJECTED = 'REJECTED',
  REGISTERED = 'REGISTERED',
}

export enum TradeType {
  BUY = 'BUY',
  SELL = 'SELL',
}

export interface SyncResult {
  exchangesFetched: number;
  exchangesCreated: number;
  exchangesUpdated: number;
  exchangesSkipped: number;
  transactionsCreated: number;
  errors: string[];
}
