-- Retarget every business-data ownership boundary from an account to a workspace.
-- Existing workspace IDs intentionally match the legacy owner IDs, so no row rewrite
-- is necessary. The preflight checks fail before DDL if that invariant is not true.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
DECLARE
  table_name TEXT;
  orphan_count BIGINT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'customers',
    'document_number_assignments',
    'document_number_events',
    'document_sequences',
    'email_records',
    'email_templates',
    'employee_sessions',
    'employees',
    'estimate_records',
    'estimates',
    'inventory_categories',
    'inventory_items',
    'inventory_locations',
    'inventory_settings',
    'inventory_stock_movements',
    'invoices',
    'job_payments',
    'jobs',
    'leads',
    'order_items',
    'order_return_items',
    'order_returns',
    'orders',
    'service_templates',
    'tasks',
    'time_entries',
    'time_entry_audits',
    'time_entry_requests',
    'timesheet_locks'
  ]
  LOOP
    EXECUTE format(
      'SELECT COUNT(*) FROM %I record LEFT JOIN "workspaces" workspace ON workspace."id" = record."ownerId" WHERE workspace."id" IS NULL',
      table_name
    ) INTO orphan_count;

    IF orphan_count > 0 THEN
      RAISE EXCEPTION 'Ownership migration aborted: % contains % row(s) without a workspace', table_name, orphan_count;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO orphan_count
  FROM "google_mail_accounts" account
  LEFT JOIN "workspaces" workspace ON workspace."id" = account."userId"
  WHERE workspace."id" IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Ownership migration aborted: google_mail_accounts contains % row(s) without a workspace', orphan_count;
  END IF;
END $$;

ALTER TABLE "customers" DROP CONSTRAINT "customers_ownerId_fkey";
ALTER TABLE "customers" ADD CONSTRAINT "customers_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_number_assignments" DROP CONSTRAINT "document_number_assignments_ownerId_fkey";
ALTER TABLE "document_number_assignments" ADD CONSTRAINT "document_number_assignments_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_number_events" DROP CONSTRAINT "document_number_events_ownerId_fkey";
ALTER TABLE "document_number_events" ADD CONSTRAINT "document_number_events_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_sequences" DROP CONSTRAINT "document_sequences_ownerId_fkey";
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_records" DROP CONSTRAINT "email_records_ownerId_fkey";
ALTER TABLE "email_records" ADD CONSTRAINT "email_records_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_templates" DROP CONSTRAINT "email_templates_ownerId_fkey";
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_sessions" DROP CONSTRAINT "employee_sessions_ownerId_fkey";
ALTER TABLE "employee_sessions" ADD CONSTRAINT "employee_sessions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employees" DROP CONSTRAINT "employees_ownerId_fkey";
ALTER TABLE "employees" ADD CONSTRAINT "employees_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "estimate_records" DROP CONSTRAINT "estimate_records_ownerId_fkey";
ALTER TABLE "estimate_records" ADD CONSTRAINT "estimate_records_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "estimates" DROP CONSTRAINT "estimates_ownerId_fkey";
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_categories" DROP CONSTRAINT "inventory_categories_ownerId_fkey";
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_items" DROP CONSTRAINT "inventory_items_ownerId_fkey";
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_locations" DROP CONSTRAINT "inventory_locations_ownerId_fkey";
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_settings" DROP CONSTRAINT "inventory_settings_ownerId_fkey";
ALTER TABLE "inventory_settings" ADD CONSTRAINT "inventory_settings_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_stock_movements" DROP CONSTRAINT "inventory_stock_movements_ownerId_fkey";
ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoices" DROP CONSTRAINT "invoices_ownerId_fkey";
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_payments" DROP CONSTRAINT "job_payments_ownerId_fkey";
ALTER TABLE "job_payments" ADD CONSTRAINT "job_payments_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "jobs" DROP CONSTRAINT "jobs_ownerId_fkey";
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leads" DROP CONSTRAINT "leads_ownerId_fkey";
ALTER TABLE "leads" ADD CONSTRAINT "leads_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_items" DROP CONSTRAINT "order_items_ownerId_fkey";
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_return_items" DROP CONSTRAINT "order_return_items_ownerId_fkey";
ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_returns" DROP CONSTRAINT "order_returns_ownerId_fkey";
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "orders" DROP CONSTRAINT "orders_ownerId_fkey";
ALTER TABLE "orders" ADD CONSTRAINT "orders_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_templates" DROP CONSTRAINT "service_templates_ownerId_fkey";
ALTER TABLE "service_templates" ADD CONSTRAINT "service_templates_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks" DROP CONSTRAINT "tasks_ownerId_fkey";
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_ownerId_fkey";
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "time_entry_audits" DROP CONSTRAINT "time_entry_audits_ownerId_fkey";
ALTER TABLE "time_entry_audits" ADD CONSTRAINT "time_entry_audits_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "time_entry_requests" DROP CONSTRAINT "time_entry_requests_ownerId_fkey";
ALTER TABLE "time_entry_requests" ADD CONSTRAINT "time_entry_requests_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "timesheet_locks" DROP CONSTRAINT "timesheet_locks_ownerId_fkey";
ALTER TABLE "timesheet_locks" ADD CONSTRAINT "timesheet_locks_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "google_mail_accounts" DROP CONSTRAINT "google_mail_accounts_userId_fkey";
ALTER TABLE "google_mail_accounts" RENAME COLUMN "userId" TO "workspaceId";
ALTER INDEX "google_mail_accounts_userId_key" RENAME TO "google_mail_accounts_workspaceId_key";
ALTER TABLE "google_mail_accounts" ADD CONSTRAINT "google_mail_accounts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspaces" DROP CONSTRAINT "workspaces_legacyOwnerId_fkey";
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_legacyOwnerId_fkey" FOREIGN KEY ("legacyOwnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
