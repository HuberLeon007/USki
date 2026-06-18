/**
 * Pure viewport-clamping helper for the AI assistant's draggable small window.
 *
 * Used by `AssistantWindow` to keep the whole window on-screen while dragging
 * (R18.3) and to re-clamp after a viewport resize (R18.5), as well as to pin the
 * small window when the viewport is narrower than the window (R17.7).
 *
 * The function is PURE (no side effects) and IDEMPOTENT: re-clamping an already
 * valid position returns the same position, so a resize never nudges a window
 * that is already fully visible.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Clamp the window's top-left corner so the whole window stays within the
 * viewport's `[0, viewport]` box on every edge.
 *
 * When the window is larger than the viewport on an axis (e.g. the window is
 * wider than a sub-320px viewport), there is no position that fits the whole
 * window, so we pin that axis to `0` (the available space) and never return a
 * negative coordinate.
 *
 * The result is idempotent: `clampToViewport(clampToViewport(p, s, v), s, v)`
 * equals `clampToViewport(p, s, v)`.
 */
export function clampToViewport(pos: Point, size: Size, viewport: Size): Point {
  return {
    x: clampAxis(pos.x, size.width, viewport.width),
    y: clampAxis(pos.y, size.height, viewport.height),
  };
}

/**
 * Clamp a single axis. `max` is the largest valid top-left coordinate so the
 * window's far edge (`coord + extent`) does not exceed `available`. When the
 * window is larger than the available space, `max` would be negative, so we pin
 * to `0` instead of returning a negative coordinate.
 */
function clampAxis(coord: number, extent: number, available: number): number {
  const max = Math.max(0, available - extent);
  if (coord < 0) return 0;
  if (coord > max) return max;
  return coord;
}
