import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentAuthorization: vi.fn(),
  getCurrentPrincipal: vi.fn(),
  getPermittedAuthorization: vi.fn(),
  googleExchange: vi.fn(),
  googleMailUpsert: vi.fn(),
  googleUrl: vi.fn(),
  invoiceFindUnique: vi.fn(),
  renderInvoice: vi.fn(),
  workspaceFindUnique: vi.fn(),
}));

vi.mock("@/lib/authorization", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authorization")>()),
  getCurrentDashboardAuthorization: mocks.getCurrentAuthorization,
  getCurrentPrincipal: mocks.getCurrentPrincipal,
  getPermittedDashboardAuthorization: mocks.getPermittedAuthorization,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: { count: vi.fn(), findUnique: mocks.invoiceFindUnique },
    googleMailAccount: { upsert: mocks.googleMailUpsert },
    workspace: { findUnique: mocks.workspaceFindUnique },
  },
}));
vi.mock("@/lib/r2", () => ({ getR2Object: vi.fn(), getR2PublicUrl: vi.fn() }));
vi.mock("@/lib/company-logo", () => ({ getCompanyLogoSrc: vi.fn() }));
vi.mock("@/lib/google-auth", () => ({
  createGoogleAuthorizationUrl: mocks.googleUrl,
  createOAuthState: vi.fn(() => "oauth-state"),
  exchangeGoogleCodeForAccessToken: mocks.googleExchange,
  getGoogleOAuthConfig: vi.fn(() => ({ clientId: "client", clientSecret: "secret", redirectUri: "callback" })),
  getGoogleUserInfo: vi.fn(),
}));
vi.mock("@/lib/google-mail", () => ({
  encryptGoogleToken: vi.fn(),
  GMAIL_SEND_SCOPE: "gmail.send",
  GOOGLE_MAIL_OAUTH_STATE_COOKIE_NAME: "oauth-state",
  GOOGLE_MAIL_OAUTH_STATE_MAX_AGE_SECONDS: 600,
  GOOGLE_MAIL_RETURN_TO_COOKIE_NAME: "oauth-return",
}));
vi.mock("@/lib/authorization/audit", () => ({ recordAuthorizationAuditEvent: vi.fn() }));
vi.mock("@/app/(main)/w/[workspaceSlug]/dashboard/invoices/_lib/invoice-pdf", () => ({
  renderInvoicePdfBuffer: mocks.renderInvoice,
}));

import { GET as getCompanyLogo } from "@/app/(main)/w/[workspaceSlug]/dashboard/company-logo/route";
import { GET as getInvoicePdf } from "@/app/(main)/w/[workspaceSlug]/dashboard/invoices/[invoiceId]/pdf/route";
import { GET as finishGoogleMailOAuth } from "@/app/api/auth/google/mail/callback/route";
import { GET as beginGoogleMailOAuth } from "@/app/api/auth/google/mail/route";

describe("direct HTTP route authorization", () => {
  beforeEach(() => {
    mocks.getCurrentAuthorization.mockResolvedValue(null);
    mocks.getCurrentPrincipal.mockResolvedValue(null);
    mocks.getPermittedAuthorization.mockResolvedValue(null);
  });

  it("returns 403 before querying or rendering an invoice PDF", async () => {
    const response = await getInvoicePdf(new Request("http://localhost/invoice.pdf"), {
      params: Promise.resolve({ invoiceId: "invoice-a" }),
    });

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toBe("Forbidden");
    expect(mocks.getPermittedAuthorization).toHaveBeenCalledWith("invoices.view");
    expect(mocks.invoiceFindUnique).not.toHaveBeenCalled();
    expect(mocks.renderInvoice).not.toHaveBeenCalled();
  });

  it("uses the authorized workspace id when resolving a direct PDF id", async () => {
    mocks.getPermittedAuthorization.mockResolvedValue({ workspaceId: "workspace-a" });
    mocks.invoiceFindUnique.mockResolvedValue(null);

    const response = await getInvoicePdf(new Request("http://localhost/invoice.pdf"), {
      params: Promise.resolve({ invoiceId: "workspace-b-invoice" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.invoiceFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_ownerId: { id: "workspace-b-invoice", ownerId: "workspace-a" } },
      }),
    );
    expect(mocks.renderInvoice).not.toHaveBeenCalled();
  });

  it("does not expose a stored company logo without dashboard authorization", async () => {
    const response = await getCompanyLogo();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.workspaceFindUnique).not.toHaveBeenCalled();
  });

  it("does not start Gmail OAuth when the active workspace lacks connected-email permission", async () => {
    mocks.getCurrentPrincipal.mockResolvedValue({
      memberships: [
        {
          id: "membership-a",
          permissions: new Set(),
          workspaceId: "workspace-a",
          workspaceSlug: "business-a",
        },
      ],
      user: { id: "user-a" },
    });
    const request = new NextRequest("http://localhost/api/auth/google/mail?returnTo=/w/business-a/dashboard/invoices");

    const response = await beginGoogleMailOAuth(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("gmail_error=permission");
    expect(mocks.googleUrl).not.toHaveBeenCalled();
  });

  it("does not exchange an OAuth code or store credentials after permission is revoked", async () => {
    mocks.getCurrentPrincipal.mockResolvedValue({
      memberships: [
        {
          id: "membership-a",
          permissions: new Set(),
          workspaceId: "workspace-a",
          workspaceSlug: "business-a",
        },
      ],
      user: { id: "user-a" },
    });
    const request = new NextRequest("http://localhost/api/auth/google/mail/callback?code=secret-code&state=state", {
      headers: { cookie: "oauth-return=/w/business-a/dashboard/invoices; oauth-state=state" },
    });

    const response = await finishGoogleMailOAuth(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("gmail_error=permission");
    expect(mocks.googleExchange).not.toHaveBeenCalled();
    expect(mocks.googleMailUpsert).not.toHaveBeenCalled();
  });
});
