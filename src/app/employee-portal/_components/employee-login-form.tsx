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
    <form action={formAction} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="employee-phone">Phone number</Label>
        <Input
          id="employee-phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          aria-invalid={Boolean(state.message && !state.success)}
          aria-describedby={state.message && !state.success ? "employee-login-error" : undefined}
          value={formatPhoneNumber(phoneDigits)}
          onChange={(event) => setPhoneDigits(normalizePhoneNumber(event.target.value).slice(0, 10))}
          placeholder="(555) 555-1234"
          className="h-12 rounded-xl bg-white"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="employee-number">Employee ID</Label>
        <Input
          id="employee-number"
          name="employeeNumber"
          type="password"
          value={employeeNumber}
          onChange={(event) => setEmployeeNumber(event.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          autoComplete="current-password"
          aria-invalid={Boolean(state.message && !state.success)}
          aria-describedby={state.message && !state.success ? "employee-login-error" : "employee-id-help"}
          maxLength={4}
          minLength={4}
          pattern="\d{4}"
          placeholder="1234"
          className="h-12 rounded-xl bg-white"
          required
        />
        <p id="employee-id-help" className="text-muted-foreground text-xs">
          Don&apos;t know your employee ID? Contact your manager.
        </p>
      </div>
      {state.message && !state.success ? (
        <p
          id="employee-login-error"
          role="alert"
          aria-live="polite"
          className="rounded-xl bg-destructive/8 p-3 text-destructive text-sm"
        >
          {state.message}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={isPending}
        className="h-12 rounded-full bg-gradient-to-r from-[#9365f4] to-[#6877ef] text-white shadow-sm hover:brightness-95"
      >
        {isPending ? "Checking..." : "View My Time"}
      </Button>
    </form>
  );
}
