UPDATE "orders"
SET "paymentStatus" = 'Paid'
WHERE "paymentStatus" = 'Refunded'
  AND EXISTS (
    SELECT 1
    FROM "order_returns"
    WHERE "order_returns"."orderId" = "orders"."id"
  );

UPDATE "orders"
SET "fulfillmentStatus" = 'Fulfilled'
WHERE "fulfillmentStatus" = 'Returned';
