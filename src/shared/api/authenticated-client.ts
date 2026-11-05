import { ApiError, type ApiClient, type RequestOptions } from "./api-client.ts";

type Session = {
  getAccessToken(): Promise<string>; refreshAccessToken(): Promise<string>;
  getSessionSnapshot(): { profile: { id: string } | null };
};

export function createAuthenticatedClient(client: ApiClient, session: Session, expectedUserId?: string): ApiClient {
  const assertAccount = () => {
    if (!expectedUserId || session.getSessionSnapshot().profile?.id !== expectedUserId)
      throw new ApiError("SESSION_CHANGED", "Tài khoản đã thay đổi. Mở lại màn hình bằng đúng tài khoản thực hiện.");
  };
  async function requestWithMeta<T, M = Record<string, unknown>>(path: string, options: RequestOptions = {}) {
    assertAccount();
    const accessToken = await session.getAccessToken();
    assertAccount();
    try {
      const result = await client.requestWithMeta<T, M>(path, { ...options, accessToken });
      assertAccount();
      return result;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401 || options.signal?.aborted || options.retryAuth === false) throw error;
      // Never replay a previous account's intent with a newly signed-in user's token.
      assertAccount();
      const freshToken = await session.refreshAccessToken();
      assertAccount();
      const result = await client.requestWithMeta<T, M>(path, { ...options, accessToken: freshToken });
      assertAccount();
      return result;
    }
  }
  return { requestWithMeta, async request<T>(path: string, options?: RequestOptions) { return (await requestWithMeta<T>(path, options)).data; } };
}
