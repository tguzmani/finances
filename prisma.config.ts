import 'dotenv/config';
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Use DIRECT_DATABASE_URL for migrations (port 5432, no pgBouncer)
    url: env("DIRECT_DATABASE_URL"),
  },
});
