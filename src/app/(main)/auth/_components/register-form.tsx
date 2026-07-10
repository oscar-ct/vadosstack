"use client";

import * as React from "react";

import Link from "next/link";

import { BriefcaseBusiness, Check, Eye, EyeOff, MailCheck, PanelsTopLeft, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getWorkspaceModeLabel, type WorkspaceMode } from "@/lib/workspace-mode";

import type { AuthFormState } from "../actions";

const initialState: AuthFormState = {
  success: false,
  message: "",
};

const workspaceModeOptions: Array<{
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  summary: string;
  value: WorkspaceMode;
}> = [
  {
    value: "both",
    icon: PanelsTopLeft,
    summary: "Use service business and e-commerce tools",
    description: "",
  },
  {
    value: "service",
    icon: BriefcaseBusiness,
    summary: "Jobs and service work",
    description: "Leads, estimates, jobs, invoices, calendar, and team workflows.",
  },
  {
    value: "commerce",
    icon: ShoppingCart,
    summary: "Orders and inventory",
    description: "Commerce reports, orders, inventory, receipts, and refunds.",
  },
];

export function RegisterForm({
  action,
  onConfirmationSent,
}: {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  onConfirmationSent?: (email: string) => void;
}) {
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const [name, setName] = React.useState("");
  const [companyName, setCompanyName] = React.useState("");
  const [companyAddress, setCompanyAddress] = React.useState("");
  const [workspaceMode, setWorkspaceMode] = React.useState<WorkspaceMode>("both");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [submittedEmail, setSubmittedEmail] = React.useState("");
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const confirmationSent = state.success;
  const pendingEmailRef = React.useRef("");

  function handleSubmit() {
    pendingEmailRef.current = email.trim();
  }

  React.useEffect(() => {
    if (!state.success) return;

    const confirmedEmail = pendingEmailRef.current || email.trim();

    setSubmittedEmail(confirmedEmail);
    onConfirmationSent?.(confirmedEmail);
    setName("");
    setCompanyName("");
    setCompanyAddress("");
    setWorkspaceMode("both");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  }, [email, onConfirmationSent, state.success]);

  if (confirmationSent) {
    return (
      <div className="grid gap-6 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
          <MailCheck className="size-8" />
        </div>
        <div className="space-y-2">
          <h2 className="font-semibold text-2xl tracking-tight">Check your email</h2>
          <p className="text-muted-foreground text-sm">
            We just sent a verification link to{" "}
            <span className="font-medium text-foreground">{submittedEmail || "your email address"}</span>.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link prefetch={false} href="/login">
            Go to login
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <FieldGroup className="gap-4">
        <Field className="gap-1.5">
          <FieldLabel htmlFor="register-name">Name</FieldLabel>
          <Input
            id="register-name"
            name="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Issac Newton"
            autoComplete="name"
            disabled={isPending || confirmationSent}
          />
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="register-company-name">Company Name</FieldLabel>
          <Input
            id="register-company-name"
            name="companyName"
            type="text"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Vados Field Services"
            autoComplete="organization"
            disabled={isPending || confirmationSent}
            required
          />
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="register-company-address">Company Address (optional)</FieldLabel>
          <Input
            id="register-company-address"
            name="companyAddress"
            type="text"
            value={companyAddress}
            onChange={(event) => setCompanyAddress(event.target.value)}
            placeholder="123 Main St, Houston, TX 77005"
            autoComplete="street-address"
            disabled={isPending || confirmationSent}
          />
        </Field>
        <Field className="gap-1.5">
          <FieldLabel id="register-workspace-mode-label" htmlFor="register-workspace-mode-both">
            What will you use VadosStack for?
          </FieldLabel>
          <div className="grid gap-2" role="radiogroup" aria-labelledby="register-workspace-mode-label">
            {workspaceModeOptions.map((option) => {
              const Icon = option.icon;
              const selected = workspaceMode === option.value;

              return (
                <label
                  key={option.value}
                  htmlFor={`register-workspace-mode-${option.value}`}
                  className={cn(
                    "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] gap-3 rounded-lg border bg-background p-3 text-left transition-colors has-disabled:cursor-not-allowed has-focus-visible:border-ring has-disabled:opacity-60 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
                    selected ? "border-primary bg-primary/5" : "border-input hover:bg-muted/50",
                  )}
                >
                  <input
                    id={`register-workspace-mode-${option.value}`}
                    type="radio"
                    name="workspaceMode"
                    value={option.value}
                    checked={selected}
                    disabled={isPending || confirmationSent}
                    onChange={() => setWorkspaceMode(option.value)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "mt-0.5 grid size-8 place-items-center rounded-md border",
                      selected
                        ? "border-primary/20 bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-sm">{getWorkspaceModeLabel(option.value)}</span>
                    <span className="mt-0.5 block text-muted-foreground text-xs">{option.summary}</span>
                    <span className="mt-1 block text-muted-foreground text-xs leading-relaxed">
                      {option.description}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "mt-1 grid size-5 place-items-center rounded-full border",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-input text-transparent",
                    )}
                  >
                    <Check className="size-3" />
                  </span>
                </label>
              );
            })}
          </div>
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="register-email">Email Address</FieldLabel>
          <Input
            id="register-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={isPending || confirmationSent}
            required
          />
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="register-password">Password</FieldLabel>
          <div className="relative">
            <Input
              id="register-password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className="pr-9"
              disabled={isPending || confirmationSent}
              required
            />
            <button
              type="button"
              className="absolute top-1/2 right-2 inline-flex -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="register-confirm-password">Confirm Password</FieldLabel>
          <div className="relative">
            <Input
              id="register-confirm-password"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className="pr-9"
              disabled={isPending || confirmationSent}
              required
            />
            <button
              type="button"
              className="absolute top-1/2 right-2 inline-flex -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              onClick={() => setShowConfirmPassword((value) => !value)}
            >
              {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
      </FieldGroup>
      {state.message ? (
        state.success ? (
          <p className="text-muted-foreground text-sm">{state.message}</p>
        ) : (
          <FieldError errors={[{ message: state.message }]} />
        )
      ) : null}
      <Button className="w-full" type="submit" disabled={isPending || confirmationSent}>
        {isPending ? "Sending confirmation..." : confirmationSent ? "Confirmation email sent" : "Submit"}
      </Button>
    </form>
  );
}
