import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function migrationEnvironment(environment) {
  if (!environment.DATABASE_URL) throw new Error("DATABASE_URL is required to deploy migrations.");
  let url;
  try {
    url = new URL(environment.DATABASE_URL);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("Migration deployment requires a PostgreSQL connection URL.");
  }
  // Neon pooling cannot preserve Prisma's session-level advisory lock. Change
  // only the migration subprocess URL; the application keeps DATABASE_URL.
  if (url.hostname.endsWith(".neon.tech")) {
    url.hostname = url.hostname.replace(/-pooler(?=\.)/, "");
  }
  return { ...environment, DATABASE_URL: url.toString() };
}

export function deployMigrations(environment = process.env, run = spawnSync) {
  const result = run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    stdio: "inherit",
    env: migrationEnvironment(environment),
  });
  if (result.error) throw new Error("Unable to start Prisma migration deployment.");
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    // Match Prisma CLI's local .env support without overriding Vercel secrets.
    try {
      process.loadEnvFile(".env");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    process.exitCode = deployMigrations();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
