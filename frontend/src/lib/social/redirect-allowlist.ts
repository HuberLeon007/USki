/**
 * Redirect allowlist guard (social-login).
 *
 * Pure helpers that decide whether a post-login / OAuth callback redirect target
 * is safe. A target is accepted only when its normalized form matches a
 * pre-approved entry on the allowlist of USki destinations; everything else is
 * rejected and {@link resolveRedirect} falls back to the LoginPage, so no input
 * can ever produce an open redirect (Requirements 10.1, 10.2).
 *
 * Normalization (scheme, host, trailing slash, relative-vs-absolute, and
 * backslash escaping) is hidden inside this module so callers cannot
 * accidentally bypass the check by passing a differently-shaped-but-equivalent
 * URL.
 */

/**
 * A sentinel base used only to parse relative and protocol-relative inputs into
 * a comparable shape. Its host never matches a real allowlist entry, so it
 * cannot be exploited to authorize an off-allowlist destination.
 */
const SENTINEL_BASE = "https://uski.invalid";

interface NormalizedTarget {
  /** Whether the input carried (or implied) a scheme/host of its own. */
  isAbsolute: boolean;
  /** Lowercased scheme without the trailing colon; empty when unknown. */
  scheme: string;
  /** Lowercased host (with port if present); empty for relative targets. */
  host: string;
  /** Path with any trailing slash removed (root stays "/"). */
  path: string;
}

function hasExplicitScheme(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
}

function stripTrailingSlash(path: string): string {
  if (path === "" ) {
    return "/";
  }
  if (path.length > 1) {
    return path.replace(/\/+$/, "") || "/";
  }
  return path;
}

/**
 * Reduce an arbitrary redirect string to a comparable, canonical form, or
 * `null` when it cannot be parsed. Backslashes are treated as forward slashes
 * (matching browser behavior) so escape tricks cannot smuggle a foreign host.
 */
function normalize(raw: string): NormalizedTarget | null {
  if (typeof raw !== "string") {
    return null;
  }
  const value = raw.trim().replace(/\\/g, "/");
  if (value === "") {
    return null;
  }

  const protocolRelative = value.startsWith("//");
  const absolute = hasExplicitScheme(value) || protocolRelative;

  try {
    const url = new URL(value, SENTINEL_BASE);
    if (absolute) {
      return {
        isAbsolute: true,
        // A protocol-relative URL has no scheme of its own, so leave it empty:
        // it then cannot match a scheme-qualified allowlist entry.
        scheme: protocolRelative ? "" : url.protocol.replace(/:$/, "").toLowerCase(),
        host: url.host.toLowerCase(),
        path: stripTrailingSlash(url.pathname),
      };
    }
    return {
      isAbsolute: false,
      scheme: "",
      host: "",
      path: stripTrailingSlash(url.pathname),
    };
  } catch {
    return null;
  }
}

function matches(target: NormalizedTarget, entry: NormalizedTarget): boolean {
  if (target.isAbsolute) {
    // An absolute target must match an absolute allowlist entry on scheme, host,
    // and path. A relative entry can never authorize a cross-host target.
    if (!entry.isAbsolute) {
      return false;
    }
    return (
      target.scheme !== "" &&
      target.scheme === entry.scheme &&
      target.host === entry.host &&
      target.path === entry.path
    );
  }
  // A relative target is same-origin by construction (and therefore safe); it
  // only needs its path to match an allowlisted destination's path.
  return target.path === entry.path;
}

/**
 * Returns true only when `target` normalizes to a destination present on
 * `allowlist`.
 */
export function isAllowedRedirect(target: string, allowlist: readonly string[]): boolean {
  const normalizedTarget = normalize(target);
  if (normalizedTarget === null) {
    return false;
  }
  return allowlist.some((entry) => {
    const normalizedEntry = normalize(entry);
    return normalizedEntry !== null && matches(normalizedTarget, normalizedEntry);
  });
}

/**
 * Returns `target` when it is allowlisted, otherwise the trusted `fallback`
 * (the LoginPage). Never returns an off-allowlist destination.
 */
export function resolveRedirect(
  target: string | null,
  allowlist: readonly string[],
  fallback: string,
): string {
  if (target !== null && isAllowedRedirect(target, allowlist)) {
    return target;
  }
  return fallback;
}
