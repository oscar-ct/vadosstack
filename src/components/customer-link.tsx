import Link from "next/link";

import { cn } from "@/lib/utils";

export function CustomerLink({
  className,
  customerId,
  fallback = "No customer",
  name,
}: {
  className?: string;
  customerId?: null | string;
  fallback?: string;
  name?: null | string;
}) {
  const label = name?.trim() || fallback;

  if (!customerId) {
    return <span className={className}>{label}</span>;
  }

  return (
    <Link
      prefetch={false}
      href={`/dashboard/customers/${customerId}`}
      className={cn("underline-offset-4 hover:underline", className)}
    >
      {label}
    </Link>
  );
}
