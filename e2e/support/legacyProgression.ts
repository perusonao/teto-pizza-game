export const LEGACY_PROGRESSION_QUERY = "?progression=legacy";

export function legacyProgressionUrl(path = "/") {
  const [pathname, query] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("progression", "legacy");
  return `${pathname}?${params}`;
}
