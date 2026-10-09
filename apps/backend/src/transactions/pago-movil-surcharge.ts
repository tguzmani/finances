import { Logger } from '@nestjs/common';

/**
 * Who receives a Pago Móvil, as far as the bank's commission cares: a company
 * (RIF) or a person (cédula).
 */
export type PagoMovilRecipientType = 'RIF' | 'cedula';

const SURCHARGE_MULTIPLIERS: Record<PagoMovilRecipientType, number> = {
  RIF: 1.015,    // 1.5%
  cedula: 1.003, // 0.3%
};

// Prefixes a RIF can carry that a cédula never does
const RIF_PREFIXES = ['J', 'G', 'C'];

const logger = new Logger('PagoMovilSurcharge');

/**
 * Reads the recipient type off an ID document such as "J12345678" or
 * "V14480811". Anything without a company prefix is a cédula.
 */
export function recipientTypeFromIdDocument(idDocument: string | null): PagoMovilRecipientType {
  const prefix = idDocument?.trim().charAt(0).toUpperCase();
  return prefix && RIF_PREFIXES.includes(prefix) ? 'RIF' : 'cedula';
}

/**
 * Adds the bank's Pago Móvil commission to the amount sent, so the booked
 * expense matches what actually leaves the account. An unknown recipient is
 * charged as a cédula.
 */
export function applyPagoMovilSurcharge(
  amount: number,
  recipientType: PagoMovilRecipientType | null,
): number {
  const type = recipientType ?? 'cedula';
  const multiplier = SURCHARGE_MULTIPLIERS[type];
  logger.log(`Applying ${type} surcharge (${((multiplier - 1) * 100).toFixed(1)}%)`);
  return amount * multiplier;
}
