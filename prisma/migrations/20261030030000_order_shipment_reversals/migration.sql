CREATE TABLE "order_shipment_reversals" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT NOT NULL,
    "reversedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_shipment_reversals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_shipment_reversals_shipmentId_key"
ON "order_shipment_reversals"("shipmentId");

CREATE UNIQUE INDEX "order_shipment_reversals_idempotencyKey_key"
ON "order_shipment_reversals"("idempotencyKey");

CREATE INDEX "order_shipment_reversals_reversedAt_idx"
ON "order_shipment_reversals"("reversedAt");

ALTER TABLE "order_shipment_reversals"
ADD CONSTRAINT "order_shipment_reversals_shipmentId_fkey"
FOREIGN KEY ("shipmentId") REFERENCES "order_shipments"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER order_shipment_reversal_immutable
BEFORE UPDATE OR DELETE ON order_shipment_reversals
FOR EACH ROW EXECUTE FUNCTION commerce_immutable_ledger();
