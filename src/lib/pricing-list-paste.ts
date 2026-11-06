/** Only explicit lists qualify; ordinary multiline descriptions stay intact. */
export function parsePricingList(text: string): string[] | null {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 1) return null;
  const bullet = /^(?:[•‣◦▪●*-]|\+)\s+(.+)$/u;
  if (lines.length > 1 && lines.every((line) => bullet.test(line))) {
    return lines.map((line) => line.replace(bullet, "$1").trim());
  }
  const numbered = /^(?:\((\d{1,4})\)|(\d{1,4})[.)])\s+(.+)$/;
  if (lines.length > 1 && lines.every((line) => numbered.test(line))) {
    const matches = lines.map((line) => numbered.exec(line)).filter((match) => match !== null);
    return matches.map((match) => match[3].trim());
  }
  // A compact sequential list, e.g. "1. Fence repair 2. Sink repair".
  if (lines.length !== 1) return null;
  const markers = [...lines[0].matchAll(/(?:^|\s)(\d{1,4})[.)]\s+(?=\S)/g)];
  if (markers.length < 2 || markers[0].index !== 0) return null;
  if (!markers.every((match, index) => index === 0 || Number(match[1]) === Number(markers[index - 1][1]) + 1))
    return null;
  const descriptions = markers.map((match, index) =>
    lines[0].slice(match.index + match[0].length, markers[index + 1]?.index).trim(),
  );
  return descriptions.every(Boolean) ? descriptions : null;
}

export function insertPricingList<T extends { id: string; description: string }>(
  items: T[],
  targetId: string,
  descriptions: string[],
  createItem: (description: string) => T,
): T[] {
  const index = items.findIndex((item) => item.id === targetId);
  if (index < 0 || items[index].description.trim() || descriptions.length < 2) return items;
  return [
    ...items.slice(0, index),
    { ...items[index], description: descriptions[0] },
    ...descriptions.slice(1).map(createItem),
    ...items.slice(index + 1),
  ];
}
