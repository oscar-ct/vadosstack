"use client";

import * as React from "react";

import { Check, Copy, Expand, ExternalLink, MapPin, Navigation } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createGoogleMapsDirectionsUrl,
  createGoogleMapsEmbedUrl,
  createGoogleMapsSearchUrl,
  normalizeMapAddress,
} from "@/lib/google-maps";
import { cn } from "@/lib/utils";

type LocationMapCardProps = {
  address: string;
  className?: string;
  label?: string;
  mapAction?: "directions" | "open";
};

type LocationMapDialogProps = {
  address: string;
  children: React.ReactNode;
  label?: string;
};

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

export function LocationMapCard({ address, className, label = "Location", mapAction = "open" }: LocationMapCardProps) {
  const [copied, setCopied] = React.useState(false);
  const normalizedAddress = normalizeMapAddress(address);
  const mapUrl = createGoogleMapsEmbedUrl(normalizedAddress, process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY);
  const actionUrl =
    mapAction === "directions"
      ? createGoogleMapsDirectionsUrl(normalizedAddress)
      : createGoogleMapsSearchUrl(normalizedAddress);

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

  if (!normalizedAddress) {
    return null;
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-background", className)}>
      <div className="grid gap-3 p-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
            <MapPin className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-xs">{label}</div>
            <address className="mt-1 text-sm not-italic leading-relaxed">{normalizedAddress}</address>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={copyAddress}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy address"}
          </Button>
          {actionUrl ? (
            <Button asChild size="sm" variant="outline">
              <a href={actionUrl}>
                {mapAction === "directions" ? <Navigation /> : <ExternalLink />}
                {mapAction === "directions" ? "Directions" : "Open in Maps"}
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      {mapUrl ? (
        <div className="relative h-40 border-t bg-muted/30">
          <iframe
            title={`Map preview for ${label}`}
            src={mapUrl}
            className="pointer-events-none size-full border-0"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
          <LocationMapDialog address={normalizedAddress} label={label}>
            <button
              type="button"
              className="group absolute inset-0 cursor-zoom-in bg-transparent text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
              aria-label={`Open a larger map for ${normalizedAddress}`}
            >
              <span className="absolute right-2 bottom-2 inline-flex items-center gap-1.5 rounded-lg border bg-background/95 px-2.5 py-1.5 font-medium text-xs shadow-sm backdrop-blur-sm transition-colors group-hover:bg-muted">
                <Expand className="size-3.5" />
                Larger map
              </span>
            </button>
          </LocationMapDialog>
        </div>
      ) : (
        <div className="border-t bg-muted/20 px-3 py-4 text-muted-foreground text-xs">Map preview unavailable.</div>
      )}
    </div>
  );
}

export function LocationMapDialog({ address, children, label = "Location" }: LocationMapDialogProps) {
  const [copied, setCopied] = React.useState(false);
  const normalizedAddress = normalizeMapAddress(address);
  const mapUrl = createGoogleMapsEmbedUrl(normalizedAddress, process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY);
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

  if (!mapUrl) {
    return children;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="grid h-[min(48rem,calc(100svh-1rem))] w-[calc(100vw-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{normalizedAddress}</DialogDescription>
        </DialogHeader>
        <iframe
          title={`Interactive map for ${label}`}
          src={mapUrl}
          className="size-full min-h-0 border-0"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
        <div className="flex flex-wrap justify-end gap-2 border-t bg-muted/20 p-3">
          <Button type="button" size="sm" variant="outline" onClick={copyAddress}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy address"}
          </Button>
          {directionsUrl ? (
            <Button asChild size="sm">
              <a href={directionsUrl}>
                <Navigation />
                Directions
              </a>
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
