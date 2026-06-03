/** Portal-aligned email theme (matches src/index.css design tokens). */

export const EMAIL_FROM = "Awign CRM <awigncrm@awign.in>";

/** App-hosted fallback filename (joined with site base URL; no leading `/` — CLI bundler treats absolute paths as assets) */
export const EMAIL_LOGO_APP_FILE = "awign-email-logo.png";

/** Supabase Storage public bucket — no app redeploy needed */
export const EMAIL_LOGO_BUCKET = "email-assets";
export const EMAIL_LOGO_STORAGE_FILE = "awign-email-logo.png";

const COLORS = {
  primary: "#0678D4",
  primaryDark: "#0568B8",
  accent: "#12A5D7",
  foreground: "#1C2434",
  muted: "#64748B",
  mutedBg: "#F1F5F9",
  card: "#FFFFFF",
  border: "#E2E8F0",
  sidebar: "#1C2434",
};

export type BrandedEmailOptions = {
  title: string;
  subtitle?: string;
  contentHtml: string;
  preheader?: string;
  /** Public app URL (https) so email clients can load the logo image */
  siteUrl?: string;
};

/** Build public Storage URL (SUPABASE_URL is always set in edge functions). */
export function resolveSupabaseStorageLogoUrl(): string | null {
  if (typeof Deno === "undefined") return null;

  const explicit = Deno.env.get("EMAIL_LOGO_URL")?.trim();
  if (explicit) return explicit;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  if (!supabaseUrl) return null;

  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${EMAIL_LOGO_BUCKET}/${EMAIL_LOGO_STORAGE_FILE}`;
}

/** Gmail/Outlook need a public HTTPS PNG — prefer Storage, then optional app URL. */
export function resolveEmailLogoUrl(siteUrl?: string): string | null {
  const storageUrl = resolveSupabaseStorageLogoUrl();
  if (storageUrl) return storageUrl;

  const candidates = [
    siteUrl,
    typeof Deno !== "undefined" ? Deno.env.get("SITE_URL") : undefined,
    typeof Deno !== "undefined" ? Deno.env.get("VITE_SITE_URL") : undefined,
    typeof Deno !== "undefined" ? Deno.env.get("PUBLIC_APP_URL") : undefined,
  ];

  for (const raw of candidates) {
    if (!raw?.trim()) continue;
    const base = raw.trim().replace(/\/$/, "");
    try {
      const parsed = new URL(base);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") continue;
      if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") continue;
      return `${base}/${EMAIL_LOGO_APP_FILE}`;
    } catch {
      continue;
    }
  }
  return null;
}

function emailLogoCell(siteUrl?: string): string {
  const logoUrl = resolveEmailLogoUrl(siteUrl);
  if (logoUrl) {
    return `
      <td style="width: 44px; vertical-align: middle;">
        <img
          src="${logoUrl}"
          alt=""
          width="40"
          height="40"
          style="display: block; width: 40px; height: 40px; border-radius: 8px; border: 0; outline: none; text-decoration: none;"
        />
      </td>`;
  }
  return `
    <td style="width: 44px; vertical-align: middle;">
      <div style="width: 40px; height: 40px; border-radius: 8px; background: #113DBC; text-align: center; line-height: 40px; font-size: 18px; font-weight: 700; color: #ffffff;">A</div>
    </td>`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emailParagraph(html: string): string {
  return `<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.65; color: ${COLORS.foreground};">${html}</p>`;
}

export function emailButton(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px auto;">
      <tr>
        <td align="center" style="border-radius: 8px; background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.accent} 100%);">
          <a href="${href}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

export function emailInfoBox(html: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; background: ${COLORS.mutedBg}; border-radius: 8px; border: 1px solid ${COLORS.border}; border-left: 4px solid ${COLORS.primary};">
      <tr>
        <td style="padding: 18px 20px; font-size: 14px; line-height: 1.6; color: ${COLORS.foreground};">
          ${html}
        </td>
      </tr>
    </table>
  `;
}

export function emailDetailCard(rows: Array<{ label: string; value: string }>): string {
  const rowsHtml = rows
    .map(
      (row) => `
        <tr>
          <td style="padding: 10px 16px; font-size: 13px; font-weight: 600; color: ${COLORS.muted}; width: 40%; vertical-align: top; border-bottom: 1px solid ${COLORS.border};">
            ${escapeHtml(row.label)}
          </td>
          <td style="padding: 10px 16px; font-size: 14px; color: ${COLORS.foreground}; vertical-align: top; border-bottom: 1px solid ${COLORS.border};">
            ${escapeHtml(row.value)}
          </td>
        </tr>
      `,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; background: ${COLORS.card}; border-radius: 8px; border: 1px solid ${COLORS.border}; overflow: hidden;">
      ${rowsHtml}
    </table>
  `;
}

export function emailSectionTitle(text: string): string {
  return `<p style="margin: 24px 0 12px; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: ${COLORS.primary};">${escapeHtml(text)}</p>`;
}

export function emailSignature(lines: string[]): string {
  const body = lines.map((line) => escapeHtml(line)).join("<br>");
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 28px; padding-top: 20px; border-top: 1px solid ${COLORS.border};">
      <tr>
        <td style="font-size: 14px; line-height: 1.7; color: ${COLORS.foreground};">
          <span style="color: ${COLORS.muted};">Regards,</span><br>
          <strong>${body}</strong>
        </td>
      </tr>
    </table>
  `;
}

export function wrapBrandedEmail(options: BrandedEmailOptions): string {
  const { title, subtitle, contentHtml, preheader, siteUrl } = options;
  const logoCell = emailLogoCell(siteUrl);
  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: ${COLORS.mutedBg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    ${preheaderHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${COLORS.mutedBg}; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background: ${COLORS.card}; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(28, 36, 52, 0.1), 0 4px 6px -4px rgba(28, 36, 52, 0.08); border: 1px solid ${COLORS.border};">
            <tr>
              <td style="background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.accent} 100%); padding: 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 28px 32px 12px;">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          ${logoCell}
                          <td style="padding-left: 12px; vertical-align: middle;">
                            <p style="margin: 0; font-size: 14px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.95);">Awign CRM</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 32px 28px;">
                      <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; line-height: 1.3;">${escapeHtml(title)}</h1>
                      ${subtitle ? `<p style="margin: 10px 0 0; font-size: 15px; color: rgba(255,255,255,0.9); line-height: 1.5;">${escapeHtml(subtitle)}</p>` : ""}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="height: 4px; background: ${COLORS.sidebar};"></td>
            </tr>
            <tr>
              <td style="padding: 32px;">
                ${contentHtml}
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 32px 28px; background: ${COLORS.mutedBg}; border-top: 1px solid ${COLORS.border}; text-align: center;">
                <p style="margin: 0 0 6px; font-size: 12px; color: ${COLORS.muted};">
                  This message was sent from <strong style="color: ${COLORS.foreground};">Awign CRM</strong>
                </p>
                <p style="margin: 0; font-size: 11px; color: ${COLORS.muted};">
                  &copy; ${new Date().getFullYear()} Awign. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
