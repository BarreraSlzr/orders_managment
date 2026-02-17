// LEGEND: Canonical timestamp utilities
// Use only these re-exports for all fossil creation and metadata
// All usage must comply with this LEGEND and the LICENSE

export function getIsoTimestamp(): string {
  return new Date().toISOString();
}

export function generateStamp(): string {
  return getIsoTimestamp().replace(/[^0-9]/g, "").slice(0, 14);
}
