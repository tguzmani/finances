import { Injectable, Logger } from '@nestjs/common';
import { Exchange, Transaction } from '@prisma/client';
import { ExchangesService } from '../../exchanges/exchanges.service';
import { TransactionsService } from '../../transactions/transactions.service';
import {
  TransactionPlatform,
  TransactionStatus,
  TransactionType,
} from '../../transactions/transaction.types';
import { AMOUNT_TOLERANCE } from '../../transactions/transaction-search.service';
import { ExchangeRateService } from '../../exchanges/exchange-rate.service';
import { StatementParser, StatementRow } from './statement.parser';

/** One movement of the statement, with the fees charged on it folded in. */
export interface StatementMovement {
  date: Date;
  reference: string;
  description: string;
  /** What left or reached the account in total, fees included. */
  amount: number;
  type: TransactionType;
  /** The rows that make it up, when the bank split it. */
  parts: number[];
}

export type MatchVerdict = 'exact' | 'close' | 'missing';

export interface MovementMatch {
  movement: StatementMovement;
  verdict: MatchVerdict;
  transaction?: Transaction;
  /** Set when the money came in through a P2P sale rather than a transaction. */
  exchange?: Exchange;
  /** What was found, less what the statement says, when something was found. */
  difference?: number;
}

/** A finished check: what each movement came to, and the rate to price it in USD. */
export interface ReconcileReport {
  matches: MovementMatch[];
  /** VES per USD, when a rate was on hand. */
  rate?: number;
}

/** How many days apart the statement and the bot may date the same movement. */
const DATE_WINDOW_DAYS = 2;

/**
 * A match to the cent.
 *
 * The bank and Binance round the last cent differently — an order of 119,520.60
 * is credited as 119,520.59 — so the cent itself is inside the tolerance.
 */
const EXACT_TOLERANCE = 0.01;

/** How many transactions the window may hold before the oldest fall out. */
const CANDIDATE_LIMIT = 500;

/** The exchanges query caps its page at a hundred. */
const EXCHANGE_LIMIT = 100;

/** What a P2P order may call the bolívar. */
const BOLIVAR_SYMBOLS = ['BS', 'VES'];

/** Amounts are compared as whole cents, where 0.1 + 0.2 is still 0.3. */
function inCents(amount: number): number {
  return Math.round(amount * 100);
}

function gapInCents(a: number, b: number): number {
  return Math.abs(inCents(a) - inCents(b));
}

@Injectable()
export class TelegramReconcileService {
  private readonly logger = new Logger(TelegramReconcileService.name);

  constructor(
    private readonly parser: StatementParser,
    private readonly transactionsService: TransactionsService,
    private readonly exchangesService: ExchangesService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  async reconcileText(text: string): Promise<ReconcileReport> {
    const [matches, rate] = await Promise.all([
      this.reconcileRows(this.parser.parse(text)),
      this.getInternalRate(),
    ]);

    return { matches, rate };
  }

  /** The rate the bolívares of this statement are worth in USD. */
  private async getInternalRate(): Promise<number | undefined> {
    try {
      const rate = await this.exchangeRateService.findLatest();
      const value = rate ? Number(rate.value) : 0;
      return value > 0 ? value : undefined;
    } catch (error) {
      this.logger.error(`Could not fetch internal exchange rate: ${error.message}`);
      return undefined;
    }
  }

  async reconcileRows(rows: StatementRow[]): Promise<MovementMatch[]> {
    const movements = this.foldFeesIntoMovements(rows);
    if (movements.length === 0) return [];

    const [candidates, exchanges] = await Promise.all([
      this.loadCandidates(movements),
      this.loadExchanges(movements),
    ]);
    const taken = new Set<number>();
    const takenExchanges = new Set<number>();

    // Exact matches are settled first, so a near miss cannot take the
    // transaction that another movement matches to the cent
    const matches: MovementMatch[] = movements.map((movement) => ({
      movement,
      verdict: 'missing' as MatchVerdict,
    }));

    for (const match of matches) {
      this.settle(match, candidates, taken, EXACT_TOLERANCE, 'exact');
    }

    // Bolívares that arrive from a P2P sale are on record as an exchange, and
    // reporting them as missing would send the user looking for a transaction
    // that was never meant to exist
    for (const match of matches) {
      if (match.verdict !== 'missing') continue;
      this.settleAgainstExchange(match, exchanges, takenExchanges);
    }

    for (const match of matches) {
      if (match.verdict !== 'missing') continue;
      const window = Math.abs(match.movement.amount) * AMOUNT_TOLERANCE;
      this.settle(match, candidates, taken, window, 'close');
    }

    this.logger.log(
      `Reconciled ${movements.length} movements: ` +
        `${matches.filter((m) => m.verdict === 'exact').length} exact, ` +
        `${matches.filter((m) => m.verdict === 'close').length} close, ` +
        `${matches.filter((m) => m.verdict === 'missing').length} missing`,
    );

    return matches;
  }

  /**
   * Puts a movement and its fees back together.
   *
   * The bank charges a Pago Móvil commission as its own row under the same
   * reference, while the bot books one transaction with the commission already
   * inside it. Compared row by row, every Pago Móvil would read as missing and
   * every commission as an expense that was never recorded.
   */
  private foldFeesIntoMovements(rows: StatementRow[]): StatementMovement[] {
    const movements: StatementMovement[] = [];
    const byReference = new Map<string, StatementMovement>();

    for (const row of rows) {
      const key = `${row.reference}|${row.date.toISOString().slice(0, 10)}|${row.amount > 0 ? '+' : '-'}`;
      const existing = row.reference ? byReference.get(key) : undefined;

      if (existing) {
        existing.amount += row.amount;
        existing.parts.push(row.amount);
        // The fee is the smaller row; the larger one names the movement
        if (Math.abs(row.amount) > Math.abs(existing.parts[0])) {
          existing.description = row.description;
        }
        continue;
      }

      const movement: StatementMovement = {
        date: row.date,
        reference: row.reference,
        description: row.description,
        amount: row.amount,
        type: row.amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME,
        parts: [row.amount],
      };

      movements.push(movement);
      if (row.reference) byReference.set(key, movement);
    }

    return movements;
  }

  /** The statement's span, widened by the window the dates may differ by. */
  private dateRangeFor(movements: StatementMovement[]): { from: Date; to: Date } {
    const dates = movements.map((m) => m.date.getTime());
    const from = new Date(Math.min(...dates));
    const to = new Date(Math.max(...dates));

    from.setUTCDate(from.getUTCDate() - DATE_WINDOW_DAYS);
    to.setUTCDate(to.getUTCDate() + DATE_WINDOW_DAYS);

    return { from, to };
  }

  /** Every Banesco transaction that could answer for one of these movements. */
  private async loadCandidates(movements: StatementMovement[]): Promise<Transaction[]> {
    const { from, to } = this.dateRangeFor(movements);

    const transactions = await this.transactionsService.findAll({
      fromDate: from.toISOString(),
      toDate: to.toISOString(),
      limit: CANDIDATE_LIMIT,
    });

    // The statement is Banesco's, and a rejected transaction was decided
    // against, so neither anything else nor those answer for a movement
    return transactions.filter(
      (t) =>
        t.platform === TransactionPlatform.BANESCO &&
        t.status !== TransactionStatus.REJECTED,
    );
  }

  /** The P2P sales whose bolívares landed in the account around these dates. */
  private async loadExchanges(movements: StatementMovement[]): Promise<Exchange[]> {
    if (!movements.some((m) => m.type === TransactionType.INCOME)) return [];

    const { from, to } = this.dateRangeFor(movements);

    const exchanges = await this.exchangesService.findAll({
      fromDate: from.toISOString(),
      toDate: to.toISOString(),
      limit: EXCHANGE_LIMIT,
    });

    // Binance writes the currency as the seller sees it on the order, "Bs"
    return exchanges.filter((e) => BOLIVAR_SYMBOLS.includes(e.fiatSymbol.toUpperCase()));
  }

  private settleAgainstExchange(
    match: MovementMatch,
    exchanges: Exchange[],
    taken: Set<number>,
  ): void {
    const { movement } = match;
    if (movement.type !== TransactionType.INCOME) return;

    const target = Math.abs(movement.amount);

    const best = exchanges
      .filter((e) => !taken.has(e.id))
      .filter((e) => this.withinDateWindow(e.binanceCreatedAt, movement.date))
      .map((e) => ({ exchange: e, gap: gapInCents(Number(e.fiatAmount), target) }))
      .filter((c) => c.gap <= inCents(EXACT_TOLERANCE))
      .sort((a, b) => a.gap - b.gap)[0];

    if (!best) return;

    taken.add(best.exchange.id);
    match.verdict = 'exact';
    match.exchange = best.exchange;
    match.difference = Number(best.exchange.fiatAmount) - target;
  }

  /** Takes the closest free candidate inside the tolerance, if there is one. */
  private settle(
    match: MovementMatch,
    candidates: Transaction[],
    taken: Set<number>,
    tolerance: number,
    verdict: MatchVerdict,
  ): void {
    const { movement } = match;
    const target = Math.abs(movement.amount);

    const best = candidates
      .filter((t) => !taken.has(t.id))
      .filter((t) => t.type === movement.type)
      .filter((t) => this.withinDateWindow(t.date, movement.date))
      .map((t) => ({ transaction: t, gap: gapInCents(Number(t.amount), target) }))
      .filter((c) => c.gap <= inCents(tolerance))
      .sort((a, b) => a.gap - b.gap)[0];

    if (!best) return;

    taken.add(best.transaction.id);
    match.verdict = verdict;
    match.transaction = best.transaction;
    match.difference = Number(best.transaction.amount) - target;
  }

  private withinDateWindow(transactionDate: Date, statementDate: Date): boolean {
    const days = Math.abs(
      (new Date(transactionDate).getTime() - statementDate.getTime()) / 86_400_000,
    );
    return days <= DATE_WINDOW_DAYS;
  }
}
