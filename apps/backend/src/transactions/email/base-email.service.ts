import { Logger } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import { RawEmail, BankEmailConfig } from './email.interfaces';

export abstract class BaseEmailService {
  protected readonly logger: Logger;

  constructor(loggerContext: string) {
    this.logger = new Logger(loggerContext);
  }

  protected abstract getBankConfig(): BankEmailConfig;

  protected createClient(): ImapFlow {
    return new ImapFlow({
      host: process.env.IMAP_HOST || 'imap.gmail.com',
      port: parseInt(process.env.IMAP_PORT || '993', 10),
      secure: true,
      auth: {
        user: process.env.IMAP_USER || '',
        pass: process.env.IMAP_PASSWORD || '',
      },
      logger: false,
    });
  }

  async fetchEmails(limit = 30): Promise<RawEmail[]> {
    const config = this.getBankConfig();
    const client = this.createClient();
    const emails: RawEmail[] = [];

    try {
      await client.connect();
      this.logger.log(`Connected to IMAP for ${config.sender}`);

      const lock = await client.getMailboxLock('INBOX');

      try {
        const searchResults = await client.search({
          from: config.sender,
        });

        if (!searchResults || !Array.isArray(searchResults) || searchResults.length === 0) {
          this.logger.log(`No emails found from ${config.sender}`);
          return [];
        }

        const uids = searchResults.slice(-limit).reverse();

        for (const uid of uids) {
          try {
            const message = await client.fetchOne(uid, {
              source: true,
            });

            if (message && typeof message !== 'boolean' && message.source) {
              const parsed = await simpleParser(message.source);
              const email = this.extractEmail(parsed, config);

              if (email) {
                emails.push(email);
              }
            }
          } catch (err) {
            this.logger.warn(`Failed to fetch email ${uid}: ${(err as Error).message}`);
          }
        }
      } finally {
        lock.release();
      }
    } catch (err) {
      this.logger.error(`IMAP error: ${(err as Error).message}`);
      throw err;
    } finally {
      await client.logout();
    }

    this.logger.log(`Fetched ${emails.length} valid emails from ${config.sender}`);
    return emails;
  }

  protected extractEmail(parsed: ParsedMail, config: BankEmailConfig): RawEmail | null {
    const subject = parsed.subject || '';

    const isValidSubject = config.subjectPatterns.some((pattern) =>
      subject.includes(pattern) || subject.startsWith(pattern)
    );

    if (!isValidSubject) {
      return null;
    }

    const body = parsed.text || '';
    const date = parsed.date || new Date();

    return {
      subject,
      body,
      date,
      from: parsed.from?.text,
    };
  }
}
