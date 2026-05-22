-- CreateTable
CREATE TABLE "google_sheet_configs" (
    "id" SERIAL NOT NULL,
    "google_sheet_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_sheet_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "google_sheet_configs_start_date_end_date_idx" ON "google_sheet_configs"("start_date", "end_date");
