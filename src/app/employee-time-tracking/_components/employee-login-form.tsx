"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhoneNumber, normalizePhoneNumber } from "@/lib/phone";

import { type EmployeePortalState, employeeLoginAction } from "../actions";

const initialState: EmployeePortalState = {
  success: false,
  message: "",
};

export function EmployeeLoginForm() {
  const [phoneDigits, setPhoneDigits] = React.useState("");
  const [employeeNumber, setEmployeeNumber] = React.useState("");
  const [state, formAction, isPending] = React.useActionState(employeeLoginAction, initialState);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="phone" value={phoneDigits} />
      <div className="grid gap-2">
        <Label htmlFor="employee-phone">Phone number</Label>
        <Input
          id="employee-phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={formatPhoneNumber(phoneDigits)}
          onChange={(event) => setPhoneDigits(normalizePhoneNumber(event.target.value).slice(0, 10))}
          placeholder="(555) 555-1234"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="employee-number">Employee ID</Label>
        <Input
          id="employee-number"
          name="employeeNumber"
          value={employeeNumber}
          onChange={(event) => setEmployeeNumber(event.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          maxLength={4}
          minLength={4}
          pattern="\d{4}"
          placeholder="1234"
          required
        />
      </div>
      {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Checking..." : "View My Time"}
      </Button>
    </form>
  );
}
