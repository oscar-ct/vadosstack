import Link from "next/link";

import { LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export function PermissionRequiredState({
  backHref,
  backLabel,
  description,
  title,
}: {
  backHref: string;
  backLabel: string;
  description: string;
  title: string;
}) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LockKeyhole />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link prefetch={false} href={backHref}>
            {backLabel}
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
