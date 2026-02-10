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
  // Manual transaction entry flow
  manualTransactionState?: 'waiting_type' | 'waiting_account' | 'waiting_method' | 'waiting_amount' | 'waiting_description' | 'waiting_date_choice' | 'waiting_custom_date';
  manualTransactionType?: 'INCOME' | 'EXPENSE';
  manualTransactionPlatform?: string;
  manualTransactionCurrency?: string;
  manualTransactionMethod?: string;
  manualTransactionAmount?: number;
  manualTransactionDescription?: string;
  manualTransactionDate?: Date;
  // Transaction grouping flow
  waitingForGroupDescription?: boolean;
  pendingGroupTransactionId?: number;
  currentGroupAction?: 'creating' | 'adding';
  // Registration with groups
  registerTransactionGroupIds?: number[];
  lastRegisteredGroupIds?: number[];
  // Photo processing
  pendingPhotoFileId?: string;
  pendingBillData?: {
    datetime: Date | null;
    amount: number | null;
    transactionId: string | null;
    currency: string;
    ocrText: string;
    recipeName?: string;
  };
}

export interface SessionContext extends Context {
  session: ReviewSession;
}

export const BOT_COMMANDS: BotCommand[] = [
  { command: 'start', description: 'Start the bot' },
  { command: 'status', description: 'View finance summary' },
  { command: 'accounts', description: 'View account balances' },
  { command: 'rates', description: 'View exchange rates' },
  { command: 'transactions', description: 'View recent expenses' },
  { command: 'exchanges', description: 'View recent exchanges' },
  { command: 'groups', description: 'View unregistered groups' },
  { command: 'review', description: 'Review pending items' },
  { command: 'review_one', description: 'Review specific item by ID' },
  { command: 'register', description: 'Register reviewed items' },
  { command: 'add_transaction', description: 'Add manual transaction' },
  { command: 'sync', description: 'Sync data from sources' },
  { command: 'help', description: 'Show help' },
];
