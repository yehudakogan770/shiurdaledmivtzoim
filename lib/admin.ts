/** Accounts that are always administrators. Sign up or sign in with this email to manage the site. */
export const ADMIN_EMAILS = ["sdmivtzoim87@gmail.com"];

export function isAdminIdentifier(login: string | null | undefined) {
  return !!login && ADMIN_EMAILS.includes(login.trim().toLowerCase());
}

/** How a sign-in name is shown: "@mendel", or an email address as it is. */
export function handle(login: string) {
  // Kept left-to-right even on the Hebrew site, so it reads "@mendel", not "mendel@".
  return `\u2066${login.includes("@") ? login : `@${login}`}\u2069`;
}
