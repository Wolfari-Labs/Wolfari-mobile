type Options = { configured?: string; development: boolean; hostUri?: string; webHost?: string };

export function resolveApiUrl({ configured, development, hostUri, webHost }: Options): string {
  let value = configured?.trim();
  if (!value && development) {
    let hostname = webHost || "127.0.0.1";
    if (!webHost && hostUri) {
      try { hostname = new URL(hostUri.includes("://") ? hostUri : `http://${hostUri}`).hostname; }
      catch { throw new Error("Không đọc được địa chỉ Expo. Hãy đặt EXPO_PUBLIC_API_URL trong .env.local."); }
    }
    if (!/^(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[\w-]+\.local)$/i.test(hostname)) {
      throw new Error("Expo tunnel chỉ chuyển tiếp Metro. Hãy đặt EXPO_PUBLIC_API_URL thành URL Gateway mà điện thoại truy cập được.");
    }
    value = `http://${hostname}:3001/api/v1`;
  }
  if (!value) throw new Error("EXPO_PUBLIC_API_URL is required for production builds.");
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname.replace(/\/+$/, "") !== "/api/v1") {
    throw new Error("EXPO_PUBLIC_API_URL phải là URL HTTP(S) Gateway kết thúc bằng /api/v1, không kèm thông tin đăng nhập.");
  }
  if (!development && url.protocol !== "https:") throw new Error("EXPO_PUBLIC_API_URL must use HTTPS in production.");
  return value.replace(/\/+$/, "");
}
