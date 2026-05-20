import Link from "next/link";

import { LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export function AuthRequiredState({ title, description }: { title: string; description: string }) {
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
        <Button asChild>
          <Link prefetch={false} href="/login">
            Sign in
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
