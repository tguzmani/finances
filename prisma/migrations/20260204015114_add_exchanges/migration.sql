-- CreateEnum
CREATE TYPE "ExchangeStatus" AS ENUM ('COMPLETED', 'PROCESSING', 'PENDING', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "TradeType" AS ENUM ('BUY', 'SELL');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "exchange_id" INTEGER;

-- CreateTable
CREATE TABLE "exchanges" (
    "id" SERIAL NOT NULL,
    "order_number" TEXT NOT NULL,
    "asset" VARCHAR(10) NOT NULL,
    "amount" DECIMAL(18,8) NOT NULL,
    "amount_gross" DECIMAL(18,8) NOT NULL,
    "fiat_symbol" VARCHAR(3) NOT NULL,
    "fiat_amount" DECIMAL(18,2) NOT NULL,
    "exchange_rate" DECIMAL(18,4) NOT NULL,
    "counterparty" VARCHAR(255),
    "trade_type" "TradeType" NOT NULL,
    "status" "ExchangeStatus" NOT NULL DEFAULT 'COMPLETED',
    "binance_created_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchanges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exchanges_order_number_key" ON "exchanges"("order_number");

-- CreateIndex
CREATE INDEX "exchanges_binance_created_at_idx" ON "exchanges"("binance_created_at");

-- CreateIndex
CREATE INDEX "exchanges_status_idx" ON "exchanges"("status");

-- CreateIndex
CREATE INDEX "transactions_exchange_id_idx" ON "transactions"("exchange_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_exchange_id_fkey" FOREIGN KEY ("exchange_id") REFERENCES "exchanges"("id") ON DELETE SET NULL ON UPDATE CASCADE;
