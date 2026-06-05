import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ErrorPreviewPage() {
  if (process.env.VERCEL_ENV === "production") {
    notFound();
  }

  throw new Error("Previewing the root error boundary.");
}
