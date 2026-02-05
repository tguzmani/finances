import { Context } from 'telegraf';

export interface StatusResponse {
  newBanescoTransactions: number;
  totalExchanges: number;
}

export interface BotCommand {
  command: string;
  description: string;
}

export interface ReviewSession {
  reviewType?: 'transactions' | 'exchanges';
  currentTransactionId?: number;
  currentExchangeId?: number;
  waitingForDescription?: boolean;
  registerExchangeIds?: number[];
  registerWavg?: number;
  // Transaction registration flow
  registerTransactionIds?: number[];
  registerTransactionIndex?: number;
  registerTransactionExchangeRate?: number;
  // Review by ID flow
  reviewOneMode?: 'selecting' | 'waiting_for_tx_id' | 'waiting_for_ex_id';
  reviewOneType?: 'transaction' | 'exchange';
  reviewSingleItem?: boolean; // True when reviewing a single item via /review_one
  // Go Back functionality
  transactionReviewHistory?: number[];
  exchangeReviewHistory?: number[];
  // Progress tracking
  reviewTotalCount?: number;
  reviewCurrentIndex?: number;
  // Undo functionality
  lastRegisteredTransactionIds?: number[];
  lastRegisteredExchangeIds?: number[];
  lastRegisteredWavg?: number;
}

export interface SessionContext extends Context {
  session: ReviewSession;
}

export const BOT_COMMANDS: BotCommand[] = [
  { command: 'start', description: 'Start the bot' },
  { command: 'status', description: 'View finance summary' },
  { command: 'transactions', description: 'View recent expenses' },
  { command: 'exchanges', description: 'View recent exchanges' },
  { command: 'review', description: 'Review pending items' },
  { command: 'review_one', description: 'Review specific item by ID' },
  { command: 'register', description: 'Register reviewed items' },
  { command: 'sync', description: 'Sync data from sources' },
  { command: 'help', description: 'Show help' },
];
