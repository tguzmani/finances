import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as https from 'https';
import * as cheerio from 'cheerio';

type Currency = 'USD' | 'EUR';

@Injectable()
export class ExchangesBcvService {
  private readonly logger = new Logger(ExchangesBcvService.name);
  private readonly BCV_URL = 'https://bcv.org.ve';
  private readonly FALLBACK_URL = 'https://www.monitordedivisavenezuela.com/';
  private readonly agent = new https.Agent({
    rejectUnauthorized: false,
  });

  private readonly CURRENCY_SELECTOR_MAP: Record<Currency, string> = {
    USD: '#dolar',
    EUR: '#euro',
  };

  private readonly FALLBACK_SELECTOR_MAP: Record<Currency, string> = {
    USD: '.from-emerald-50.to-teal-50 .text-3xl.font-bold.text-slate-800.mb-2',
    EUR: '.from-blue-50.to-indigo-50 .text-3xl.font-bold.text-slate-800.mb-2',
  };

  private parseBcvValue(text: string): number | null {
    const cleaned = text.replace(',', '.').trim();
    const value = parseFloat(cleaned);
    return isNaN(value) ? null : value;
  }

  private async fetchFromBcv(currency: Currency): Promise<number | null> {
    this.logger.log(`Fetching ${currency} exchange rate from BCV...`);

    const response = await axios.get(this.BCV_URL, {
      httpsAgent: this.agent,
      timeout: 5000,
    });

    const $ = cheerio.load(response.data);

    const selector = this.CURRENCY_SELECTOR_MAP[currency];
    const elementText = $(
      `${selector} > .field-content > .row > .centrado > strong`,
    )
      .text()
      .trim();

    if (!elementText) {
      this.logger.warn(`No exchange rate found for ${currency} on BCV`);
      return null;
    }

    const value = this.parseBcvValue(elementText);
    if (value === null) {
      this.logger.error(`Failed to parse ${currency} exchange rate from BCV: ${elementText}`);
    }
    return value;
  }

  private async fetchFromFallback(currency: Currency): Promise<number | null> {
    this.logger.log(`Fetching ${currency} exchange rate from fallback (Monitor de Divisas)...`);

    const response = await axios.get(this.FALLBACK_URL, {
      httpsAgent: this.agent,
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    const selector = this.FALLBACK_SELECTOR_MAP[currency];
    const elementText = $(selector).first().text().trim();

    if (!elementText) {
      this.logger.warn(`No exchange rate found for ${currency} on fallback`);
      return null;
    }

    // Element text is like "501.73 Bs/EUR" — extract the number
    const match = elementText.match(/[\d.,]+/);
    if (!match) {
      this.logger.error(`Failed to parse ${currency} exchange rate from fallback: ${elementText}`);
      return null;
    }

    const value = this.parseBcvValue(match[0]);
    if (value === null) {
      this.logger.error(`Failed to parse ${currency} exchange rate from fallback: ${match[0]}`);
    }
    return value;
  }

  async getBcvExchangeRate(currency: Currency): Promise<number | null> {
    try {
      const value = await this.fetchFromBcv(currency);
      if (value !== null) {
        this.logger.log(`${currency} exchange rate from BCV: ${value}`);
        return value;
      }
    } catch (error) {
      this.logger.error(`Error fetching ${currency} from BCV: ${error.message}`);
    }

    try {
      const value = await this.fetchFromFallback(currency);
      if (value !== null) {
        this.logger.log(`${currency} exchange rate from fallback: ${value}`);
        return value;
      }
    } catch (error) {
      this.logger.error(`Error fetching ${currency} from fallback: ${error.message}`);
    }

    return null;
  }

  async getUsdExchangeRate(): Promise<number | null> {
    return this.getBcvExchangeRate('USD');
  }

  async getEurExchangeRate(): Promise<number | null> {
    return this.getBcvExchangeRate('EUR');
  }
}
