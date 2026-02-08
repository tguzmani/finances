import { Injectable, Logger } from '@nestjs/common';
import * as chrono from 'chrono-node';

@Injectable()
export class DateParserService {
  private readonly logger = new Logger(DateParserService.name);

  /**
   * Parse natural language date input with Spanish locale support
   * @param input - Natural language date string (e.g., "now", "ayer", "yesterday", "Dec 25", "2 days ago")
   * @returns Parsed Date object or null if parsing fails
   *
   * Edge cases handled:
   * - If no year specified, uses current year
   * - "now" returns current moment
   * - Supports both Spanish and English input (tries Spanish first, then English)
   *
   * Note: chrono-node automatically uses current year if not specified
   */
  parseNaturalLanguageDate(input: string): Date | null {
    try {
      // Handle "now" explicitly
      const normalized = input.toLowerCase().trim();
      if (normalized === 'now' || normalized === 'ahora') {
        return new Date();
      }

      // Try Spanish locale first
      let parsed = chrono.es.parseDate(input);

      // If Spanish parsing failed, try English locale
      if (!parsed) {
        parsed = chrono.parseDate(input);
      }

      if (!parsed) {
        this.logger.warn(`Failed to parse date: "${input}"`);
        return null;
      }

      // Chrono automatically uses current year if not specified
      this.logger.log(`Parsed "${input}" as ${parsed.toISOString()}`);
      return parsed;
    } catch (error) {
      this.logger.error(`Error parsing date "${input}": ${error.message}`);
      return null;
    }
  }

  /**
   * Parse date for Venezuela context
   * @param input - Natural language date string
   * @returns Parsed Date object in UTC, but interpreted as Venezuela time
   *
   * Note: Interprets user input as Venezuela time (America/Caracas, UTC-4) and converts to UTC
   * Example: "hoy a la 1 pm" = 1 PM Venezuela time = 5 PM UTC
   */
  parseVenezuelaDate(input: string): Date | null {
    const parsed = this.parseNaturalLanguageDate(input);
    if (!parsed) {
      return null;
    }

    // chrono parses dates assuming server timezone (UTC)
    // But we want to interpret user input as Venezuela time
    // Venezuela is UTC-4, so we need to add 4 hours to convert local interpretation to UTC
    const venezuelaOffset = 4 * 60; // Venezuela is UTC-4 (4 hours * 60 minutes)
    const adjustedDate = new Date(parsed.getTime() + venezuelaOffset * 60 * 1000);

    this.logger.log(`Adjusted Venezuela date "${input}": ${parsed.toISOString()} -> ${adjustedDate.toISOString()}`);
    return adjustedDate;
  }

  /**
   * Get current date/time in Venezuela timezone
   * @returns Current Date object
   */
  getNowVenezuela(): Date {
    return new Date();
  }
}
