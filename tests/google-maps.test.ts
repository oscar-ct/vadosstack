import { describe, expect, it } from "vitest";

import {
  createGoogleMapsDirectionsUrl,
  createGoogleMapsEmbedUrl,
  createGoogleMapsSearchUrl,
  normalizeMapAddress,
} from "@/lib/google-maps";

describe("Google Maps URL helpers", () => {
  it("normalizes multiline addresses for map queries", () => {
    expect(normalizeMapAddress("123 Main St\nSuite 4\nAustin, TX 78701")).toBe(
      "123 Main St, Suite 4, Austin, TX 78701",
    );
  });

  it("builds an encoded embed URL when an API key is available", () => {
    expect(createGoogleMapsEmbedUrl("123 Main St\nAustin, TX", "maps-key")).toBe(
      "https://www.google.com/maps/embed/v1/place?key=maps-key&q=123+Main+St%2C+Austin%2C+TX&zoom=12",
    );
  });

  it("does not build an embed URL without an address and API key", () => {
    expect(createGoogleMapsEmbedUrl("", "maps-key")).toBeNull();
    expect(createGoogleMapsEmbedUrl("123 Main St", "")).toBeNull();
    expect(createGoogleMapsEmbedUrl("123 Main St")).toBeNull();
  });

  it("builds a universal Google Maps search URL", () => {
    expect(createGoogleMapsSearchUrl("123 Main St, Austin, TX")).toBe(
      "https://www.google.com/maps/search/?api=1&query=123+Main+St%2C+Austin%2C+TX",
    );
  });

  it("builds a universal Google Maps directions URL", () => {
    expect(createGoogleMapsDirectionsUrl("123 Main St, Austin, TX")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=123+Main+St%2C+Austin%2C+TX&travelmode=driving&dir_action=navigate",
    );
    expect(createGoogleMapsDirectionsUrl("  ")).toBeNull();
  });
});
