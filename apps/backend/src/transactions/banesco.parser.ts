import { Injectable } from '@nestjs/common';

export interface ParsedTransaction {
  date: Date;
  amount: number;
  currency: string;
  transactionId: string;
}

@Injectable()
export class BanescoParser {
  private readonly CURRENCY = 'VES';

  /**
   * Parse "Notificación Banesco" email (single transaction)
   * Example: "Consumo en Punto de Venta con TDD # 6859 Bs. 20703.03 el 01-02-2026 13:12 Ref 4082"
   */
  parseNotification(body: string): ParsedTransaction | null {
    const regex =
      /(?:Consumo en Punto de Venta|REGISTRO:.*?) con TDD # (\d+) Bs\. ([\d.,]+) el (\d{2}-\d{2}-\d{4}) (\d{2}:\d{2}) Ref (\d+)/i;

    const match = body.match(regex);
    if (!match) return null;

    const [, , amountStr, dateStr, timeStr, reference] = match;

    const amount = this.parseAmount(amountStr);
    const date = this.parseDate(dateStr, timeStr);

    return {
      date,
      amount,
      currency: this.CURRENCY,
      transactionId: reference,
    };
  }

  /**
   * Parse "Resumen de Operaciones" email (multiple transactions)
   */
  parseSummary(body: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];

    // Split by "BANESCO" blocks
    const blocks = body.split(/\nBANESCO\n/).filter((b) => b.includes('Monto:'));

    for (const block of blocks) {
      const transaction = this.parseSummaryBlock(block);
      if (transaction) {
        transactions.push(transaction);
      }
    }

    return transactions;
  }

  private parseSummaryBlock(block: string): ParsedTransaction | null {
    const referenceMatch = block.match(/Referencia:\s*(\d+)/);
    const dateMatch = block.match(/Fecha:\s*(\d{2}\/\d{2}\/\d{4})/);
    const timeMatch = block.match(/Hora:\s*(\d{2}:\d{2}:\d{2})/);
    const amountMatch = block.match(/Monto:\s*([\d.,]+)/);

    if (!referenceMatch || !dateMatch || !amountMatch) return null;

    const reference = referenceMatch[1];
    const dateStr = dateMatch[1];
    const timeStr = timeMatch ? timeMatch[1] : '00:00:00';
    const amount = this.parseAmount(amountMatch[1]);

    // Parse date DD/MM/YYYY
    const [day, month, year] = dateStr.split('/');
    const date = new Date(`${year}-${month}-${day}T${timeStr}`);

    return {
      date,
      amount,
      currency: this.CURRENCY,
      transactionId: reference,
    };
  }

  private parseAmount(amountStr: string): number {
    // Handle both "20703.03" and "20.703,03" formats
    const normalized = amountStr.replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized);
  }

  private parseDate(dateStr: string, timeStr: string): Date {
    // Parse DD-MM-YYYY HH:MM
    const [day, month, year] = dateStr.split('-');
    return new Date(`${year}-${month}-${day}T${timeStr}:00`);
  }

  /**
   * Detect email type and parse accordingly
   */
  parse(subject: string, body: string): ParsedTransaction[] {
    if (subject.includes('Resumen de Operaciones')) {
      return this.parseSummary(body);
    }

    if (subject.includes('Notificación Banesco')) {
      const transaction = this.parseNotification(body);
      return transaction ? [transaction] : [];
    }

    return [];
  }
}
