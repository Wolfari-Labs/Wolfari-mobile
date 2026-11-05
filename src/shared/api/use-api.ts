import { useMemo } from "react";

import { useSession } from "@/features/auth/session/session-provider";
import { createTripsApi } from "@/features/trips/api/trips.api";
import { createAccountApi } from "@/features/auth/api/account.api";
import { createFinanceApi } from "@/features/finance/api";
import { createAuthenticatedClient } from "./authenticated-client";
import { apiClient } from "./client";

export function useApi() {
  const { getAccessToken, refreshAccessToken, getSessionSnapshot, profile } = useSession();
  const userId = profile?.id;
  return useMemo(() => {
    const client = createAuthenticatedClient(apiClient, { getAccessToken, refreshAccessToken, getSessionSnapshot }, userId);
    return { ...client, trips: createTripsApi(client), account: createAccountApi(client), finance: createFinanceApi(client) };
  }, [getAccessToken, refreshAccessToken, getSessionSnapshot, userId]);
}
