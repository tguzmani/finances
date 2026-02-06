import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as https from 'https';
import * as cheerio from 'cheerio';

type Currency = 'USD' | 'EUR';

@Injectable()
export class ExchangesBcvService {
  private readonly logger = new Logger(ExchangesBcvService.name);
  private readonly BCV_URL = 'https://bcv.org.ve';
  private readonly agent = new https.Agent({
    rejectUnauthorized: false,
  });

  private readonly CURRENCY_SELECTOR_MAP: Record<Currency, string> = {
    USD: '#dolar',
    EUR: '#euro',
  };

  async getBcvExchangeRate(currency: Currency): Promise<number | null> {
    try {
      this.logger.log(`Fetching ${currency} exchange rate from BCV...`);

      const response = await axios.get(this.BCV_URL, {
        httpsAgent: this.agent,
      });

      const $ = cheerio.load(response.data);

      const selector = this.CURRENCY_SELECTOR_MAP[currency];
      if (!selector) {
        this.logger.error(`Invalid currency: ${currency}`);
        return null;
      }

      const elementText = $(
        `${selector} > .field-content > .row > .centrado > strong`
      )
        .text()
        .trim();

      if (!elementText) {
        this.logger.warn(`No exchange rate found for ${currency}`);
        return null;
      }

      const bcvValue = parseFloat(elementText.replace(',', '.'));

      if (isNaN(bcvValue)) {
        this.logger.error(`Failed to parse ${currency} exchange rate: ${elementText}`);
        return null;
      }

      this.logger.log(`${currency} exchange rate from BCV: ${bcvValue}`);
      return bcvValue;
    } catch (error) {
      this.logger.error(`Error fetching ${currency} exchange rate from BCV: ${error.message}`);
      return null;
    }
  }

  async getUsdExchangeRate(): Promise<number | null> {
    return this.getBcvExchangeRate('USD');
  }

  async getEurExchangeRate(): Promise<number | null> {
    return this.getBcvExchangeRate('EUR');
  }
}
