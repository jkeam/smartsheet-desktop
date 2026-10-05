/** Keep in sync with `HOME_URL` in `types.ts` (no import — keeps this file testable under Node ESM). */
const HOME_URL = "https://app.smartsheet.com";

const APP_HOSTS = new Set([
  "app.smartsheet.com",
  "app.smartsheet.eu",
  "app.smartsheet.au",
]);

export function isSmartsheetAppUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    return APP_HOSTS.has(parsed.hostname) || parsed.hostname.endsWith(".smartsheet.com");
  } catch {
    return false;
  }
}

export function isAuthPopupUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const href = url.toLowerCase();
    return (
      /login|signin|oauth|sso|saml|authorize|auth0|okta|onelogin|pingidentity/.test(href) ||
      host.includes("google.com") ||
      host.includes("microsoftonline.com") ||
      host.includes("apple.com") ||
      host.includes("okta.com") ||
      host.includes("auth0.com")
    );
  } catch {
    return false;
  }
}

export function isExternalUrl(url: string): boolean {
  return !isSmartsheetAppUrl(url) && !isAuthPopupUrl(url);
}

export function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] === "sheets") return "Sheet";
    if (parts[0] === "dashboards") return "Dashboard";
    if (parts[0] === "reports") return "Report";
    if (parts[0] === "workspaces") return "Workspace";
    if (parts[0] === "folders") return "Home";
  } catch {
    /* ignore */
  }
  return "Smartsheet";
}

export function normalizeAppUrl(url?: string | null): string {
  if (url && isSmartsheetAppUrl(url)) return url;
  return HOME_URL;
}
