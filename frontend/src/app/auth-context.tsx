import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  getMe,
  refreshToken,
  tokenStorage,
  type UserResponse,
} from "@/lib/api";

interface AuthState {
  accessToken: string | null;
  user: UserResponse | null;
  needsUsername: boolean;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  setSession: (
    accessToken: string,
    refreshToken: string,
    userId: string,
    email: string | null,
    needsUsername: boolean,
  ) => void;
  clearSession: () => void;
  /**
   * Clears the session and routes back to the Login page email step. Callers
   * that catch `SessionExpiredError` from `apiFetch` invoke this so an expired
   * or unrecoverable session ends consistently (R1.3, R1.7).
   */
  endSession: () => void;
  setNeedsUsername: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>({
    accessToken: tokenStorage.getAccess(),
    user: null,
    needsUsername: false,
    loading: true,
  });

  useEffect(() => {
    const token = tokenStorage.getAccess();
    const refresh = tokenStorage.getRefresh();

    if (!token) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    getMe()
      .then((user) => {
        setState((s) => ({
          ...s,
          user,
          needsUsername: !user.has_username,
          loading: false,
        }));
      })
      .catch(async () => {
        if (!refresh) {
          tokenStorage.clear();
          setState({
            accessToken: null,
            user: null,
            needsUsername: false,
            loading: false,
          });
          return;
        }

        try {
          const result = await refreshToken(refresh);
          tokenStorage.set(result.access_token, result.refresh_token);
          setState({
            accessToken: result.access_token,
            user: { id: result.user_id, email: result.email },
            needsUsername: result.needs_username,
            loading: false,
          });
        } catch {
          tokenStorage.clear();
          setState({
            accessToken: null,
            user: null,
            needsUsername: false,
            loading: false,
          });
        }
      });
  }, []);

  const setSession = useCallback(
    (
      accessToken: string,
      refreshTokenValue: string,
      userId: string,
      email: string | null,
      needsUsername: boolean,
    ) => {
      // Persist tokens synchronously BEFORE returning so any navigation or
      // onboarding request issued right after always sees the stored tokens
      // (R1.1).
      tokenStorage.set(accessToken, refreshTokenValue);
      setState({
        accessToken,
        user: { id: userId, email },
        needsUsername,
        loading: false,
      });
    },
    [],
  );

  const clearSession = useCallback(() => {
    tokenStorage.clear();
    setState({
      accessToken: null,
      user: null,
      needsUsername: false,
      loading: false,
    });
  }, []);

  const endSession = useCallback(() => {
    clearSession();
    navigate("/login", { replace: true });
  }, [clearSession, navigate]);

  const setNeedsUsername = useCallback((value: boolean) => {
    setState((s) => ({ ...s, needsUsername: value }));
  }, []);

  const value = useMemo(
    () => ({ ...state, setSession, clearSession, endSession, setNeedsUsername }),
    [state, setSession, clearSession, endSession, setNeedsUsername],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
