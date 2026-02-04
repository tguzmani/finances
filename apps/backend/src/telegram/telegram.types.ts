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
  { command: 'register', description: 'Register reviewed items' },
  { command: 'sync', description: 'Sync data from sources' },
  { command: 'help', description: 'Show help' },
];
