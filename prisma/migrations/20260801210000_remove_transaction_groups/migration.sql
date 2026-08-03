-- Transaction grouping was removed from the app. Every grouped transaction was
-- already REGISTERED, so dropping the column leaves no pending work behind.

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_group_id_fkey";

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "group_id";

-- DropTable
DROP TABLE "transaction_groups";

-- DropEnum
DROP TYPE "TransactionGroupStatus";
