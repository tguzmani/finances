-- /done closings with a balance snapshot per account, and the nightly check-ins.

-- CreateEnum
CREATE TYPE "ClosingOutcome" AS ENUM ('ALL_GOOD', 'SOME_ISSUES', 'BAD');

-- CreateEnum
CREATE TYPE "CheckInTrigger" AS ENUM ('SCHEDULED', 'MANUAL');

-- CreateEnum
CREATE TYPE "CheckInInitiative" AS ENUM ('OWN', 'REMINDER');

-- CreateEnum
CREATE TYPE "CheckInMissReason" AS ENUM ('FORGOT', 'COMPLEX_TRANSACTION', 'OTHER');

-- CreateTable
CREATE TABLE "closings" (
    "id" SERIAL NOT NULL,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" "ClosingOutcome",
    "note" TEXT,
    "exchange_rate" DECIMAL(10,2),
    "answered_at" TIMESTAMP(3),

    CONSTRAINT "closings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closing_balances" (
    "id" SERIAL NOT NULL,
    "closing_id" INTEGER NOT NULL,
    "account" VARCHAR(32) NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "sheet_balance" DECIMAL(14,2) NOT NULL,
    "estimated_balance" DECIMAL(14,2) NOT NULL,
    "actual_balance" DECIMAL(14,2),
    "pending_tx_count" INTEGER NOT NULL DEFAULT 0,
    "pending_exchange_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "closing_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "id" SERIAL NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trigger" "CheckInTrigger" NOT NULL,
    "banesco_tracked_ves" DECIMAL(14,2),
    "up_to_date" BOOLEAN,
    "initiative" "CheckInInitiative",
    "miss_reason" "CheckInMissReason",
    "note" TEXT,
    "closing_id" INTEGER,
    "answered_at" TIMESTAMP(3),

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "closings_closed_at_idx" ON "closings"("closed_at");

-- CreateIndex
CREATE INDEX "closing_balances_closing_id_idx" ON "closing_balances"("closing_id");

-- CreateIndex
CREATE INDEX "check_ins_sent_at_idx" ON "check_ins"("sent_at");

-- AddForeignKey
ALTER TABLE "closing_balances" ADD CONSTRAINT "closing_balances_closing_id_fkey" FOREIGN KEY ("closing_id") REFERENCES "closings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_closing_id_fkey" FOREIGN KEY ("closing_id") REFERENCES "closings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

