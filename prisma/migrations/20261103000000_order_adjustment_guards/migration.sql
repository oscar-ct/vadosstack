-- Make cancellation quantities mutually exclusive with legacy return resolutions,
-- and verify that immutable adjustment headers reconcile to their line evidence.

CREATE OR REPLACE FUNCTION commerce_analytics_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_order text; fulfilled integer; prior bigint; legacy bigint; linked integer;
BEGIN
 IF TG_TABLE_NAME='order_return_receipt_items' THEN
  SELECT "orderId" INTO parent_order FROM order_return_receipts WHERE id=NEW."receiptId" AND "ownerId"=NEW."ownerId";
  PERFORM id FROM orders WHERE id=parent_order FOR UPDATE;
  SELECT "shippedQuantity" INTO fulfilled FROM order_items WHERE id=NEW."orderItemId" AND "orderId"=parent_order AND "ownerId"=NEW."ownerId";
  IF fulfilled IS NULL THEN RAISE EXCEPTION 'Return receipt line belongs to another order'; END IF;
  SELECT COALESCE(SUM("receivedQuantity"),0) INTO prior FROM order_return_receipt_items WHERE "orderItemId"=NEW."orderItemId";
  SELECT COALESCE(SUM(i."returnQuantity"),0) INTO legacy FROM order_return_items i JOIN order_returns r ON r.id=i."orderReturnId" WHERE i."orderItemId"=NEW."orderItemId" AND i.disposition='Returned' AND NOT EXISTS(SELECT 1 FROM order_return_receipts p WHERE p."orderReturnId"=r.id);
  IF prior+legacy+NEW."receivedQuantity">fulfilled THEN RAISE EXCEPTION 'Physical returns exceed fulfilled units'; END IF;
  IF NEW."restockedQuantity">0 AND NOT EXISTS(SELECT 1 FROM inventory_stock_movements WHERE id=NEW."stockMovementId" AND "ownerId"=NEW."ownerId" AND "inventoryItemId"=NEW."inventoryItemId" AND "orderItemId"=NEW."orderItemId" AND "quantityChange"=NEW."restockedQuantity" AND reason='Return') THEN RAISE EXCEPTION 'Restock receipt does not match stock movement'; END IF;
 ELSIF TG_TABLE_NAME='order_adjustment_items' THEN
  SELECT "orderId" INTO parent_order FROM order_adjustments WHERE id=NEW."adjustmentId" AND "ownerId"=NEW."ownerId";
  PERFORM id FROM orders WHERE id=parent_order FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM order_items WHERE id=NEW."orderItemId" AND "orderId"=parent_order AND "ownerId"=NEW."ownerId") THEN RAISE EXCEPTION 'Adjustment line belongs to another order'; END IF;
  IF (SELECT kind FROM order_adjustments WHERE id=NEW."adjustmentId")='Cancellation' THEN
   SELECT COALESCE(SUM(i.quantity),0) INTO prior FROM order_adjustment_items i JOIN order_adjustments a ON a.id=i."adjustmentId" WHERE i."orderItemId"=NEW."orderItemId" AND a.kind='Cancellation';
   SELECT COALESCE(SUM(i."returnQuantity"),0) INTO legacy FROM order_return_items i JOIN order_returns r ON r.id=i."orderReturnId" WHERE i."orderItemId"=NEW."orderItemId";
   SELECT "shippedQuantity" INTO fulfilled FROM order_items WHERE id=NEW."orderItemId";
   IF prior+NEW.quantity>(SELECT quantity-GREATEST(fulfilled,legacy) FROM order_items WHERE id=NEW."orderItemId") THEN RAISE EXCEPTION 'Cancellation exceeds unresolved units'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='order_return_items' THEN
  SELECT "orderId" INTO parent_order FROM order_returns WHERE id=NEW."orderReturnId" AND "ownerId"=NEW."ownerId";
  PERFORM id FROM orders WHERE id=parent_order FOR UPDATE;
  SELECT "shippedQuantity" INTO fulfilled FROM order_items WHERE id=NEW."orderItemId" AND "orderId"=parent_order AND "ownerId"=NEW."ownerId";
  IF fulfilled IS NULL THEN RAISE EXCEPTION 'Return line belongs to another order'; END IF;
  SELECT COALESCE(SUM(i."returnQuantity"),0) INTO prior FROM order_return_items i WHERE i."orderItemId"=NEW."orderItemId";
  IF prior+NEW."returnQuantity">fulfilled THEN RAISE EXCEPTION 'Return exceeds fulfilled units'; END IF;
 ELSIF TG_TABLE_NAME='order_return_receipts' THEN
  IF NEW."orderReturnId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM order_returns WHERE id=NEW."orderReturnId" AND "orderId"=NEW."orderId" AND "ownerId"=NEW."ownerId") THEN RAISE EXCEPTION 'Return receipt belongs to another order'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION order_adjustment_totals_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE line_count integer; gross numeric; discount numeric; tax numeric;
BEGIN
 IF NEW.kind <> 'Cancellation' THEN RETURN NEW; END IF;
 SELECT COUNT(*), COALESCE(SUM("grossAmount"),0), COALESCE(SUM("discountAmount"),0), COALESCE(SUM("taxAmount"),0)
 INTO line_count,gross,discount,tax FROM order_adjustment_items WHERE "adjustmentId"=NEW.id AND "ownerId"=NEW."ownerId";
 IF line_count=0 OR gross<>NEW."merchandiseAmount" OR discount<>NEW."discountAmount" OR tax<>NEW."taxAmount" THEN
  RAISE EXCEPTION 'Cancellation adjustment totals do not reconcile to item allocations';
 END IF;
 RETURN NEW;
END $$;

CREATE CONSTRAINT TRIGGER order_adjustment_totals_guard
AFTER INSERT ON order_adjustments DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION order_adjustment_totals_guard();

CREATE TRIGGER return_line_order_guard BEFORE INSERT ON order_return_items
FOR EACH ROW EXECUTE FUNCTION commerce_analytics_event_guard();
