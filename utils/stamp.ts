// LEGEND: Canonical timestamp utilities
// Use only these re-exports for all fossil creation and metadata
// All usage must comply with this LEGEND and the LICENSE

export function getIsoTimestamp(): string {
  return new Date().toISOString();
}

export function generateStamp(): string {
  return getIsoTimestamp().replace(/[^0-9]/g, "").slice(0, 14);
}

export function formatUnixSecondsToReadable(
  unixSeconds: number | string,
): string | null {
  const parsed =
    typeof unixSeconds === "string"
      ? Number.parseInt(unixSeconds, 10)
      : unixSeconds;

  if (!Number.isFinite(parsed)) return null;

  const asDate = new Date(parsed * 1000);
  if (Number.isNaN(asDate.getTime())) return null;

  return asDate.toISOString().replace("T", " ").replace(".000Z", " UTC");
}
