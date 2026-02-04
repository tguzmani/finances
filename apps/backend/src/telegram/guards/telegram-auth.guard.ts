import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { TelegrafExecutionContext } from 'nestjs-telegraf';
import { Context } from 'telegraf';

@Injectable()
export class TelegramAuthGuard implements CanActivate {
  private readonly logger = new Logger(TelegramAuthGuard.name);
  private readonly allowedUsers: Set<number>;

  constructor() {
    const userIds = process.env.TELEGRAM_ALLOWED_USERS?.split(',') || [];
    this.allowedUsers = new Set(
      userIds.map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
    );

    if (this.allowedUsers.size === 0) {
      this.logger.warn('⚠️  No allowed Telegram users configured!');
    } else {
      this.logger.log(`✅ Configured ${this.allowedUsers.size} allowed user(s)`);
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const ctx = TelegrafExecutionContext.create(context).getContext<Context>();
    const userId = ctx.from?.id;

    if (!userId) {
      this.logger.warn('No user ID in request');
      return false;
    }

    const isAllowed = this.allowedUsers.has(userId);

    if (!isAllowed) {
      this.logger.warn(`🚫 Unauthorized access attempt from user ${userId}`);
      ctx.reply('Unauthorized. Contact the bot administrator.');
    } else {
      this.logger.log(`✅ Authorized user ${userId} accessed command`);
    }

    return isAllowed;
  }
}
