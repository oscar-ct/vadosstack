ALTER TABLE "users"
ADD COLUMN "authProviders" TEXT[] NOT NULL DEFAULT ARRAY['email']::TEXT[];
