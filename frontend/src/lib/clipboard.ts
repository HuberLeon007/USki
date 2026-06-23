/** Clipboard helpers shared across the app. */

/**
 * Copy text to the clipboard, with a fallback for non-secure contexts /
 * browsers where the async Clipboard API is unavailable. Returns whether the
 * copy succeeded. Never throws.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Label an IP string as "IPv4" or "IPv6", or null when there's no usable IP.
 * Used in the Security tab so each session shows what it connected with.
 */
export function ipVersionLabel(ip: string | null | undefined): "IPv4" | "IPv6" | null {
  if (!ip) return null;
  const trimmed = ip.trim();
  if (!trimmed) return null;
  return trimmed.includes(":") ? "IPv6" : "IPv4";
}
