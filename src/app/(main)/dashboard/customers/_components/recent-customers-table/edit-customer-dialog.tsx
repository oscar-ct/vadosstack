"use client";

import * as React from "react";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UsStateSelect } from "@/components/us-state-select";
import { formatPhoneNumber, normalizePhoneNumber } from "@/lib/phone";

import type { CustomerMutationState } from "../../actions";
import type { RecentCustomerRow } from "./schema";

const maxAddresses = 5;
const initialState: CustomerMutationState = {
  success: false,
  message: "",
};

function createAddressFields(count: number) {
  return Array.from({ length: count }, (_, offset) => ({
    id: `address-${offset + 1}`,
  }));
}

function getAddressFieldCount(customer: RecentCustomerRow) {
  return Math.max(2, Math.min(maxAddresses, customer.addresses?.length ?? (customer.address ? 1 : 0)));
}

type CustomerAddress = NonNullable<RecentCustomerRow["addresses"]>[number];

const customInputStyles = "bg-background/80";

function AddressFields({ address, idPrefix, index }: { address?: CustomerAddress; idPrefix: string; index: number }) {
  const label = index === 0 ? "Primary address" : index === 1 ? "Secondary address" : `Additional address ${index + 1}`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3 rounded-lg border border-emerald-200/80 bg-emerald-50/60 p-4 sm:grid-cols-2 dark:border-emerald-900/60 dark:bg-emerald-950/20">
      <div className="col-span-2 grid gap-1 sm:col-span-2">
        <Label>{address?.label ?? label}</Label>
        <p className="text-emerald-900/70 text-xs dark:text-emerald-200/70">
          Saved addresses appear as quick-select locations when creating jobs or estimates.
        </p>
      </div>
      <div className="col-span-2 grid gap-2 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-street-${index}`}>Street address</Label>
        <Input
          id={`${idPrefix}-street-${index}`}
          name="addressLine1"
          defaultValue={address?.line1 ?? ""}
          placeholder="123 Main St"
          className={customInputStyles}
        />
      </div>
      <div className="col-span-2 grid gap-2 sm:col-span-1">
        <Label htmlFor={`${idPrefix}-apt-${index}`}>Apt, suite, unit</Label>
        <Input
          id={`${idPrefix}-apt-${index}`}
          name="addressLine2"
          defaultValue={address?.line2 ?? ""}
          placeholder="Unit B"
          className={customInputStyles}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-city-${index}`}>City</Label>
        <Input
          id={`${idPrefix}-city-${index}`}
          name="addressCity"
          defaultValue={address?.city ?? ""}
          placeholder="Houston"
          className={customInputStyles}
        />
      </div>
      <div className="grid gap-2 sm:col-span-1">
        <Label htmlFor={`${idPrefix}-state-${index}`}>State</Label>
        <UsStateSelect
          id={`${idPrefix}-state-${index}`}
          name="addressState"
          defaultValue={address?.state ?? ""}
          className={customInputStyles}
        />
      </div>
      <div className="col-span-2 grid gap-2 sm:col-span-1">
        <Label htmlFor={`${idPrefix}-zip-${index}`}>Zip code</Label>
        <Input
          id={`${idPrefix}-zip-${index}`}
          name="addressPostalCode"
          defaultValue={address?.postalCode ?? ""}
          placeholder="77001"
          className={customInputStyles}
        />
      </div>
    </div>
  );
}

export function EditCustomerDialog({
  action,
  customer,
  onDeleteCustomer,
  open,
  onOpenChange,
}: {
  action: (state: CustomerMutationState, formData: FormData) => Promise<CustomerMutationState>;
  customer: RecentCustomerRow | null;
  onDeleteCustomer: (customer: RecentCustomerRow) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const [addressFields, setAddressFields] = React.useState(() => createAddressFields(2));
  const [phoneDigits, setPhoneDigits] = React.useState("");
  const [visibleMessage, setVisibleMessage] = React.useState("");
  const addresses = customer?.addresses?.length ? customer.addresses : customer?.address ? [customer.address] : [];

  React.useEffect(() => {
    if (!customer) return;

    setAddressFields(createAddressFields(getAddressFieldCount(customer)));
    setPhoneDigits(normalizePhoneNumber(customer.phoneNumbers?.[0]?.value).slice(0, 10));
  }, [customer]);

  React.useEffect(() => {
    if (!state.success) return;

    onOpenChange(false);
  }, [onOpenChange, state.success]);

  React.useEffect(() => {
    if (!state.success) {
      setVisibleMessage(state.message);
    }
  }, [state]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setVisibleMessage("");
      }

      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit customer</DialogTitle>
          <DialogDescription>Update the customer details shown in the dashboard.</DialogDescription>
        </DialogHeader>

        {customer ? (
          <form action={formAction} className="grid gap-4">
            <input type="hidden" name="id" value={customer.id} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`customer-name-${customer.id}`}>Name</Label>
                <Input id={`customer-name-${customer.id}`} name="name" defaultValue={customer.name} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`customer-email-${customer.id}`}>Email</Label>
                <Input id={`customer-email-${customer.id}`} name="email" type="email" defaultValue={customer.email} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`customer-phone-${customer.id}`}>Phone</Label>
                <Input
                  id={`customer-phone-${customer.id}`}
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={formatPhoneNumber(phoneDigits)}
                  onChange={(event) => setPhoneDigits(normalizePhoneNumber(event.target.value).slice(0, 10))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Billing status</Label>
                <p className="rounded-lg border bg-muted/20 px-3 py-2 text-muted-foreground text-sm">
                  {customer.billing}. This is automatically calculated from the customer&apos;s jobs.
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor={`customer-address-${customer.id}-1`}>Addresses</Label>
                <span className="text-muted-foreground text-xs">
                  {addressFields.length} of {maxAddresses}
                </span>
              </div>
              <div className="grid gap-3">
                {addressFields.map((addressField, index) => (
                  <AddressFields
                    key={addressField.id}
                    address={addresses[index]}
                    idPrefix={`customer-address-${customer.id}`}
                    index={index}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={addressFields.length >= maxAddresses}
                onClick={() =>
                  setAddressFields((fields) =>
                    fields.length >= maxAddresses ? fields : [...fields, { id: `address-${fields.length + 1}` }],
                  )
                }
              >
                <Plus />
                Add address
              </Button>
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`customer-notes-${customer.id}`}>Notes</Label>
              <Textarea
                id={`customer-notes-${customer.id}`}
                name="notes"
                defaultValue={customer.notes ?? ""}
                placeholder="Add any customer notes..."
              />
            </div>

            {visibleMessage ? <p className="text-destructive text-sm">{visibleMessage}</p> : null}

            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={() => {
                  handleOpenChange(false);
                  onDeleteCustomer(customer);
                }}
              >
                <Trash2 />
                Delete
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
