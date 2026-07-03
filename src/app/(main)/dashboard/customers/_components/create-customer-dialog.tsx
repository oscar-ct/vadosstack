"use client";

import * as React from "react";

import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UsStateSelect } from "@/components/us-state-select";
import { formatPhoneNumber, normalizePhoneNumber } from "@/lib/phone";

import type { CreateCustomerState } from "../actions";

const maxAddresses = 5;
const initialAddressFields = [{ id: "primary" }];
const initialState: CreateCustomerState = {
  success: false,
  message: "",
};

const customInputStyles = "bg-background/80";

function AddressFields({ idPrefix, index }: { idPrefix: string; index: number }) {
  const label = index === 0 ? "Primary address" : index === 1 ? "Secondary address" : `Additional address ${index + 1}`;

  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-emerald-200/80 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
      <div className="col-span-2 grid gap-1 sm:col-span-2">
        <Label>{label}</Label>
        <p className="text-emerald-900/70 text-xs dark:text-emerald-200/70">
          Saved addresses appear as quick-select locations when creating jobs or estimates.
        </p>
      </div>
      <div className="col-span-2 grid gap-2 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-street-${index}`}>Street address</Label>
        <Input
          id={`${idPrefix}-street-${index}`}
          name="addressLine1"
          placeholder="123 Main St"
          className={customInputStyles}
        />
      </div>
      <div className="col-span-2 grid gap-2 sm:col-span-1">
        <Label htmlFor={`${idPrefix}-apt-${index}`}>Apt, suite, unit</Label>
        <Input id={`${idPrefix}-apt-${index}`} name="addressLine2" placeholder="Unit B" className={customInputStyles} />
      </div>
      <div className="grid min-w-0 gap-2">
        <Label htmlFor={`${idPrefix}-city-${index}`}>City</Label>
        <Input
          id={`${idPrefix}-city-${index}`}
          name="addressCity"
          placeholder="Houston"
          className={customInputStyles}
        />
      </div>
      <div className="grid min-w-0 gap-2">
        <Label htmlFor={`${idPrefix}-state-${index}`}>State</Label>
        <UsStateSelect id={`${idPrefix}-state-${index}`} name="addressState" className={customInputStyles} />
      </div>
      <div className="col-span-2 grid gap-2 sm:col-span-1">
        <Label htmlFor={`${idPrefix}-zip-${index}`}>Zip code</Label>
        <Input
          id={`${idPrefix}-zip-${index}`}
          name="addressPostalCode"
          placeholder="77001"
          className={customInputStyles}
        />
      </div>
    </div>
  );
}

export function CreateCustomerDialog({
  action,
}: {
  action: (state: CreateCustomerState, formData: FormData) => Promise<CreateCustomerState>;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [open, setOpen] = React.useState(false);
  const [addressFields, setAddressFields] = React.useState(initialAddressFields);
  const [phoneDigits, setPhoneDigits] = React.useState("");
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const [visibleMessage, setVisibleMessage] = React.useState("");

  const resetForm = React.useCallback(() => {
    formRef.current?.reset();
    setAddressFields(initialAddressFields);
    setPhoneDigits("");
  }, []);

  React.useEffect(() => {
    if (!state.success) {
      setVisibleMessage(state.message);
      return;
    }

    resetForm();
    setVisibleMessage("");
    setOpen(false);
    toast.success(state.message || "Customer created.");
  }, [state, resetForm]);

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
        if (!open) {
          resetForm();
          setVisibleMessage("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          Create
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create customer</DialogTitle>
          <DialogDescription>Add the basic customer details.</DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="customer-name">Name</Label>
              <Input id="customer-name" name="name" placeholder="Jane Smith" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customer-email">Email</Label>
              <Input id="customer-email" name="email" type="email" placeholder="jane@example.com" required />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="customer-phone">Phone</Label>
              <Input
                id="customer-phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={14}
                value={formatPhoneNumber(phoneDigits)}
                onChange={(event) => setPhoneDigits(normalizePhoneNumber(event.target.value).slice(0, 10))}
                placeholder="555-555-1234"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Billing status</Label>
              <p className="rounded-lg border bg-muted/20 px-3 py-2 text-muted-foreground text-sm">
                Automatically tracked from the customer&apos;s jobs and payment status.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="customer-address-1">Addresses</Label>
              <span className="text-muted-foreground text-xs">
                {addressFields.length} of {maxAddresses}
              </span>
            </div>
            <div className="grid gap-3">
              {addressFields.map((addressField, index) => (
                <AddressFields key={addressField.id} idPrefix="customer-address" index={index} />
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
                  fields.length >= maxAddresses ? fields : [...fields, { id: `additional-${fields.length + 1}` }],
                )
              }
            >
              <Plus />
              Add address
            </Button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="customer-notes">Notes</Label>
            <Textarea id="customer-notes" name="notes" placeholder="Add any customer notes..." />
          </div>

          {visibleMessage ? <p className="text-destructive text-sm">{visibleMessage}</p> : null}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
