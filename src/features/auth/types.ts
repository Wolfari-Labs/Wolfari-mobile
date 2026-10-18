export type Profile = {
  id: string;
  email: string;
  full_name: string;
  avatar: string | null;
  system_role: "USER" | "ADMIN";
  status: "ACTIVE" | "LOCKED" | "ANONYMIZED";
  email_verified_at: string | null;
  version: number;
};

export type AuthTokens = {
  access_token: string;
  refresh_token?: string;
  token_type: "Bearer";
  expires_in: number;
  profile: Profile;
};

export type LoginInput = { email: string; password: string };
export type RegisterInput = LoginInput & { full_name: string };
export type AcceptedResponse = { message_code: "REQUEST_ACCEPTED"; correlation_id?: string };
