/** Public URL of the deployed app (auth redirects / email asset links). */
export function getAppSiteUrl(): string {
  if (typeof window !== "undefined") {
    const { hostname, origin, protocol } = window.location;
    // Prefer live page origin on the production domain so scheme matches (https).
    if (
      hostname === "awigncrm.awignhub.in" ||
      hostname.endsWith(".awignhub.in")
    ) {
      return origin;
    }
    if (
      protocol === "https:" &&
      !hostname.includes("localhost") &&
      !hostname.includes("127.0.0.1")
    ) {
      return origin;
    }
  }

  const configured = import.meta.env.VITE_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}
