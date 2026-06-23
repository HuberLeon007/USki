// Global test setup: register the jest-dom matchers (toBeInTheDocument,
// toHaveAttribute, etc.) for the @testing-library/react component tests.
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// localStorage / sessionStorage polyfill
//
// Under our jsdom version the Web Storage objects ship incomplete (e.g.
// `localStorage.removeItem` is undefined), which throws the moment any code
// clears tokens via `tokenStorage`. A real browser always provides the full
// Storage API, so we install a spec-complete in-memory Storage here to make
// the test environment mirror the browser. Production code is unaffected.
// ---------------------------------------------------------------------------
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

function installStorage(name: "localStorage" | "sessionStorage"): void {
  const value = new MemoryStorage();
  const descriptor: PropertyDescriptor = { value, configurable: true, writable: true };
  try {
    Object.defineProperty(globalThis, name, descriptor);
  } catch {
    (globalThis as Record<string, unknown>)[name] = value;
  }
  if (typeof window !== "undefined") {
    try {
      Object.defineProperty(window, name, descriptor);
    } catch {
      (window as unknown as Record<string, unknown>)[name] = value;
    }
  }
}

installStorage("localStorage");
installStorage("sessionStorage");
