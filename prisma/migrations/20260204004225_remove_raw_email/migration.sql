/*
  Warnings:

  - You are about to drop the column `raw_email` on the `transactions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "raw_email";
