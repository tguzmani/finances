-- CreateEnum
CREATE TYPE "BugReportStatus" AS ENUM ('OPEN', 'FIXED', 'WONT_FIX');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "is_estimate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source_note" TEXT;

-- CreateTable
CREATE TABLE "bug_reports" (
    "id" SERIAL NOT NULL,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT NOT NULL,
    "status" "BugReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolved_at" TIMESTAMP(3),
    "notified_at" TIMESTAMP(3),

    CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bug_reports_status_idx" ON "bug_reports"("status");
