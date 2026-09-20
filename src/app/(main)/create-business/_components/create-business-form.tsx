"use client";

import * as React from "react";

import { BriefcaseBusiness, Check, PanelsTopLeft, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getWorkspaceModeLabel, type WorkspaceMode } from "@/lib/workspace-mode";

import type { CreateBusinessState } from "../actions";

const initialState: CreateBusinessState = { message: "", success: false };

const workspaceModeOptions: Array<{
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  value: WorkspaceMode;
}> = [
  {
    value: "both",
    icon: PanelsTopLeft,
    description: "Service work and e-commerce tools in one workplace.",
  },
  {
    value: "service",
    icon: BriefcaseBusiness,
    description: "Leads, estimates, jobs, invoices, calendar, and employees.",
  },
  {
    value: "commerce",
    icon: ShoppingCart,
    description: "Orders, inventory, receipts, refunds, and commerce reporting.",
  },
];

export function CreateBusinessForm({
  action,
}: {
  action: (state: CreateBusinessState, formData: FormData) => Promise<CreateBusinessState>;
}) {
  const [state, formAction, pending] = React.useActionState(action, initialState);
  const [workspaceMode, setWorkspaceMode] = React.useState<WorkspaceMode>("both");

  return (
    <form action={formAction} className="grid gap-6">
      <FieldGroup className="gap-5">
        <Field className="gap-1.5">
          <FieldLabel htmlFor="business-name">Business name</FieldLabel>
          <Input
            id="business-name"
            name="companyName"
            placeholder="Your business name"
            autoComplete="organization"
            disabled={pending}
            required
            autoFocus
          />
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="business-address">Business address (optional)</FieldLabel>
          <Input
            id="business-address"
            name="companyAddress"
            placeholder="123 Main St, Houston, TX 77005"
            autoComplete="street-address"
            disabled={pending}
          />
        </Field>
        <Field className="gap-2">
          <FieldLabel id="business-mode-label">What will you use VadosStack for?</FieldLabel>
          <div className="grid gap-2" role="radiogroup" aria-labelledby="business-mode-label">
            {workspaceModeOptions.map((option) => {
              const Icon = option.icon;
              const selected = workspaceMode === option.value;

              return (
                <label
                  key={option.value}
                  htmlFor={`business-mode-${option.value}`}
                  className={cn(
                    "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border bg-background p-3 transition-colors has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
                    selected ? "border-primary bg-primary/5" : "border-input hover:bg-muted/50",
                    pending && "cursor-not-allowed opacity-60",
                  )}
                >
                  <input
                    id={`business-mode-${option.value}`}
                    type="radio"
                    name="workspaceMode"
                    value={option.value}
                    checked={selected}
                    disabled={pending}
                    onChange={() => setWorkspaceMode(option.value)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-md border",
                      selected
                        ? "border-primary/20 bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-sm">{getWorkspaceModeLabel(option.value)}</span>
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
      </FieldGroup>

      {state.message ? <FieldError errors={[{ message: state.message }]} /> : null}

      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Creating business..." : "Create business"}
      </Button>
    </form>
  );
}
