/** Public HTTPS URL of the deployed app (used for email image assets). */
export function getAppSiteUrl(): string {
  const configured = import.meta.env.VITE_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    if (!origin.includes("localhost") && !origin.includes("127.0.0.1")) {
      return origin;
    }
  }
  return configured || (typeof window !== "undefined" ? window.location.origin : "");
}
