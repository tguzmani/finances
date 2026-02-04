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
  currentTransactionId?: number;
  waitingForDescription?: boolean;
}

export interface SessionContext extends Context {
  session: ReviewSession;
}

export const BOT_COMMANDS: BotCommand[] = [
  { command: 'start', description: 'Start the bot' },
  { command: 'status', description: 'View finance summary' },
  { command: 'transactions', description: 'View recent expenses' },
  { command: 'exchanges', description: 'View recent exchanges' },
  { command: 'review', description: 'Review pending expenses' },
  { command: 'sync', description: 'Sync data from sources' },
  { command: 'help', description: 'Show help' },
];
