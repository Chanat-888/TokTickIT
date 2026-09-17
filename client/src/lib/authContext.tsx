import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getMe, login as apiLogin, logout as apiLogout, type LoginResult, type User } from "../api.js";
import { setUnauthorizedHandler } from "./apiClient.js";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  // Re-fetches /auth/me — used after Change Password clears
  // mustChangePassword, so the rest of the app sees the update immediately.
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const refresh = useCallback(async () => {
    const current = await getMe();
    setUser(current);
    setStatus(current ? "authenticated" : "unauthenticated");
  }, []);

  // The session lives in an httpOnly cookie, not client-readable state, so
  // every fresh page load must ask the server who (if anyone) is logged in.
  useEffect(() => {
    refresh().catch(() => setStatus("unauthenticated"));
  }, [refresh]);

  // A 401 from any non-/auth/* request means the session died server-side
  // mid-use; route the app back to unauthenticated instead of leaving
  // "status" stuck on "authenticated" with requests silently failing.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setStatus("unauthenticated");
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email, password);
    if (result.status === 200) {
      setUser(result.user);
      setStatus("authenticated");
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
