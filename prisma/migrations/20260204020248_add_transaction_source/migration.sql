/*
  Warnings:

  - Added the required column `source` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('BANESCO', 'BINANCE');

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_exchange_id_fkey";

-- Add column as nullable first
ALTER TABLE "transactions" ADD COLUMN "source" "TransactionSource";

-- Update existing rows with BANESCO as default (since existing transactions are from email)
UPDATE "transactions" SET "source" = 'BANESCO' WHERE "source" IS NULL;

-- Make column NOT NULL
ALTER TABLE "transactions" ALTER COLUMN "source" SET NOT NULL;

-- AddForeignKey with CASCADE delete
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_exchange_id_fkey" FOREIGN KEY ("exchange_id") REFERENCES "exchanges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
