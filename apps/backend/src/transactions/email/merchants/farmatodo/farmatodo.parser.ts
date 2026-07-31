import { Injectable, Logger } from '@nestjs/common';
import { parseVesAmount } from '../../amount.util';

export interface ParsedFarmatodoOrder {
  /** Order number taken from the subject ("Factura Orden #123456"). */
  orderNumber: string;
  /** Grand total, in VES. */
  amount: number;
  /** Raw product lines found under "Detalle de tu pedido", used to build the description. */
  items: string;
}

/**
 * Order number, from the subject ("Farmatodo - Factura Orden #182770725") or the
 * body, where the label and the number sit on separate lines.
 */
const ORDER_NUMBER_REGEX = /Orden\s*#\s*([A-Za-z0-9-]+)/i;

/**
 * Grand total. In the plain-text part the label, the currency and the amount are
 * each on their own line:
 *   TOTAL
 *   Bs
 *
 *   10.950,13
 */
const TOTAL_REGEX = /\bTOTAL\b\s*:?\s*(?:Bs\.?S?\.?)?\s*([\d][\d.,]*)/gi;

/** Marker that opens the product list in the email body. */
const ITEMS_START = /Detalle\s+de\s+tu\s+pedido/i;

/** The order number line trails the "Detalle de tu pedido" heading. */
const ITEMS_ORDER_LINE = /^\s*Orden\s*#\s*[A-Za-z0-9-]+/i;

/** First of these markers after the product list closes it. */
const ITEMS_END = /\b(Costo\s+de\s+productos|Descuentos?|SUB\s*TOTAL|TOTAL|IVA|Datos\s+de\s+Entrega)\b/i;

const MAX_ITEMS_LENGTH = 1500;

@Injectable()
export class FarmatodoParser {
  private readonly logger = new Logger(FarmatodoParser.name);

  parse(subject: string, body: string): ParsedFarmatodoOrder | null {
    const orderMatch = subject.match(ORDER_NUMBER_REGEX) ?? body.match(ORDER_NUMBER_REGEX);
    if (!orderMatch) {
      this.logger.warn(`Could not extract order number from Farmatodo email: "${subject}"`);
      return null;
    }

    const amount = this.extractTotal(body);
    if (amount === null) {
      this.logger.warn(`Could not extract TOTAL from Farmatodo order #${orderMatch[1]}`);
      return null;
    }

    return {
      orderNumber: orderMatch[1],
      amount,
      items: this.extractItems(body),
    };
  }

  /**
   * The grand total is the last "TOTAL"-prefixed amount in the body, after the
   * product subtotal and the delivery cost.
   */
  private extractTotal(body: string): number | null {
    const matches = [...body.matchAll(TOTAL_REGEX)];
    if (matches.length === 0) return null;

    const amount = parseVesAmount(matches[matches.length - 1][1]);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }

  /**
   * Slice of the body between the "Detalle de tu pedido" heading and the totals
   * block, whitespace-collapsed. The plain-text part pads every cell with blank
   * lines, so this keeps the LLM prompt small.
   */
  private extractItems(body: string): string {
    const start = body.search(ITEMS_START);
    if (start === -1) return '';

    const rest = body.slice(start).replace(ITEMS_START, '');
    const end = rest.search(ITEMS_END);
    const items = end === -1 ? rest : rest.slice(0, end);

    return items
      .replace(/\s+/g, ' ')
      .replace(ITEMS_ORDER_LINE, '')
      .trim()
      .slice(0, MAX_ITEMS_LENGTH);
  }
}
