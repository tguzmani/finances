import { Update, Ctx, Action } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { UseGuards, Logger } from '@nestjs/common';
import { TelegramAuthGuard } from '../guards/telegram-auth.guard';
import { SessionContext } from '../telegram.types';
import { TelegramSettingsService } from './telegram-settings.service';

@Update()
export class TelegramSettingsUpdate {
  private readonly logger = new Logger(TelegramSettingsUpdate.name);

  constructor(private readonly settingsService: TelegramSettingsService) {}

  async handleSettings(@Ctx() ctx: SessionContext) {
    try {
      const buttons = [
        [Markup.button.callback('Update Sheets ID', 'settings_update_sheet_id')],
      ];

      const testCount = await this.settingsService.countTestTransactions();
      if (testCount > 0) {
        buttons.push([
          Markup.button.callback(`Delete Test Tx (${testCount})`, 'settings_delete_test_tx'),
        ]);
      }

      const keyboard = Markup.inlineKeyboard(buttons);

      await ctx.reply('<b>Settings</b>\n\nSelect an option:', {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } catch (error) {
      this.logger.error(`Error in /settings command: ${error.message}`);
      await ctx.reply('Error loading settings menu. Please try again.');
    }
  }

  @Action('settings_update_sheet_id')
  @UseGuards(TelegramAuthGuard)
  async handleUpdateSheetId(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      ctx.session.settingsWaitingForSheetId = true;
      await ctx.reply('Enter the new Google Sheets ID:');
    } catch (error) {
      this.logger.error(`Error starting Sheet ID update: ${error.message}`);
      await ctx.reply('Error starting update. Please try again.');
    }
  }

  @Action('settings_delete_test_tx')
  @UseGuards(TelegramAuthGuard)
  async handleDeleteTestTx(@Ctx() ctx: SessionContext) {
    try {
      await ctx.answerCbQuery();
      const result = await this.settingsService.deleteTestTransactions();
      await ctx.reply(result, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error(`Error deleting test transactions: ${error.message}`);
      await ctx.reply('Error deleting test transactions. Please try again.');
    }
  }

  async handleSheetIdInput(@Ctx() ctx: SessionContext) {
    try {
      if (!ctx.message || !('text' in ctx.message)) return;

      const googleSheetId = ctx.message.text.trim();
      if (!googleSheetId) {
        await ctx.reply('Invalid Sheet ID. Please enter a valid ID.');
        return;
      }

      ctx.session.settingsWaitingForSheetId = false;
      const result = await this.settingsService.saveSheetId(googleSheetId);
      await ctx.reply(result, { parse_mode: 'HTML' });
    } catch (error) {
      ctx.session.settingsWaitingForSheetId = false;
      this.logger.error(`Error saving Sheet ID: ${error.message}`);
      await ctx.reply('Error saving Sheet ID. Please try again.');
    }
  }
}
