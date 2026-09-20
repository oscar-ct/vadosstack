import { describe, expect, it } from "vitest";

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const dashboardRoot = join(process.cwd(), "src/app/(main)/w/[workspaceSlug]/dashboard");

function filesBelow(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesBelow(path) : [path];
  });
}

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("dashboard authorization surface", () => {
  it("requires every dashboard server-action module to resolve workspace authorization", () => {
    const serverActionFiles = filesBelow(dashboardRoot).filter(
      (path) => path.endsWith(".ts") && source(path).includes('"use server"'),
    );

    expect(serverActionFiles.length).toBeGreaterThanOrEqual(17);

    for (const path of serverActionFiles) {
      expect(
        source(path),
        `${relative(process.cwd(), path)} must enforce authorization before performing actions`,
      ).toMatch(/getPermittedDashboardAuthorization|authorizeCurrentDashboard|getCurrentDashboardAuthorization/);
    }
  });

  it("requires every dashboard route handler, including PDFs and logos, to resolve workspace authorization", () => {
    const routeHandlers = filesBelow(dashboardRoot).filter(
      (path) => path.endsWith("/route.ts") && /export async function (GET|POST|PUT|PATCH|DELETE)/.test(source(path)),
    );

    expect(routeHandlers.length).toBeGreaterThanOrEqual(5);

    for (const path of routeHandlers) {
      expect(source(path), `${relative(process.cwd(), path)} must authorize direct HTTP requests`).toMatch(
        /getPermittedDashboardAuthorization|authorizeCurrentDashboard|getCurrentDashboardAuthorization/,
      );
    }
  });

  it("keeps high-risk operations behind their exact permissions", () => {
    const expectations = [
      ["jobs/actions.ts", "jobs.delete"],
      ["jobs/actions.ts", "jobs.complete"],
      ["jobs/actions.ts", "invoices.record_payment"],
      ["invoices/actions.ts", "invoices.send"],
      ["estimates/actions.ts", "estimates.send"],
      ["estimates/records-actions.ts", "estimates.convert"],
      ["employees/actions.ts", "employees.compensation.manage"],
      ["time-tracking/actions.ts", "time.approve"],
      ["time-tracking/actions.ts", "time.lock"],
      ["_components/sidebar/actions.ts", "settings.branding.manage"],
      ["roles/actions.ts", "roles.manage"],
    ] as const;

    for (const [relativePath, permission] of expectations) {
      expect(source(join(dashboardRoot, relativePath)), `${relativePath} must enforce ${permission}`).toContain(
        `"${permission}"`,
      );
    }
  });

  it("protects both Gmail OAuth entry and callback routes with connected-email permission", () => {
    for (const relativePath of [
      "src/app/api/auth/google/mail/route.ts",
      "src/app/api/auth/google/mail/callback/route.ts",
    ]) {
      const contents = source(join(process.cwd(), relativePath));
      expect(contents, relativePath).toContain('"email.account.manage"');
      expect(contents, relativePath).toMatch(/membership|workspace/);
    }
  });

  it.each([
    ["estimates/[estimateId]/pdf/route.ts", "estimates.view"],
    ["invoices/[invoiceId]/pdf/route.ts", "invoices.view"],
    ["orders/[orderId]/pdf/route.ts", "orders.view"],
    ["orders/[orderId]/return/pdf/route.ts", "orders.view"],
  ] as const)("protects direct PDF route %s with %s", (relativePath, permission) => {
    expect(source(join(dashboardRoot, relativePath))).toContain(`"${permission}"`);
  });

  it("gates every report export surface with reports.export", () => {
    for (const relativePath of ["jobs/page.tsx", "inventory/page.tsx", "time-tracking/page.tsx"]) {
      expect(source(join(dashboardRoot, relativePath)), relativePath).toContain('"reports.export"');
    }

    expect(source(join(dashboardRoot, "time-tracking/_components/time-tracking-dashboard.tsx"))).toContain(
      "disabled={!canExport || !entries.length}",
    );
  });

  it("does not use the signed-in user id as the tenant id inside dashboard modules", () => {
    const offenders = filesBelow(dashboardRoot)
      .filter((path) => /\.(ts|tsx)$/.test(path))
      .filter((path) => /ownerId:\s*(currentUser|user|principal\.user)\.id/.test(source(path)))
      .map((path) => relative(process.cwd(), path));

    expect(offenders).toEqual([]);
  });
});
