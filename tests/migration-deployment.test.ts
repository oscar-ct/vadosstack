import { describe, expect, it, vi } from "vitest";

import { deployMigrations, migrationEnvironment } from "../src/scripts/deploy-migrations.mjs";

describe("migration deployment connection", () => {
  it("uses Neon's direct endpoint only for the migration child process", () => {
    const original = {
      NODE_ENV: "test" as const,
      DATABASE_URL: "postgresql://user:secret@ep-example-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require",
      VERCEL_ENV: "production",
    };
    const run = vi.fn().mockReturnValue({ status: 0 });
    expect(deployMigrations(original, run)).toBe(0);
    const environment = run.mock.calls[0][2].env;
    expect(new URL(environment.DATABASE_URL).hostname).toBe("ep-example.c-8.us-east-1.aws.neon.tech");
    expect(new URL(environment.DATABASE_URL).searchParams.get("sslmode")).toBe("require");
    expect(new URL(environment.DATABASE_URL).password).toBe("secret");
    expect(environment.VERCEL_ENV).toBe("production");
    expect(original.DATABASE_URL).toContain("ep-example-pooler.");
    expect(run.mock.calls[0][1]).toEqual(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  });

  it("preserves direct and non-Neon endpoints", () => {
    for (const DATABASE_URL of [
      "postgresql://user:secret@ep-example.us-east-1.aws.neon.tech/neondb",
      "postgresql://user:secret@localhost:5432/app",
      "postgresql://user:secret@example-pooler.other-provider.com/app",
    ]) {
      expect(migrationEnvironment({ DATABASE_URL }).DATABASE_URL).toBe(DATABASE_URL);
    }
  });

  it("stops the build when migration deployment fails", () => {
    const run = vi.fn().mockReturnValue({ status: 1 });
    expect(deployMigrations({ DATABASE_URL: "postgresql://localhost/app", NODE_ENV: "test" }, run)).toBe(1);
  });

  it("rejects invalid configuration without exposing credentials", () => {
    expect(() => migrationEnvironment({})).toThrow("DATABASE_URL is required");
    expect(() => migrationEnvironment({ DATABASE_URL: "not-a-url-with-secret" })).toThrow(
      "DATABASE_URL must be a valid PostgreSQL connection URL.",
    );
    expect(() => migrationEnvironment({ DATABASE_URL: "https://user:secret@example.com/db" })).toThrow(
      "Migration deployment requires a PostgreSQL connection URL.",
    );
  });
});
