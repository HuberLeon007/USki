import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { getMe, tokenStorage, type UserResponse } from "@/lib/api";

interface AuthState {
  /** True until the persisted token has been checked on launch. */
  loading: boolean;
  /** Signed-in user, or null when signed out. */
  user: UserResponse | null;
  /** True when a token is present (even before /me resolves). */
  authenticated: boolean;
  /** Persist a freshly minted session and load the profile. */
  signIn: (access: string, refresh: string) => Promise<void>;
  /** Clear tokens and reset to signed-out. */
  signOut: () => Promise<void>;
  /** Re-fetch the profile (after username change etc.). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserResponse | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const me = await getMe();
      setUser(me);
      setAuthenticated(true);
    } catch {
      // Token missing/expired: stay signed out, the api layer already cleared it.
      await tokenStorage.clear();
      setUser(null);
      setAuthenticated(false);
    }
  }, []);

  // On launch, restore any persisted session.
  useEffect(() => {
    (async () => {
      const access = await tokenStorage.getAccess();
      if (access) await loadProfile();
      setLoading(false);
    })();
  }, [loadProfile]);

  const signIn = useCallback(
    async (access: string, refresh: string) => {
      await tokenStorage.set(access, refresh);
      setAuthenticated(true);
      await loadProfile();
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    await tokenStorage.clear();
    setUser(null);
    setAuthenticated(false);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ loading, user, authenticated, signIn, signOut, refresh: loadProfile }),
    [loading, user, authenticated, signIn, signOut, loadProfile],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
