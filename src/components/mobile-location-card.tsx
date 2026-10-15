"use client";

import * as React from "react";

import Image from "next/image";

import { Check, Copy, Expand, MapPin, Navigation } from "lucide-react";

import { LocationMapDialog } from "@/components/location-map-card";
import { Button } from "@/components/ui/button";
import { createGoogleMapsDirectionsUrl, normalizeMapAddress } from "@/lib/google-maps";

function copyTextFallback(value: string) {
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();

  const copied = document.execCommand("copy");
  textArea.remove();
  return copied;
}

export function MobileLocationCard({
  address,
  modalLabel = "Service location",
}: {
  address?: string | null;
  modalLabel?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const normalizedAddress = normalizeMapAddress(address ?? "");
  const directionsUrl = createGoogleMapsDirectionsUrl(normalizedAddress);

  React.useEffect(() => {
    if (!copied) return;

    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copyAddress() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(normalizedAddress);
        setCopied(true);
        return;
      }
    } catch {
      // Some embedded browsers deny Clipboard API access even on localhost.
    }

    setCopied(copyTextFallback(normalizedAddress));
  }

  if (!normalizedAddress || !directionsUrl) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-muted-foreground text-xs">
        <MapPin className="size-4" />
        No address on file
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/25 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="whitespace-nowrap text-muted-foreground text-xs">Service location</div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={copyAddress}
            aria-label={copied ? "Address copied" : "Copy service address"}
            title={copied ? "Copied" : "Copy address"}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={directionsUrl} aria-label={`Get directions to ${normalizedAddress}`}>
              <Navigation />
              Directions
            </a>
          </Button>
        </div>
      </div>
      <LocationMapDialog address={normalizedAddress} label={modalLabel}>
        <button
          type="button"
          className="group mt-1.5 flex w-full min-w-0 items-center gap-2.5 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={`View ${normalizedAddress} on a map`}
        >
          <Image
            src="/google-maps-ios.png"
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-lg shadow-xs ring-1 ring-foreground/10"
          />
          <span className="line-clamp-2 min-w-0 flex-1 break-words font-medium text-sm leading-5 group-hover:underline">
            {normalizedAddress}
          </span>
          <Expand className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </LocationMapDialog>
    </div>
  );
}
