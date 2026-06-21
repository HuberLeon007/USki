/**
 * Cards are stored as HTML on the backend. Native has no DOM, so for list
 * previews we reduce HTML to readable plain text: drop tags, collapse
 * whitespace, and decode the handful of entities the editor emits.
 */
import { API_URL } from "./api";

export function htmlToText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Wrap user-typed plain text back into the minimal HTML the backend stores.
 * Escapes HTML-significant characters and turns newlines into <br>.
 */
export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<p>${escaped.replace(/\n/g, "<br>")}</p>`;
}

/**
 * Card images are stored as absolute Supabase URLs. In dev that host is
 * 127.0.0.1 / localhost, which on a physical phone resolves to the phone
 * itself. Rewrite such hosts to the LAN host the app already uses for the API
 * (same host as EXPO_PUBLIC_API_URL, keeping the original port). Real domains
 * (prod) are left untouched.
 */
export function resolveAssetUrl(src: string): string {
  const apiHost = API_URL.replace(/^https?:\/\//, "").split(/[:/]/)[0];
  if (!apiHost || apiHost === "localhost" || apiHost === "127.0.0.1") return src;
  return src.replace(
    /^(https?:\/\/)(127\.0\.0\.1|localhost)(:\d+)?/i,
    (_m, scheme, _host, port) => `${scheme}${apiHost}${port ?? ""}`,
  );
}
