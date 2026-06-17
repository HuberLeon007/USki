import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getMe, refreshToken, type UserResponse } from "@/lib/api";

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
  setNeedsUsername: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    accessToken: localStorage.getItem("uski_access_token"),
    user: null,
    needsUsername: false,
    loading: true,
  });

  useEffect(() => {
    const token = localStorage.getItem("uski_access_token");
    const refresh = localStorage.getItem("uski_refresh_token");

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
          localStorage.removeItem("uski_access_token");
          localStorage.removeItem("uski_refresh_token");
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
          localStorage.setItem("uski_access_token", result.access_token);
          localStorage.setItem("uski_refresh_token", result.refresh_token);
          setState({
            accessToken: result.access_token,
            user: { id: result.user_id, email: result.email },
            needsUsername: result.needs_username,
            loading: false,
          });
        } catch {
          localStorage.removeItem("uski_access_token");
          localStorage.removeItem("uski_refresh_token");
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
      localStorage.setItem("uski_access_token", accessToken);
      localStorage.setItem("uski_refresh_token", refreshTokenValue);
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
    localStorage.removeItem("uski_access_token");
    localStorage.removeItem("uski_refresh_token");
    setState({
      accessToken: null,
      user: null,
      needsUsername: false,
      loading: false,
    });
  }, []);

  const setNeedsUsername = useCallback((value: boolean) => {
    setState((s) => ({ ...s, needsUsername: value }));
  }, []);

  const value = useMemo(
    () => ({ ...state, setSession, clearSession, setNeedsUsername }),
    [state, setSession, clearSession, setNeedsUsername],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
