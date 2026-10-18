import { useMemo } from "react";

import { useSession } from "@/features/auth/session/session-provider";
import { createTripsApi } from "@/features/trips/api/trips.api";
import { ApiError, type ApiClient, type RequestOptions } from "./api-client";
import { apiClient } from "./client";

export function useApi() {
  const { getAccessToken, refreshAccessToken } = useSession();
  return useMemo(() => {
    async function requestWithMeta<T, M = Record<string, unknown>>(path: string, options: RequestOptions = {}) {
      const accessToken = await getAccessToken();
      try {
        return await apiClient.requestWithMeta<T, M>(path, { ...options, accessToken });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401 || options.signal?.aborted) throw error;
        const freshToken = await refreshAccessToken();
        return apiClient.requestWithMeta<T, M>(path, { ...options, accessToken: freshToken });
      }
    }
    const client: ApiClient = {
      requestWithMeta,
      async request<T>(path: string, options?: RequestOptions) { return (await requestWithMeta<T>(path, options)).data; },
    };
    return { ...client, trips: createTripsApi(client) };
  }, [getAccessToken, refreshAccessToken]);
}
