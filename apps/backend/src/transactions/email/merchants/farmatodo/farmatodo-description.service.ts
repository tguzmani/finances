import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { OpenRouterService } from '../../../../common/open-router.service';

const FarmatodoDescriptionSchema = z.object({
  description: z.string().min(1),
});

type FarmatodoDescription = z.infer<typeof FarmatodoDescriptionSchema>;

const MAX_WORDS = 3;
const FALLBACK_DESCRIPTION = 'Farmatodo';

const SYSTEM_PROMPT = `You summarize a Farmatodo (Venezuelan pharmacy) order into a very short expense description for a personal accounting journal.

Rules:
- Between 1 and ${MAX_WORDS} words. Never more than ${MAX_WORDS}.
- Spanish, no punctuation, no quantities, no prices, no brand names unless the brand IS the product.
- Describe WHAT was bought as an expense category, not the individual items.
- If the order mixes unrelated things, use a generic umbrella term.

Examples:
Items: "ACETAMINOFEN 500MG x2, IBUPROFENO 400MG x1" -> {"description":"Medicinas"}
Items: "SHAMPOO PANTENE 400ML, JABON DOVE x3" -> {"description":"Cuidado personal"}
Items: "LECHE ENTERA 1L, PAN SANDWICH, HUEVOS x12" -> {"description":"Mercado Farmatodo"}
Items: "PAÑALES HUGGIES XG, TOALLITAS HUMEDAS" -> {"description":"Pañales bebé"}
Items: "AMOXICILINA 500MG, VITAMINA C, ALCOHOL ISOPROPILICO" -> {"description":"Medicinas"}`;

@Injectable()
export class FarmatodoDescriptionService {
  private readonly logger = new Logger(FarmatodoDescriptionService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  /**
   * Turns the raw product list into a 1-3 word description.
   * Never throws — falls back to "Farmatodo" so the transaction is still registered.
   */
  async generate(items: string, orderNumber: string): Promise<string> {
    if (!items.trim()) {
      this.logger.warn(`No items found for Farmatodo order #${orderNumber}, using fallback description`);
      return FALLBACK_DESCRIPTION;
    }

    try {
      const result = await this.openRouter.chatStructured<FarmatodoDescription>(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Items: "${items}"` },
        ],
        FarmatodoDescriptionSchema,
        { schemaName: 'farmatodo_description', temperature: 0.1, maxTokens: 50 },
      );

      const description = this.trimToMaxWords(result.description);
      this.logger.log(`Farmatodo order #${orderNumber} description: "${description}"`);
      return description;
    } catch (error) {
      this.logger.error(
        `Failed to generate description for Farmatodo order #${orderNumber}: ${error.message}`,
      );
      return FALLBACK_DESCRIPTION;
    }
  }

  /** The word limit is a hard requirement, so enforce it instead of trusting the model. */
  private trimToMaxWords(description: string): string {
    const words = description.trim().replace(/[.,;:]+$/g, '').split(/\s+/).filter(Boolean);
    if (words.length === 0) return FALLBACK_DESCRIPTION;
    return words.slice(0, MAX_WORDS).join(' ');
  }
}
