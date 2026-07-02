ALTER TABLE "tasks"
ADD COLUMN "leadId" TEXT;

CREATE INDEX "tasks_leadId_idx" ON "tasks"("leadId");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
