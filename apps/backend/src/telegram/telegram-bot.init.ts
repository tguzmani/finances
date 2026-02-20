import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { BOT_COMMANDS } from './telegram.types';

@Injectable()
export class TelegramBotInit implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotInit.name);

  constructor(@InjectBot() private readonly bot: Telegraf) {}

  async onModuleInit() {
    try {
      await this.bot.telegram.setMyCommands(
        BOT_COMMANDS.map(cmd => ({
          command: cmd.command,
          description: cmd.description,
        }))
      );

      this.logger.log('✅ Bot commands menu registered successfully');

      const botInfo = await this.bot.telegram.getMe();
      this.logger.log(`🤖 Bot started: @${botInfo.username}`);
    } catch (error) {
      this.logger.error(`Failed to register bot commands: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    this.logger.log('Stopping Telegram bot polling...');
    this.bot.stop('App shutting down');
    this.logger.log('Telegram bot polling stopped');
  }
}
