import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EquityItaFetchService {
  private readonly logger = new Logger(EquityItaFetchService.name);
  private readonly BASE = 'https://ita.secureaccountaccess.com';

  async getItaAccountValue(): Promise<number> {
    const user = process.env.ITA_USER;
    const pass = process.env.ITA_PASS;

    if (!user || !pass) {
      this.logger.warn('ITA_USER or ITA_PASS not configured');
      return 0;
    }

    let allCookies = '';

    try {
      // Get login page and CSRF token
      const loginPageRes = await fetch(`${this.BASE}/Account/Login`);
      const cookies = (loginPageRes.headers.getSetCookie?.() || []).map(
        (h) => h.split(';')[0],
      );
      const html = await loginPageRes.text();

      const csrfToken = html.match(
        /name="__RequestVerificationToken".*?value="([^"]+)"/,
      )?.[1];
      if (!csrfToken) throw new Error('No CSRF token found');

      // Login
      const loginRes = await fetch(`${this.BASE}/Account/Login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          Cookie: cookies.join('; '),
        },
        body: new URLSearchParams({
          UserName: user,
          Password: pass,
          __RequestVerificationToken: csrfToken,
          LockSession: 'true',
        }),
      });

      const loginBody = await loginRes.text();
      if (loginRes.status !== 200 || loginBody.includes('ShowLockSession')) {
        throw new Error(`Login failed: ${loginBody.substring(0, 100)}`);
      }

      allCookies = [
        ...cookies,
        ...(loginRes.headers.getSetCookie?.() || []).map(
          (h) => h.split(';')[0],
        ),
      ].join('; ');

      // Fetch portfolio data
      const dataRes = await fetch(
        `${this.BASE}/Home/GetPartialPolicyAccountValueContent?ID=18_T25W040806&AccountNumber=T25W040806`,
        {
          headers: {
            Cookie: allCookies,
            'X-Requested-With': 'XMLHttpRequest',
          },
        },
      );

      const body = await dataRes.text();
      const amounts = [...body.matchAll(/\$([0-9,.]+)/g)].map((m) =>
        parseFloat(m[1].replace(/,/g, '')),
      );

      const accountValue = amounts[1] || 0;
      this.logger.log(`ITA account value: $${accountValue}`);
      return accountValue;
    } catch (error) {
      this.logger.error(`Failed to fetch ITA account value: ${error.message}`);
      throw error;
    } finally {
      await this.logout(allCookies);
    }
  }

  private async logout(cookies: string): Promise<void> {
    if (!cookies) return;

    try {
      await fetch(`${this.BASE}/Account/LogOff`, {
        method: 'POST',
        headers: {
          Cookie: cookies,
          'X-Requested-With': 'XMLHttpRequest',
        },
        redirect: 'manual',
      });
      this.logger.log('ITA session logged out successfully');
    } catch (error) {
      this.logger.warn(`Failed to log out of ITA: ${error.message}`);
    }
  }
}
