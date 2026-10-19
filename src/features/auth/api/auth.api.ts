import { Platform } from "react-native";

import { apiClient } from "@/shared/api/client";
import type { AcceptedResponse, AuthTokens, LoginInput, Profile, RegisterInput } from "../types";

export const authApi = {
  login(input: LoginInput) {
    return apiClient.request<AuthTokens>("/auth/login", {
      method: "POST",
      body: { email: input.email.trim().toLowerCase(), password: input.password },
    });
  },

  register(input: RegisterInput) {
    // Registration returns 202 for new AND existing emails; it does not create a session.
    return apiClient.request<AcceptedResponse>("/auth/register", {
      method: "POST",
      body: {
        email: input.email.trim().toLowerCase(),
        full_name: input.full_name.trim(),
        password: input.password,
      },
    });
  },

  async refresh(refreshToken?: string) {
    if (Platform.OS === "web") {
      const { csrf_token } = await apiClient.request<{ csrf_token: string }>("/auth/csrf");
      return apiClient.request<AuthTokens>("/auth/refresh", {
        method: "POST",
        body: {},
        headers: { "X-CSRF-Token": csrf_token },
      });
    }
    return apiClient.request<AuthTokens>("/auth/refresh", {
      method: "POST",
      body: { refresh_token: refreshToken },
    });
  },

  getProfile(accessToken: string) {
    return apiClient.request<Profile>("/me", { accessToken });
  },

  requestPasswordReset(email: string) {
    return apiClient.request<AcceptedResponse>("/auth/password-reset-requests", {
      method: "POST",
      body: { email: email.trim().toLowerCase() },
    });
  },
};
