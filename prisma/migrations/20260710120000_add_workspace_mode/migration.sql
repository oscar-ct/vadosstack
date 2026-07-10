-- AlterTable
ALTER TABLE "users" ADD COLUMN "workspaceMode" TEXT NOT NULL DEFAULT 'both';

-- AlterTable
ALTER TABLE "pending_account_confirmations" ADD COLUMN "workspaceMode" TEXT NOT NULL DEFAULT 'both';
