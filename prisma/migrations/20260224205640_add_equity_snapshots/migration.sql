-- CreateEnum
CREATE TYPE "EquityName" AS ENUM ('EQUITY_SIMPLE', 'EQUITY_FULL_INVESTMENT', 'EQUITY_CRYPTO_INVESTMENT', 'EQUITY_FIAT_INVESTMENT');

-- CreateTable
CREATE TABLE "equity_snapshots" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" "EquityName" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "equity_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equity_snapshots_date_idx" ON "equity_snapshots"("date");

-- CreateIndex
CREATE INDEX "equity_snapshots_name_idx" ON "equity_snapshots"("name");
