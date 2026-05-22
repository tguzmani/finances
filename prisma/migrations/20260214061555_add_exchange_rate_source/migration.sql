-- CreateEnum
CREATE TYPE "ExchangeRateSource" AS ENUM ('INTERNAL', 'BINANCE_P2P');

-- AlterTable
ALTER TABLE "exchange_rates" ADD COLUMN     "source" "ExchangeRateSource" NOT NULL DEFAULT 'INTERNAL';

-- CreateIndex
CREATE INDEX "exchange_rates_source_idx" ON "exchange_rates"("source");
