import { Injectable } from '@nestjs/common';
import { PagoMovilData } from '../../transactions/ocr/parsers/pago-movil-llm-parser.service';
import { getBankName } from '../../common/venezuelan-banks';

@Injectable()
export class TelegramPagoMovilPresenter {
  formatPagoMovilMessage(data: PagoMovilData): string {
    const lines: string[] = [];

    if (data.bankCode) {
      const bankName = getBankName(data.bankCode) || data.bankName || 'Unknown';
      lines.push(`<b>Bank:</b> ${data.bankCode} ${bankName}`);
    } else if (data.bankName) {
      lines.push(`<b>Bank:</b> ${data.bankName}`);
    }

    if (data.amount != null) {
      lines.push(`<b>Amount:</b> ${data.amount}`);
    }

    if (data.phone) {
      lines.push(`<b>Phone:</b> ${data.phone}`);
    }

    if (data.idDocument) {
      lines.push(`<b>ID:</b> ${data.idDocument}`);
    }

    if (lines.length === 0) {
      return '❌ Could not extract any Pago Móvil data.';
    }

    return lines.join('\n');
  }

  buildCopyText(data: PagoMovilData): string {
    const lines: string[] = [];

    if (data.bankCode) {
      const bankName = getBankName(data.bankCode) || data.bankName || 'Unknown';
      lines.push(`Bank: ${data.bankCode} ${bankName}`);
    } else if (data.bankName) {
      lines.push(`Bank: ${data.bankName}`);
    }

    if (data.amount != null) {
      lines.push(`Amount: ${data.amount}`);
    }

    if (data.phone) {
      lines.push(`Phone: ${data.phone}`);
    }

    if (data.idDocument) {
      lines.push(`ID: ${data.idDocument}`);
    }

    return lines.join('\n');
  }
}
