/*
  Warnings:

  - You are about to drop the column `source` on the `transactions` table. All the data in the column will be lost.
  - Added the required column `platform` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/

-- CreateEnum
CREATE TYPE "TransactionPlatform" AS ENUM ('BANESCO', 'BINANCE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('DEBIT_CARD', 'PAGO_MOVIL');

-- AlterTable: Add new columns (nullable temporarily)
ALTER TABLE "transactions"
ADD COLUMN "platform" "TransactionPlatform",
ADD COLUMN "method" "PaymentMethod";

-- Data Migration: Migrate BANESCO transactions
UPDATE "transactions"
SET "platform" = 'BANESCO'::"TransactionPlatform",
    "method" = 'DEBIT_CARD'::"PaymentMethod"
WHERE "source" = 'BANESCO'::"TransactionSource";

-- Data Migration: Migrate BINANCE transactions
UPDATE "transactions"
SET "platform" = 'BINANCE'::"TransactionPlatform",
    "method" = NULL
WHERE "source" = 'BINANCE'::"TransactionSource";

-- AlterTable: Make platform NOT NULL
ALTER TABLE "transactions"
ALTER COLUMN "platform" SET NOT NULL;

-- AlterTable: Drop old source column
ALTER TABLE "transactions"
DROP COLUMN "source";

-- DropEnum
DROP TYPE "TransactionSource";
