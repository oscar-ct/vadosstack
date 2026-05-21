-- Older setup scripts could leave a global unique email constraint/index on customers.
-- Customer emails should only be unique within a single owner account.
ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_email_key";
DROP INDEX IF EXISTS "customers_email_key";
