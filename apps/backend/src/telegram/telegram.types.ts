import { Context } from 'telegraf';
import { PaymentMethod } from '../transactions/transaction.types';
import { PagoMovilData } from '../transactions/ocr/parsers/pago-movil-llm-parser.service';
import { RecalledDraft } from './recall/recall-extraction.service';

export interface StatusResponse {
  newBanescoTransactions: number;
  totalExchanges: number;
}

export interface BotCommand {
  command: string;
  description: string;
}

/**
 * A recollection being confirmed entry by entry. It lives in memory like every
 * other flow, so a restart drops the queue and the recollection is sent again.
 */
export interface RecallSession {
  /** The /recall question, so only its reply is read as a recollection. */
  waitingPromptMessageId?: number;
  /** The question asking for a corrected amount for the entry on screen. */
  amountPromptMessageId?: number;
  /** The sentence the entries came from, stored with each saved transaction. */
  sourceText?: string;
  drafts?: RecalledDraft[];
  index?: number;
  saved?: number;
  skipped?: number;
}

export interface ReviewSession {
  reviewType?: 'transactions' | 'exchanges';
  currentTransactionId?: number;
  currentExchangeId?: number;
  waitingForDescription?: boolean;
  registerExchangeIds?: number[];
  registerWavg?: number;
  registerSumFormula?: string;
  // Transaction registration flow
  registerTransactionIds?: number[];
  registerTransactionIndex?: number;
  registerTransactionExchangeRate?: number;
  // Review by ID flow
  reviewOneMode?: 'selecting' | 'waiting_for_tx_id' | 'waiting_for_ex_id' | 'waiting_for_tx_search';
  reviewOneType?: 'transaction' | 'exchange';
  reviewSingleItem?: boolean; // True when reviewing a single item via /review_one
  /** Set by /find, which reports on every status instead of only what is pending. */
  findAnyStatus?: boolean;
  /** Set by /reconcile, so pasted text is read as a bank statement until the user exits. */
  reconcileWaiting?: boolean;
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
  manualTransactionState?: 'waiting_type' | 'waiting_account' | 'waiting_method' | 'waiting_amount' | 'waiting_description' | 'waiting_date_choice' | 'waiting_custom_date' | 'waiting_confirmation';
  manualTransactionType?: 'INCOME' | 'EXPENSE';
  manualTransactionPlatform?: string;
  manualTransactionCurrency?: string;
  manualTransactionMethod?: string;
  manualTransactionAmount?: number;
  manualTransactionDescription?: string;
  manualTransactionDate?: Date;
  // Iterative registration flow
  registerItems?: Array<{ id: number; data: any }>;
  registerCurrentIndex?: number;
  registerTotalCount?: number;
  registerMessageId?: number; // For editing messages instead of sending new ones
  registerBillMessageId?: number; // Message ID of the bill photo to delete on commit
  // Photo processing
  pendingPhotoFileId?: string;
  pendingBillData?: {
    datetime: Date | null;
    amount: number | null;
    transactionId: string | null;
    currency: string;
    ocrText: string;
    paymentMethod: PaymentMethod | null;
    caption?: string;
  };
  // Date/amount change flow (review)
  waitingForDateChange?: boolean;
  waitingForAmountChange?: boolean;
  // Notification edit flow
  notificationTransactionId?: number;
  // Banesco balance update flow
  waitingForBanescoAmount?: boolean;
  // Settings flow
  settingsWaitingForSheetId?: boolean;
  // Convert flow
  convertWaitingForInput?: boolean;
  convertVesAmount?: number;
  convertRatesSnapshot?: any;
  // Pago Móvil data parsing flow
  pagoMovilWaiting?: boolean;
  pagoMovilMessageId?: number;
  pagoMovilData?: PagoMovilData;
  // Transfer flow
  transferState?:
    | 'waiting_input'
    | 'waiting_amount'
    | 'waiting_debit'
    | 'waiting_credit'
    | 'waiting_description'
    | 'waiting_confirmation';
  transferAmount?: number;
  transferDebitAccount?: string;
  transferCreditAccount?: string;
  transferDescription?: string;
  /** Set when the transfer started from a detected transaction, to close it after. */
  transferTransactionId?: number;
  // Bookkeeping: the note a /done or /checkin question is waiting for. Only a
  // reply to that exact question counts, so an expense typed meanwhile stays
  // a freeform entry.
  // Recall: several forgotten transactions remembered in one message
  recall?: RecallSession;
  /** The /bug question. Reports carry figures, so only its reply is filed. */
  bugReportReply?: { promptMessageId: number };
  bookkeepingReply?: {
    kind: 'closing_note' | 'check_in_note';
    id: number;
    promptMessageId: number;
    /** The message carrying the Skip button, stripped once the note arrives. */
    skipMessageId?: number;
  };
}

export interface SessionContext extends Context {
  session: ReviewSession;
}

export const BOT_COMMANDS: BotCommand[] = [
  { command: 'start', description: 'Start the bot' },
  { command: 'status', description: 'View finance summary' },
  { command: 'accounts', description: 'View account balances' },
  { command: 'expenses', description: 'View budget and expenses' },
  { command: 'equity', description: 'View equity and chart' },
  { command: 'rates', description: 'View exchange rates' },
  { command: 'convert', description: 'Convert between currencies' },
  { command: 'transactions', description: 'View recent expenses' },
  { command: 'exchanges', description: 'View recent exchanges' },
  { command: 'review', description: 'Review pending items' },
  { command: 'review_one', description: 'Review specific item by ID' },
  { command: 'find', description: 'Check whether a transaction is on record' },
  { command: 'reconcile', description: 'Check a bank statement against the bot' },
  { command: 'register', description: 'Register reviewed items' },
  { command: 'add_transaction', description: 'Add a transaction with the wizard' },
  { command: 'recall', description: 'Register transactions you forgot, from memory' },
  { command: 'transfer', description: 'Register a transfer between accounts' },
  { command: 'pago_movil', description: 'Parse Pago Móvil payment data' },
  { command: 'done', description: 'Close the day: the ledger is up to date' },
  { command: 'checkin', description: 'Are all your expenses registered?' },
  { command: 'bug', description: 'Report a bug so it is not forgotten' },
  { command: 'bugs', description: 'List the bugs still open' },
  { command: 'settings', description: 'Update settings' },
  { command: 'sync', description: 'Sync data from sources' },
  { command: 'help', description: 'Show help' },
];
