import {
  GoogleAuth,
  JSONClient,
} from 'google-auth-library/build/src/auth/googleauth';
import { google, sheets_v4 } from 'googleapis';
import { Injectable } from '@nestjs/common';
import { GoogleSheetConfigService } from '../google-sheet-config/google-sheet-config.service';

@Injectable()
export class SheetsRepository {
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
}
