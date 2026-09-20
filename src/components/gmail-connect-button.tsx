"use client";

import type { ComponentProps } from "react";

import { GmailIcon } from "@/components/gmail-icon";
import { PermissionDisabledButton } from "@/components/permission-disabled-button";
import { Button } from "@/components/ui/button";

type GmailConnectButtonProps = Omit<ComponentProps<typeof Button>, "asChild" | "children" | "disabled"> & {
  canManageAccount: boolean;
  href: string;
  label: string;
};

const disabledReason = "Your role can send email but cannot manage this workplace's Gmail connection.";

export function GmailConnectButton({
  canManageAccount,
  className,
  href,
  label,
  size,
  variant,
  ...props
}: GmailConnectButtonProps) {
  const content = (
    <>
      <GmailIcon className="size-4 shrink-0" />
      {label}
    </>
  );

  if (!canManageAccount) {
    return (
      <PermissionDisabledButton {...props} className={className} reason={disabledReason} size={size} variant={variant}>
        {content}
      </PermissionDisabledButton>
    );
  }

  return (
    <Button {...props} asChild className={className} size={size} variant={variant}>
      <a href={href}>{content}</a>
    </Button>
  );
}
