import axios from 'axios';
import { ExchangesBcvService } from './exchanges-bcv.service';

describe('ExchangesBcvService', () => {
  const service = new ExchangesBcvService();
  const get = jest.spyOn(axios, 'get');

  afterEach(() => get.mockReset());
  afterAll(() => get.mockRestore());

  const officialRate = (rate: string, id = 'euro') => ({
    data: `<div id="${id}"><div class="field-content"><div class="row">
      <div class="centrado"><strong>${rate}</strong></div>
    </div></div></div>`,
  });

  const fallbackRate = (rate: string) => ({
    data: `<div class="from-blue-50 to-indigo-50">
      <div class="text-3xl font-bold text-slate-800 mb-2">${rate}</div>
    </div>`,
  });

  it.each([
    ['1.011,73252690', 1011.7325269],
    ['1012,21844036', 1012.21844036],
  ])('reads the BCV rate %s in Venezuelan notation', async (text, value) => {
    get.mockResolvedValueOnce(officialRate(text));

    await expect(service.getEurExchangeRate()).resolves.toBe(value);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('accepts an official USD rate below the EUR minimum', async () => {
    get.mockResolvedValueOnce(officialRate('924,35340000', 'dolar'));

    await expect(service.getUsdExchangeRate()).resolves.toBe(924.3534);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('falls back when the official EUR rate is below the minimum', async () => {
    get.mockResolvedValueOnce(officialRate('1,01'));
    get.mockResolvedValueOnce(fallbackRate('1011.73 Bs/EUR'));

    await expect(service.getEurExchangeRate()).resolves.toBe(1011.73);
  });

  it('rejects EUR rates that round to 1000 or less from either source', async () => {
    get.mockResolvedValueOnce(officialRate('1.000,004'));
    get.mockResolvedValueOnce(fallbackRate('999.77 Bs/EUR'));

    await expect(service.getEurExchangeRate()).resolves.toBeNull();
  });

  it('uses the fallback decimal rate when BCV has malformed grouping', async () => {
    get.mockResolvedValueOnce(officialRate('1.07,96'));
    get.mockResolvedValueOnce(fallbackRate('1011.180 Bs/EUR'));

    await expect(service.getEurExchangeRate()).resolves.toBe(1011.18);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('rejects nonpositive and partially numeric rates', async () => {
    get.mockResolvedValueOnce(officialRate('0,00'));
    get.mockResolvedValueOnce(fallbackRate('1011.18 unexpected text'));

    await expect(service.getEurExchangeRate()).resolves.toBeNull();
  });
});
