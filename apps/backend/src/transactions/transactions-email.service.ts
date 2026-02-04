import { Injectable, Logger } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';

export interface RawEmail {
  subject: string;
  body: string;
  date: Date;
}

@Injectable()
export class TransactionsEmailService {
  private readonly logger = new Logger(TransactionsEmailService.name);

  private readonly BANESCO_SENDER = 'Notificacion@banesco.com';
  private readonly VALID_SUBJECTS = [
    'Notificación Banesco',
    'Resumen de Operaciones con TDD Banesco',
  ];

  private createClient(): ImapFlow {
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
    const client = this.createClient();
    const emails: RawEmail[] = [];

    try {
      await client.connect();
      this.logger.log('Connected to IMAP server');

      const lock = await client.getMailboxLock('INBOX');

      try {
        // Search for emails from Banesco
        const searchResults = await client.search({
          from: this.BANESCO_SENDER,
        });

        // Handle case where search returns false or empty
        if (!searchResults || !Array.isArray(searchResults) || searchResults.length === 0) {
          this.logger.log('No emails found from Banesco');
          return [];
        }

        // Get the most recent emails (up to limit)
        const uids = searchResults.slice(-limit).reverse();

        for (const uid of uids) {
          try {
            const message = await client.fetchOne(uid, {
              source: true,
            });

            if (message && typeof message !== 'boolean' && message.source) {
              const parsed = await simpleParser(message.source);
              const email = this.extractEmail(parsed);

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

    this.logger.log(`Fetched ${emails.length} valid emails`);
    return emails;
  }

  private extractEmail(parsed: ParsedMail): RawEmail | null {
    const subject = parsed.subject || '';

    // Check if subject matches valid Banesco subjects
    const isValidSubject = this.VALID_SUBJECTS.some((valid) =>
      subject.includes(valid)
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
    };
  }
}
