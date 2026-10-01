import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";

import { getStripeClient } from "./stripe";
import { getStripePaymentMethodReadiness } from "./stripe-payment-methods";

export function getStripeConnectionState(account: Stripe.Account) {
  const chargesEnabled = account.charges_enabled;
  const payoutsEnabled = account.payouts_enabled;
  const status = chargesEnabled && payoutsEnabled ? "active" : account.details_submitted ? "restricted" : "pending";
  return { chargesEnabled, payoutsEnabled, status };
}

export async function syncStripeProviderConnection(workspaceId: string) {
  const connection = await prisma.paymentProviderConnection.findUnique({
    where: { ownerId_provider: { ownerId: workspaceId, provider: "stripe" } },
  });
  if (!connection || connection.status === "disconnected") return { connection, paymentMethods: null };

  const account = await getStripeClient().accounts.retrieve(connection.externalAccountId);
  const state = getStripeConnectionState(account);
  const updatedConnection = await prisma.paymentProviderConnection.update({
    where: { id: connection.id },
    data: {
      ...state,
      accountType: account.type ?? "unknown",
      connectedAt: state.status === "active" ? (connection.connectedAt ?? new Date()) : connection.connectedAt,
      lastSyncedAt: new Date(),
    },
  });
  return { connection: updatedConnection, paymentMethods: getStripePaymentMethodReadiness(account) };
}
