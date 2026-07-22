export function semanticGrepEnrichmentEnabled(enrich: unknown): boolean {
  if (enrich === true) return true;
  if (typeof enrich !== "string") return false;
  const normalized = enrich.trim().toLowerCase();
  return ["1", "true", "yes", "on", "inspect"].includes(normalized);
}
