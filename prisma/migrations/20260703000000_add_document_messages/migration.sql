ALTER TABLE "users"
ADD COLUMN "estimateMessageEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "estimateMessageText" TEXT NOT NULL DEFAULT E'Payment Schedule\n\n1st payment due before work begins: {{estimateHalfTotal}}\n2nd payment due when the job is completed: {{estimateHalfTotal}}\n\nAny additional work or materials not included in this estimate will be reviewed with the customer and billed as an extra charge.\n\nPlease make all checks payable to: {{companyName}}\nThank you for your business!',
ADD COLUMN "invoiceMessageEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "invoiceMessageText" TEXT NOT NULL DEFAULT E'Please make all checks payable to: {{companyName}}\n\nBalance due: {{balanceDue}}\nDue date: {{dueDate}}\n\nThank you for your business!';
