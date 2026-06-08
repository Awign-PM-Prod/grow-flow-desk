/** Flip to `true` when transactional portal emails should be sent again. */
export const PORTAL_EMAIL_SENDING_ENABLED = false;

export const PORTAL_EMAIL_SENDING_DISABLED_MESSAGE =
  "Email sending is temporarily disabled.";

export function isPortalEmailSendingEnabled(): boolean {
  return PORTAL_EMAIL_SENDING_ENABLED;
}
