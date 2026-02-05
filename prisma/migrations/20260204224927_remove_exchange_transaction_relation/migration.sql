-- AlterTable: Remove exchange_id foreign key and column from transactions
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_exchange_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "transactions_exchange_id_idx";

-- AlterTable: Set all exchange_id values to NULL before dropping
UPDATE "transactions" SET "exchange_id" = NULL WHERE "exchange_id" IS NOT NULL;

-- AlterTable: Drop the exchange_id column
ALTER TABLE "transactions" DROP COLUMN "exchange_id";
