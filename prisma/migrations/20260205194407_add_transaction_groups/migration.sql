-- CreateEnum
CREATE TYPE "TransactionGroupStatus" AS ENUM ('NEW', 'REGISTERED');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "group_id" INTEGER;

-- CreateTable
CREATE TABLE "transaction_groups" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TransactionGroupStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_groups_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "transaction_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
