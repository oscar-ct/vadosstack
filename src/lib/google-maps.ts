export function normalizeMapAddress(address: string) {
  return address
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

export function createGoogleMapsEmbedUrl(address: string, apiKey?: string) {
  const normalizedAddress = normalizeMapAddress(address);
  const normalizedApiKey = apiKey?.trim();

  if (!normalizedAddress || !normalizedApiKey) {
    return null;
  }

  const params = new URLSearchParams({
    key: normalizedApiKey,
    q: normalizedAddress,
    zoom: "15",
  });

  return `https://www.google.com/maps/embed/v1/place?${params.toString()}`;
}

export function createGoogleMapsSearchUrl(address: string) {
  const normalizedAddress = normalizeMapAddress(address);

  if (!normalizedAddress) {
    return null;
  }

  const params = new URLSearchParams({
    api: "1",
    query: normalizedAddress,
  });

  return `https://www.google.com/maps/search/?${params.toString()}`;
}
