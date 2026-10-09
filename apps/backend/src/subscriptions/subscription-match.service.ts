import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { OpenRouterService } from '../common/open-router.service';
import { SubscriptionRow } from './subscriptions-sheets.service';

const MatchSchema = z.object({
  /** Catalog name, copied verbatim. Null when the charge is not a subscription. */
  name: z.string().nullable(),
  /** The service this charge pays for, when it is new to the catalog. */
  newName: z.string().nullable(),
});

type MatchDraft = z.infer<typeof MatchSchema>;

export interface SubscriptionMatch {
  /** The catalog row this charge belongs to. */
  row: SubscriptionRow | null;
  /** Name for a service the catalog does not have yet. */
  newName: string | null;
}

const SYSTEM_PROMPT = `You match a card charge to a subscription the user already pays for.

The charge text comes from a bank or Google Play email, so it names the billing channel as often as the service: "Google Play - Premium Individual (Spotify: Music and Podcasts)" is Spotify, "GOOGLE YouTube" is YouTube, "ANTHROPIC" is Claude. The same service is worded differently from one month to the next.

Return JSON with:
- name: the catalog entry this charge pays for, copied EXACTLY as it appears in the list. Null when none of them is the service.
- newName: when name is null AND the charge is still some software or media service being paid for, the service's own short name, as a person would write it ("MacroDroid", "Notion", "iCloud"). Null when the charge is an ordinary purchase rather than a service.

Judge by the service being paid for, never by the channel. Several catalog entries can bill through Google Play, so "Google Play" on its own settles nothing.

The charge text alone decides the match. The service has to be recognisable in the wording — its name, its company, or the product it sells. Only once the wording has identified a service do the expected day and cost come in, and only to confirm it.

A charge whose text names something unrelated to every catalog entry is not a match, however exactly the amount and the day line up. "AMAZON MKTPL*2X4F9" for 7.99 on day 7 is a purchase from Amazon, not the 7.99 subscription that bills on day 7. Matching on numbers alone writes a charge onto a service that was never billed, and hides the one that was.

Return name null rather than guessing.`;

@Injectable()
export class SubscriptionMatchService {
  private readonly logger = new Logger(SubscriptionMatchService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  async match(
    description: string,
    amount: number,
    date: Date,
    catalog: SubscriptionRow[],
  ): Promise<SubscriptionMatch> {
    const list = catalog
      .map((s) => `- ${s.name} (expected $${s.cost ?? '?'} around day ${s.day ?? '?'}${s.active ? '' : ', currently off'})`)
      .join('\n');

    const userMessage =
      `Charge:\n- Description: "${description}"\n- Amount: ${amount} USD\n- Day of month: ${date.getDate()}\n\n` +
      `Catalog:\n${list || '(empty)'}`;

    const draft = await this.openRouter.chatStructured<MatchDraft>(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      MatchSchema,
      { schemaName: 'subscription_match', temperature: 0, maxTokens: 100 },
    );

    const row = draft.name
      ? catalog.find((s) => s.name.toLowerCase() === draft.name.toLowerCase()) ?? null
      : null;

    if (draft.name && !row) {
      this.logger.warn(`LLM returned "${draft.name}", which is not in the catalog`);
    }

    this.logger.log(
      `Matched "${description}" -> ${row ? row.name : draft.newName ?? 'no subscription'}`,
    );

    return { row, newName: row ? null : draft.newName };
  }
}
