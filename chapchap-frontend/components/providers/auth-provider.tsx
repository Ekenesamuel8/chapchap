"use client";

import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchMe, loginWithGoogleIdToken as requestGoogleLogin } from "@/lib/api/auth";
import {
  clearAuthToken,
  clearStoredChatSession,
  clearStoredDashboard,
  clearStoredUser,
  getAuthToken,
  getStoredUser,
  setAuthToken,
  setStoredUser,
} from "@/lib/auth-storage";
import { ApiError } from "@/lib/api/client";
import { AuthUser } from "@/lib/types";

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  isAuthenticated: boolean;
  loginWithGoogleIdToken: (idToken: string) => Promise<void>;
  loginWithDevToken: (token: string) => Promise<void>;
  logout: () => void;
  setSession: (token: string, user: AuthUser) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setTokenState(getAuthToken());
      setUser(getStoredUser());
      setHydrated(true);
    });
  }, []);

  const setSession = useCallback((nextToken: string, nextUser: AuthUser) => {
    setAuthToken(nextToken);
    setStoredUser(nextUser);
    setTokenState(nextToken);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    clearAuthToken();
    clearStoredUser();
    clearStoredDashboard();
    clearStoredChatSession();
    setTokenState(null);
    setUser(null);
  }, []);

  const loginWithGoogleIdToken = useCallback(async (idToken: string) => {
    const response = await requestGoogleLogin(idToken);
    setSession(response.token, response.user);
  }, [setSession]);

  const loginWithDevToken = useCallback(async (nextToken: string) => {
    const trimmed = nextToken.trim();
    const me = await fetchMe(trimmed);
    setSession(trimmed, me);
  }, [setSession]);

  useEffect(() => {
    if (!hydrated || !token || user) return;

    fetchMe(token)
      .then((nextUser) => {
        setStoredUser(nextUser);
        setUser(nextUser);
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) {
          logout();
        }
      });
  }, [hydrated, logout, token, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      hydrated,
      isAuthenticated: Boolean(token),
      loginWithGoogleIdToken,
      loginWithDevToken,
      logout,
      setSession,
    }),
    [token, user, hydrated, loginWithDevToken, loginWithGoogleIdToken, logout, setSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
