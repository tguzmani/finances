import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';

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

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly API_URL = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';

  async chat(
    messages: OpenRouterMessage[],
    options: OpenRouterOptions = {},
  ): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
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
            'Authorization': `Bearer ${apiKey}`,
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
}
