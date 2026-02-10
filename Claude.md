# Notas Importantes para Claude

## Idioma de la Aplicación

**IMPORTANTE:** Todos los mensajes, textos de interfaz, nombres de variables y comentarios en el código DEBEN estar en **inglés**.

- Aunque tú y yo hablemos en español durante el desarrollo, el código debe estar completamente en inglés
- Esto incluye: mensajes del bot, etiquetas UI, logs, comentarios, nombres de variables, etc.
- Mantener consistencia con el resto de la aplicación que ya está en inglés

## Arquitectura del Bot de Telegram

### Registro de Comandos
**IMPORTANTE:** Para que un comando de Telegram sea invocado correctamente, DEBE estar registrado en el archivo principal `apps/backend/src/telegram/telegram.update.ts`.

#### Patrón correcto:

1. **Crear la funcionalidad en su propio update file:**
   - Ejemplo: `apps/backend/src/telegram/rates/telegram-rates.update.ts`
   - Este archivo contiene la lógica del comando con `@Command('command_name')`

2. **Registrar en telegram.update.ts:**
   - Importar el update específico
   - Inyectarlo en el constructor
   - Crear un método que delegue la ejecución

**Ejemplo:**

```typescript
// En telegram.update.ts
import { TelegramRatesUpdate } from './rates/telegram-rates.update';

export class TelegramUpdate {
  constructor(
    // ... otros servicios
    private readonly ratesUpdate: TelegramRatesUpdate,
  ) { }

  @Command('rates')
  @UseGuards(TelegramAuthGuard)
  async handleRates(@Ctx() ctx: SessionContext) {
    await this.ratesUpdate.handleRates(ctx);
  }
}
```

#### ¿Por qué es necesario?

El decorador `@Update()` en el archivo principal (`telegram.update.ts`) es el que registra los comandos con el bot de Telegram. Los comandos en otros archivos `@Update()` no se registran automáticamente a menos que sean invocados desde el archivo principal.

### Ejemplos de comandos que siguen este patrón:

- `/add_transaction` → delega a `manualTransactionUpdate.handleAddTransaction(ctx)`
- `/rates` → delega a `ratesUpdate.handleRates(ctx)`
- `/accounts` → delega a `accountsUpdate.handleAccounts(ctx)`

### No olvidar:

- Agregar el comando al mensaje de `/help`
- Registrar todos los providers necesarios en `telegram.module.ts`
- Mantener la arquitectura de 3 capas: Update → Service → Presenter

## Schedulers en Telegram

### Configuración de tareas programadas

Para crear tareas programadas que envíen mensajes automáticamente:

1. **Crear el scheduler en el directorio del feature:**
   - Ejemplo: `telegram/rates/telegram-rates.scheduler.ts`
   - Usar `@Injectable()` y `@Cron()` decorators
   - Inyectar `@InjectBot()` para acceder al bot de Telegram

2. **Timezone considerations:**
   - El servidor usa **UTC**
   - Venezuela está en **UTC-4** (VET)
   - Para enviar a las 9 AM Venezuela: usar cron `'0 13 * * *'` (13:00 UTC)
   - Siempre documentar la conversión de zona horaria

3. **Variables de entorno requeridas:**
   - `TELEGRAM_ALLOWED_USERS`: Lista de user IDs permitidos (separados por coma)
   - El scheduler usa el primer ID de la lista para enviar mensajes: `process.env.TELEGRAM_ALLOWED_USERS?.split(',')[0]`
   - Mismo patrón que `TelegramNotificationListener` para consistencia
   - Validar que exista antes de ejecutar tareas programadas

4. **Ejemplo de estructura:**
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

5. **Registrar en el módulo:**
   - Agregar al array `providers` en `telegram.module.ts`
   - `ScheduleModule.forRoot()` debe estar importado en `AppModule`
