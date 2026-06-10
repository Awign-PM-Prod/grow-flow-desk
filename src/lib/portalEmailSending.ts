/** Flip to `true` when transactional portal emails should be sent again. */
export const PORTAL_EMAIL_SENDING_ENABLED = false;

/** Welcome/invite email sent when an admin creates a new user. */
export const PORTAL_INVITE_EMAIL_ENABLED = true;

export const PORTAL_EMAIL_SENDING_DISABLED_MESSAGE =
  "Email sending is temporarily disabled.";

export function isPortalEmailSendingEnabled(): boolean {
  return PORTAL_EMAIL_SENDING_ENABLED;
}

export function isPortalInviteEmailEnabled(): boolean {
  return PORTAL_INVITE_EMAIL_ENABLED;
}
