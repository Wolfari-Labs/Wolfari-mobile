import { Platform } from "react-native";

import { getApiBaseUrl } from "@/shared/config/env";
import { createApiClient } from "./api-client";

export const apiClient = createApiClient({
  getBaseUrl: getApiBaseUrl,
  clientType: Platform.OS === "web" ? "web" : "mobile",
});
