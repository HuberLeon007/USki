import { useEffect, useState } from "react";

/** Phone-sized breakpoint. The web app targets desktop/tablet; phones get the app. */
export const MOBILE_MAX_WIDTH = 768;

/**
 * True when the viewport is phone-sized. Uses matchMedia (no scroll/resize spam)
 * and updates live so rotating a tablet or resizing reacts immediately.
 */
export function useIsMobile(): boolean {
  const query = `(max-width: ${MOBILE_MAX_WIDTH - 1}px)`;
  const [isMobile, setIsMobile] = useState<boolean>(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return isMobile;
}
