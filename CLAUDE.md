# Finance App - Development Guidelines

## Build & Run

- **Build/serve**: `pnpm serve` (runs `nx serve backend`)
- **Debug mode**: `pnpm serve:debug`
- **Prisma generate**: `pnpm prisma:generate`
- **Prisma migrate**: `pnpm prisma:migrate`

## Timezone Rules

1. **Storage**: Always store in UTC (database stores plain timestamps, we treat them as UTC)
2. **Display**: Always use `timeZone: 'America/Caracas'` in toLocaleString/toLocaleTimeString
