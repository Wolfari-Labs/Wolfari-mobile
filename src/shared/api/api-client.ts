export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly correlationId?: string;

  constructor(
    code: string,
    message: string,
    status = 0,
    retryable = false,
    correlationId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.correlationId = correlationId;
  }
}

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  accessToken?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  responseType?: "json" | "blob";
  retryAuth?: boolean;
};

type ClientOptions = {
  getBaseUrl: () => string;
  clientType?: "mobile" | "web";
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
};

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function createApiClient({
  getBaseUrl,
  clientType = "mobile",
  fetch: fetchRequest = globalThis.fetch,
  timeoutMs = 25_000,
}: ClientOptions) {
    async function requestWithMeta<T, M = Record<string, unknown>>(path: string, options: RequestOptions = {}): Promise<{ data: T; meta: M }> {
      // Only relative Gateway paths are allowed; credentials never go to another host.
      if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
        throw new ApiError("INVALID_PATH", "Đường dẫn API không hợp lệ.");
      }
      const baseUrl = getBaseUrl().replace(/\/+$/, "");

      const controller = new AbortController();
      const cancel = () => controller.abort();
      options.signal?.addEventListener("abort", cancel, { once: true });
      if (options.signal?.aborted) cancel();
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      try {
        const multipart = typeof FormData !== "undefined" && options.body instanceof FormData;
        const response = await fetchRequest(`${baseUrl}${path}`, {
          method: options.method ?? "GET",
          credentials: clientType === "web" ? "include" : "omit",
          headers: {
            Accept: "application/json",
            "X-Client-Type": clientType,
            ...(options.body !== undefined && !multipart ? { "Content-Type": "application/json" } : {}),
            ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
            ...options.headers,
          },
          body: multipart ? options.body as FormData : options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: controller.signal,
        });
        if (response.status === 204 && response.ok) return { data: undefined as T, meta: {} as M };
        if (response.ok && options.responseType === "blob") return { data: await response.blob() as T, meta: {} as M };

        const payload: unknown = await response.json().catch(() => undefined);
        const envelope = record(payload);
        const meta = record(envelope?.meta);
        const correlationId = typeof meta?.correlation_id === "string" ? meta.correlation_id : undefined;

        if (!response.ok) {
          const error = record(envelope?.error);
          throw new ApiError(
            typeof error?.code === "string" ? error.code : "REQUEST_FAILED",
            typeof error?.message === "string" ? error.message : "Không thể hoàn tất yêu cầu.",
            response.status,
            error?.retryable === true,
            correlationId,
          );
        }
        if (!envelope || !Object.hasOwn(envelope, "data")) {
          throw new ApiError("INVALID_RESPONSE", "Phản hồi từ máy chủ không hợp lệ.", response.status);
        }
        return { data: envelope.data as T, meta: (envelope.meta ?? {}) as M };
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (options.signal?.aborted) throw error;
        throw new ApiError(
          timedOut ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
          timedOut
            ? "Yêu cầu mất quá nhiều thời gian. Vui lòng thử lại."
            : "Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng.",
          0,
          true,
        );
      } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener("abort", cancel);
      }
    }
  return {
    requestWithMeta,
    async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
      return (await requestWithMeta<T>(path, options)).data;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
