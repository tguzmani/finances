import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { z, ZodType } from 'zod';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** Shape of GET /credits — the account's lifetime totals, with no balance field */
export interface OpenRouterCredits {
  total_credits: number;
  total_usage: number;
}

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly API_BASE = 'https://openrouter.ai/api/v1';
  private readonly API_URL = `${this.API_BASE}/chat/completions`;
  private readonly CREDITS_URL = `${this.API_BASE}/credits`;
  private readonly DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';
  private readonly LOW_BALANCE_THRESHOLD = 1.5; // USD
  private readonly apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    if (!this.apiKey) {
      this.logger.warn('OPENROUTER_API_KEY environment variable is not set');
    }
  }

  async chat(
    messages: OpenRouterMessage[],
    options: OpenRouterOptions = {},
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is not set');
    }

    const model = options.model || this.DEFAULT_MODEL;

    try {
      this.logger.log(`Sending request to OpenRouter with model: ${model}`);

      const response = await axios.post<OpenRouterResponse>(
        this.API_URL,
        {
          model,
          messages,
          temperature: options.temperature ?? 0.1,
          max_tokens: options.maxTokens ?? 500,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_URL || 'https://localhost',
            'X-Title': 'Finances App',
          },
          timeout: 30000,
        },
      );

      const content = response.data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response from OpenRouter');
      }

      this.logger.log(
        `OpenRouter response received. Tokens: ${response.data.usage?.total_tokens || 'unknown'}`,
      );

      return content;
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(
          `OpenRouter API error: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(
          `OpenRouter API error: ${error.response?.data?.error?.message || error.message}`,
        );
      }
      throw error;
    }
  }

  async chatStructured<T>(
    messages: OpenRouterMessage[],
    schema: ZodType<T>,
    options: OpenRouterOptions & { schemaName?: string } = {},
  ): Promise<T> {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is not set');
    }

    const model = options.model || this.DEFAULT_MODEL;
    const schemaName = options.schemaName || 'response';
    const jsonSchema = z.toJSONSchema(schema, { target: 'draft-7' });
    delete (jsonSchema as any).$schema;

    try {
      this.logger.log(`Sending structured request to OpenRouter (model: ${model}, schema: ${schemaName})`);

      const response = await axios.post<OpenRouterResponse>(
        this.API_URL,
        {
          model,
          messages,
          temperature: options.temperature ?? 0.1,
          max_tokens: options.maxTokens ?? 500,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: schemaName,
              strict: true,
              schema: jsonSchema,
            },
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_URL || 'https://localhost',
            'X-Title': 'Finances App',
          },
          timeout: 30000,
        },
      );

      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenRouter');
      }

      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
      else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
      jsonStr = jsonStr.trim();

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        this.logger.error(`Structured response not valid JSON: ${content}`);
        throw new Error(`LLM returned invalid JSON: ${e.message}`);
      }

      const result = schema.safeParse(parsed);
      if (!result.success) {
        this.logger.error(`Schema validation failed: ${JSON.stringify(result.error.issues)}. Raw: ${content}`);
        throw new Error(`LLM response failed schema validation: ${result.error.message}`);
      }

      this.logger.log(
        `OpenRouter structured response received. Tokens: ${response.data.usage?.total_tokens || 'unknown'}`,
      );
      return result.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(
          `OpenRouter API error: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(
          `OpenRouter API error: ${error.response?.data?.error?.message || error.message}`,
        );
      }
      throw error;
    }
  }

  async chatJson<T>(
    messages: OpenRouterMessage[],
    options: OpenRouterOptions = {},
  ): Promise<T> {
    const response = await this.chat(messages, options);

    try {
      let jsonStr = response.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }

      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }

      jsonStr = jsonStr.trim();

      return JSON.parse(jsonStr) as T;
    } catch (error) {
      this.logger.error(`Failed to parse JSON response: ${response}`);
      throw new Error(`Failed to parse LLM response as JSON: ${error.message}`);
    }
  }

  async getCredits(): Promise<OpenRouterCredits> {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is not set');
    }

    try {
      const response = await axios.get<{ data: OpenRouterCredits }>(
        this.CREDITS_URL,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 10000,
        },
      );

      return response.data.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(
          `OpenRouter Credits API error: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`,
        );
        throw new Error(
          `OpenRouter Credits API error: ${error.response?.data?.error?.message || error.message}`,
        );
      }
      throw error;
    }
  }

  async checkBalance(): Promise<{ balance: number; isLow: boolean }> {
    const credits = await this.getCredits();

    if (typeof credits?.total_credits !== 'number' || typeof credits?.total_usage !== 'number') {
      throw new Error(
        `Unexpected /credits response: ${JSON.stringify(credits)}`,
      );
    }

    const balance = credits.total_credits - credits.total_usage;
    const isLow = balance < this.LOW_BALANCE_THRESHOLD;

    if (isLow) {
      this.logger.warn(`OpenRouter balance is low: $${balance.toFixed(2)}`);
    }

    return { balance, isLow };
  }
}
