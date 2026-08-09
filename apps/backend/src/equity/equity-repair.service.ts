import { Injectable, Logger } from '@nestjs/common';
import { EquityName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DcaPricesService } from '../dca/dca-prices.service';
import { DcaSheetsService } from '../dca/dca-sheets.service';

/** Cent-level tolerance when recognising a snapshot as broken. */
const EPSILON = 0.01;

export interface RepairedSnapshot {
  date: string;
  storedPnl: number;
  correctPnl: number;
  crypto: { from: number; to: number };
  full: { from: number; to: number };
}

export interface RepairResult {
  captures: number;
  broken: number;
  repaired: RepairedSnapshot[];
  dryRun: boolean;
}

/**
 * Rebuilds the equity snapshots that were captured while the DCA sheet reported
 * #VALUE! as its current value. Back then the sheet read fell back to 0, so the
 * crypto PnL was recorded as minus the whole allocated amount.
 *
 * The healthy snapshots of the same capture carry everything needed to redo the
 * arithmetic: EQUITY_SIMPLE is the equity without crypto, and EQUITY_FIAT is the
 * equity without crypto but with ITA, so only the PnL has to be recomputed from
 * the holdings and their price at that moment.
 */
@Injectable()
export class EquityRepairService {
  private readonly logger = new Logger(EquityRepairService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dcaPricesService: DcaPricesService,
    private readonly dcaSheetsService: DcaSheetsService,
  ) {}

  async repairCryptoSnapshots(dryRun = true): Promise<RepairResult> {
    const snapshots = await this.prisma.equitySnapshot.findMany({
      orderBy: { date: 'asc' },
    });

    const captures = new Map<string, Map<EquityName, { id: number; amount: number }>>();
    for (const snapshot of snapshots) {
      const key = snapshot.date.toISOString();
      if (!captures.has(key)) captures.set(key, new Map());
      captures.get(key)!.set(snapshot.name, {
        id: snapshot.id,
        amount: Number(snapshot.amount),
      });
    }

    const purchases = await this.dcaSheetsService.getPurchases();
    const broken: { date: Date; capture: Map<EquityName, { id: number; amount: number }> }[] = [];

    for (const [key, capture] of captures) {
      const simple = capture.get(EquityName.EQUITY_SIMPLE);
      const crypto = capture.get(EquityName.EQUITY_CRYPTO_INVESTMENT);
      if (!simple || !crypto) continue;

      const date = new Date(key);
      const invested = this.investedAsOf(purchases, date);
      const storedPnl = crypto.amount - simple.amount;

      // A capture is broken when the PnL is exactly minus everything allocated,
      // which is what "current value read as 0" produces
      if (invested > 0 && Math.abs(storedPnl + invested) < EPSILON) {
        broken.push({ date, capture });
      }
    }

    if (broken.length === 0) {
      this.logger.log('No broken equity snapshots found');
      return { captures: captures.size, broken: 0, repaired: [], dryRun };
    }

    const prices = await this.loadPrices(purchases, broken[0].date, broken[broken.length - 1].date);
    const repaired: RepairedSnapshot[] = [];

    for (const { date, capture } of broken) {
      const simple = capture.get(EquityName.EQUITY_SIMPLE)!;
      const crypto = capture.get(EquityName.EQUITY_CRYPTO_INVESTMENT)!;
      const fiat = capture.get(EquityName.EQUITY_FIAT_INVESTMENT);
      const full = capture.get(EquityName.EQUITY_FULL_INVESTMENT);

      const correctPnl = this.pnlAt(purchases, prices, date);
      if (correctPnl === null) {
        this.logger.warn(`No price data for ${date.toISOString()}, leaving it untouched`);
        continue;
      }

      const newCrypto = simple.amount + correctPnl;
      const newFull = fiat ? fiat.amount + correctPnl : null;

      repaired.push({
        date: date.toISOString(),
        storedPnl: crypto.amount - simple.amount,
        correctPnl,
        crypto: { from: crypto.amount, to: newCrypto },
        full: { from: full?.amount ?? NaN, to: newFull ?? NaN },
      });

      if (dryRun) continue;

      await this.prisma.equitySnapshot.update({
        where: { id: crypto.id },
        data: { amount: newCrypto },
      });

      if (full && newFull !== null) {
        await this.prisma.equitySnapshot.update({
          where: { id: full.id },
          data: { amount: newFull },
        });
      }
    }

    this.logger.log(
      `${dryRun ? '[DRY RUN] ' : ''}Repaired ${repaired.length} of ${broken.length} broken captures`,
    );

    return { captures: captures.size, broken: broken.length, repaired, dryRun };
  }

  private investedAsOf(purchases: { date: Date; amount: number }[], date: Date): number {
    return purchases
      .filter((purchase) => purchase.date <= date)
      .reduce((total, purchase) => total + purchase.amount, 0);
  }

  private holdingsAsOf(
    purchases: { date: Date; asset: string; tokens: number }[],
    date: Date,
  ): Map<string, number> {
    const holdings = new Map<string, number>();

    for (const purchase of purchases) {
      if (purchase.date > date) continue;
      holdings.set(purchase.asset, (holdings.get(purchase.asset) ?? 0) + purchase.tokens);
    }

    return holdings;
  }

  /** Hourly prices for every asset ever bought, covering the whole broken range. */
  private async loadPrices(
    purchases: { asset: string }[],
    from: Date,
    to: Date,
  ): Promise<Map<string, Map<string, number>>> {
    const assets = [...new Set(purchases.map((purchase) => purchase.asset))];
    const prices = new Map<string, Map<string, number>>();

    // One hour of margin on each side so the capture hour is always covered
    const start = new Date(from.getTime() - 3600_000);
    const end = new Date(to.getTime() + 3600_000);

    for (const asset of assets) {
      prices.set(asset, await this.dcaPricesService.getHourlyPrices(asset, start, end));
    }

    return prices;
  }

  private pnlAt(
    purchases: { date: Date; asset: string; amount: number; tokens: number }[],
    prices: Map<string, Map<string, number>>,
    date: Date,
  ): number | null {
    const hour = date.toISOString().slice(0, 13);
    const holdings = this.holdingsAsOf(purchases, date);

    let currentValue = 0;

    for (const [asset, tokens] of holdings) {
      const price = prices.get(asset)?.get(hour);
      if (price === undefined) return null;
      currentValue += tokens * price;
    }

    return currentValue - this.investedAsOf(purchases, date);
  }
}
