import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPaymentLinkToken,
  decryptPaymentLinkToken,
  encryptPaymentLinkToken,
  hashPaymentLinkToken,
} from "@/lib/payments/payment-link-token";

describe("payment link tokens", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("creates high-entropy URL-safe tokens and stores only a stable hash", () => {
    const first = createPaymentLinkToken();
    const second = createPaymentLinkToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
    expect(hashPaymentLinkToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashPaymentLinkToken(first)).toBe(hashPaymentLinkToken(first));
    expect(hashPaymentLinkToken(first)).not.toContain(first);
  });

  it("encrypts tokens for authorized recovery without storing plaintext", () => {
    vi.stubEnv("PAYMENT_LINK_ENCRYPTION_KEY", "test-only-payment-link-encryption-key");
    const token = createPaymentLinkToken();
    const ciphertext = encryptPaymentLinkToken(token);

    expect(ciphertext).toMatch(/^v1\./);
    expect(ciphertext).not.toContain(token);
    expect(decryptPaymentLinkToken(ciphertext)).toBe(token);
  });

  it("requires a dedicated encryption key in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PAYMENT_LINK_ENCRYPTION_KEY", "");
    vi.stubEnv("AUTH_SECRET", "fallback-auth-secret");
    vi.stubEnv("STRIPE_SECRET_KEY", "fallback-stripe-secret");

    expect(() => encryptPaymentLinkToken(createPaymentLinkToken())).toThrow(
      "PAYMENT_LINK_ENCRYPTION_KEY must be configured explicitly in production.",
    );
  });
});
