import type { ApiClient } from "../../../shared/api/api-client";
import type { AcceptedResponse, Profile } from "../types";

export function createAccountApi(client: ApiClient) {
  return {
    requestReset: (email: string) => client.request<AcceptedResponse>("/auth/password-reset-requests", {
      method: "POST", body: { email: email.trim().toLowerCase() },
    }),
    resetPassword: (token: string, new_password: string) => client.request<AcceptedResponse>("/auth/password-resets", {
      method: "POST", body: { token, new_password },
    }),
    confirmEmail: (token: string) => client.request<AcceptedResponse>("/auth/email-verifications/confirm", {
      method: "POST", body: { token },
    }),
    resendVerification: () => client.request<AcceptedResponse>("/auth/email-verifications", { method: "POST", body: {} }),
    changePassword: (current_password: string, new_password: string) => client.request<AcceptedResponse>("/me/password-change", {
      method: "POST", body: { current_password, new_password }, retryAuth: false,
    }),
    uploadAvatar: (body: FormData) => client.request<{ object_key: string }>("/me/avatar", { method: "POST", body }),
    avatar: (signal?: AbortSignal) => client.request<Blob>("/me/avatar", { responseType: "blob", signal }),
    updateAvatar: (avatar_object_key: string | null, expected_version: number) => client.request<Profile>("/me", {
      method: "PATCH", body: { avatar_object_key, expected_version },
    }),
  };
}
