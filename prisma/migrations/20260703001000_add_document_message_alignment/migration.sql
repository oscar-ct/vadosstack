ALTER TABLE "users"
ADD COLUMN "estimateMessageAlign" TEXT NOT NULL DEFAULT 'left',
ADD COLUMN "invoiceMessageAlign" TEXT NOT NULL DEFAULT 'left';
