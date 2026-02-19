# Finance App - Development Guidelines

## Build & Run

- **Build/serve**: `pnpm serve` (runs `nx serve backend`)
- **Debug mode**: `pnpm serve:debug`
- **Prisma generate**: `pnpm prisma:generate`
- **Prisma migrate**: `pnpm prisma:migrate`

## Application Language

**IMPORTANT:** All messages, UI text, variable names, and code comments MUST be in **English**.

- Even if we communicate in Spanish during development, all code must be fully in English
- This includes: bot messages, UI labels, logs, comments, variable names, etc.
- Maintain consistency with the rest of the app which is already in English

## Timezone Rules

1. **Storage**: Always store in UTC (database stores plain timestamps, we treat them as UTC)
2. **Display**: Always use `timeZone: 'America/Caracas'` in toLocaleString/toLocaleTimeString

## Telegram Bot Architecture

### Command Registration

**IMPORTANT:** For a Telegram command to be invoked correctly, it MUST be registered in the main file `apps/backend/src/telegram/telegram.update.ts`.

#### Correct pattern:

1. **Create the feature in its own update file:**
   - Example: `apps/backend/src/telegram/rates/telegram-rates.update.ts`
   - This file contains the command logic with `@Command('command_name')`

2. **Register in telegram.update.ts:**
   - Import the specific update
   - Inject it in the constructor
   - Create a method that delegates execution

**Example:**

```typescript
// In telegram.update.ts
import { TelegramRatesUpdate } from './rates/telegram-rates.update';

export class TelegramUpdate {
  constructor(
    // ... other services
    private readonly ratesUpdate: TelegramRatesUpdate,
  ) { }

  @Command('rates')
  @UseGuards(TelegramAuthGuard)
  async handleRates(@Ctx() ctx: SessionContext) {
    await this.ratesUpdate.handleRates(ctx);
  }
}
```

#### Why is this necessary?

The `@Update()` decorator in the main file (`telegram.update.ts`) is what registers commands with the Telegram bot. Commands in other `@Update()` files are not automatically registered unless invoked from the main file.

### Examples of commands following this pattern:

- `/add_transaction` → delegates to `manualTransactionUpdate.handleAddTransaction(ctx)`
- `/rates` → delegates to `ratesUpdate.handleRates(ctx)`
- `/accounts` → delegates to `accountsUpdate.handleAccounts(ctx)`

### Checklist:

- Add the command to the `/help` message
- Register all required providers in `telegram.module.ts`
- Maintain the 3-layer architecture: Update → Service → Presenter

## Telegram Schedulers

### Scheduled tasks configuration

To create scheduled tasks that send messages automatically:

1. **Create the scheduler in the feature directory:**
   - Example: `telegram/rates/telegram-rates.scheduler.ts`
   - Use `@Injectable()` and `@Cron()` decorators
   - Inject `@InjectBot()` to access the Telegram bot

2. **Timezone considerations:**
   - The server uses **UTC**
   - Venezuela is at **UTC-4** (VET)
   - To send at 9 AM Venezuela time: use cron `'0 13 * * *'` (13:00 UTC)
   - Always document the timezone conversion

3. **Required environment variables:**
   - `TELEGRAM_ALLOWED_USERS`: List of allowed user IDs (comma-separated)
   - The scheduler uses the first ID from the list: `process.env.TELEGRAM_ALLOWED_USERS?.split(',')[0]`
   - Same pattern as `TelegramNotificationListener` for consistency
   - Validate it exists before running scheduled tasks

4. **Example structure:**
```typescript
@Injectable()
export class TelegramRatesScheduler {
  private readonly chatId: string;

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly ratesService: TelegramRatesService,
  ) {
    // Get chatId from environment variable (same pattern as notification listener)
    this.chatId = process.env.TELEGRAM_ALLOWED_USERS?.split(',')[0] || '';
  }

  @Cron('0 13 * * *', { timeZone: 'UTC' })
  async sendDailyRates() {
    if (!this.chatId) return;

    const message = await this.ratesService.getRatesMessage();
    await this.bot.telegram.sendMessage(this.chatId, message, { parse_mode: 'HTML' });
  }
}
```

5. **Register in the module:**
   - Add to the `providers` array in `telegram.module.ts`
   - `ScheduleModule.forRoot()` must be imported in `AppModule`
