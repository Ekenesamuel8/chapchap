import { AuthUser } from "@/lib/types";

const TOKEN_KEY = "chapchap.auth.token";
const USER_KEY = "chapchap.auth.user";
const DASHBOARD_KEY = "chapchap.dashboard.cache";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    window.localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function setStoredUser(user: AuthUser): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredUser(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(USER_KEY);
}

export function getStoredDashboard<T>(): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(DASHBOARD_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    window.sessionStorage.removeItem(DASHBOARD_KEY);
    return null;
  }
}

export function setStoredDashboard<T>(dashboard: T): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(DASHBOARD_KEY, JSON.stringify(dashboard));
}

export function clearStoredDashboard(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(DASHBOARD_KEY);
}
