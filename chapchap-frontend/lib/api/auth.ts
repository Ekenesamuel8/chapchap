import { apiRequest } from "@/lib/api/client";
import {
  AuthResponse,
  AuthUser,
  DashboardResponse,
  FundOptionsResponse,
} from "@/lib/types";

export function loginWithGoogleIdToken(idToken: string) {
  return apiRequest<AuthResponse>("/api/auth/google/", {
    method: "POST",
    body: { id_token: idToken },
  });
}

export function fetchMe(token?: string | null) {
  return apiRequest<AuthUser>("/api/me/", {
    method: "GET",
    token,
  });
}

export function fetchDashboard(token?: string | null) {
  return apiRequest<DashboardResponse>("/api/me/dashboard/", {
    method: "GET",
    token,
  });
}

export function fetchFundOptions(token?: string | null) {
  return apiRequest<FundOptionsResponse>("/api/wallet/fund-options/", {
    method: "GET",
    token,
  });
}
