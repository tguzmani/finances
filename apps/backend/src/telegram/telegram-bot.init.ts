import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { BOT_COMMANDS } from './telegram.types';

@Injectable()
export class TelegramBotInit implements OnModuleInit {
  private readonly logger = new Logger(TelegramBotInit.name);

  constructor(@InjectBot() private readonly bot: Telegraf) {}

  async onModuleInit() {
    try {
      // Registrar los comandos en el menú del bot
      await this.bot.telegram.setMyCommands(
        BOT_COMMANDS.map(cmd => ({
          command: cmd.command,
          description: cmd.description,
        }))
      );

      this.logger.log('✅ Bot commands menu registered successfully');

      // Log bot info
      const botInfo = await this.bot.telegram.getMe();
      this.logger.log(`🤖 Bot started: @${botInfo.username}`);
    } catch (error) {
      this.logger.error(`Failed to register bot commands: ${error.message}`);
    }
  }
}
