import {
  GoogleAuth,
  JSONClient,
} from 'google-auth-library/build/src/auth/googleauth';
import { google, sheets_v4 } from 'googleapis';
import { Injectable } from '@nestjs/common';
import { GoogleSheetConfigService } from '../google-sheet-config/google-sheet-config.service';

/**
 * Excel's Accounting format, copied verbatim from the Libro template: the "$"
 * is pinned to the left of the cell and the number to the right, with a dash
 * for zero. The template only carries it down to a fixed row, so rows appended
 * past that point have to be formatted explicitly.
 */
export const ACCOUNTING_NUMBER_FORMAT =
  '_("$"* #,##0.00_);_("$"* \\(#,##0.00\\);_("$"* "-"??_);_(@_)';

/** A1 range split into its sheet name and grid bounds. */
interface ParsedRange {
  sheetName: string;
  startColumn: number;
  endColumn: number;
  startRow: number;
  endRow: number;
}

@Injectable()
export class SheetsRepository {
  private readonly sheetIdCache = new Map<string, number>();

  auth: GoogleAuth<JSONClient>;
  sheets: sheets_v4.Sheets;

  constructor(
    private readonly googleSheetConfigService: GoogleSheetConfigService,
  ) {
    const credentialsBase64 = process.env.GOOGLE_CREDENTIALS_JSON_BASE64;

    if (!credentialsBase64) {
      throw new Error(
        '❌ Missing GOOGLE_CREDENTIALS_JSON_BASE64 in environment variables.'
      );
    }

    let credentials;

    try {
      const decodedCredentials = Buffer.from(
        credentialsBase64,
        'base64'
      ).toString('utf-8');
      credentials = JSON.parse(decodedCredentials);
    } catch (error) {
      throw new Error(
        '❌ Failed to parse GOOGLE_CREDENTIALS_JSON_BASE64. Check your .env file.'
      );
    }

    this.auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  private async getSpreadsheetId(): Promise<string | undefined> {
    return this.googleSheetConfigService.getCurrentSheetId();
  }

  async getSheetValues(range: string, valueRenderOption?: 'FORMATTED_VALUE' | 'UNFORMATTED_VALUE' | 'FORMULA') {
    const spreadsheetId = await this.getSpreadsheetId();
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption,
    });

    return res.data.values;
  }

  async updateSheetValues(range: string, values: any[][]) {
    const spreadsheetId = await this.getSpreadsheetId();
    const res = await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    return res.data;
  }

  /**
   * Stamps a number format onto every cell of an A1 range. Writing values never
   * changes formatting, so this is what keeps appended rows looking like the
   * rest of the sheet.
   */
  async applyNumberFormat(range: string, pattern: string): Promise<void> {
    const spreadsheetId = await this.getSpreadsheetId();
    const parsed = this.parseRange(range);
    const sheetId = await this.getSheetId(parsed.sheetName);

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: parsed.startRow - 1,
                endRowIndex: parsed.endRow,
                startColumnIndex: parsed.startColumn - 1,
                endColumnIndex: parsed.endColumn,
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: { type: 'NUMBER', pattern },
                },
              },
              fields: 'userEnteredFormat.numberFormat',
            },
          },
        ],
      },
    });
  }

  private async getSheetId(sheetName: string): Promise<number> {
    const cached = this.sheetIdCache.get(sheetName);
    if (cached !== undefined) return cached;

    const spreadsheetId = await this.getSpreadsheetId();
    const meta = await this.sheets.spreadsheets.get({ spreadsheetId });
    const sheet = meta.data.sheets?.find(
      (s) => s.properties?.title === sheetName,
    );

    if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) {
      throw new Error(`Sheet "${sheetName}" not found in spreadsheet`);
    }

    this.sheetIdCache.set(sheetName, sheet.properties.sheetId);
    return sheet.properties.sheetId;
  }

  private parseRange(range: string): ParsedRange {
    const match = range.match(/^(?:'?(.+?)'?!)?([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!match) {
      throw new Error(`Unsupported A1 range for formatting: "${range}"`);
    }

    const [, sheetName, startCol, startRow, endCol, endRow] = match;

    return {
      sheetName,
      startColumn: this.columnToIndex(startCol),
      endColumn: this.columnToIndex(endCol),
      startRow: Number(startRow),
      endRow: Number(endRow),
    };
  }

  /** "A" -> 1, "F" -> 6, "AA" -> 27. */
  private columnToIndex(column: string): number {
    return [...column].reduce(
      (index, letter) => index * 26 + (letter.charCodeAt(0) - 64),
      0,
    );
  }
}
