/**
 * payOS moves real money: a VietQR payment link that pays straight into the Holder's bank account.
 * The server offers it only when that account is the contribution destination, verifies the
 * payOS webhook and confirms the contribution itself; the app never decides that money arrived.
 */
export const PAYOS_ATTEMPT_TITLE = 'Thanh toán qua payOS';

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** Unpadded base64url of an ASCII app link, the token format the Gateway return page expects. */
export function appLinkToken(appLink: string): string {
  const bytes = [...appLink].map(char => {
    const code = char.charCodeAt(0);
    if (code > 0x7e || code < 0x20) throw new Error('App link must be ASCII');
    return code;
  });
  let token = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = bytes.slice(i, i + 3);
    const n = (a! << 16) | (b << 8) | c;
    token += BASE64URL[(n >> 18) & 63]! + BASE64URL[(n >> 12) & 63]!;
    if (i + 1 < bytes.length) token += BASE64URL[(n >> 6) & 63]!;
    if (i + 2 < bytes.length) token += BASE64URL[n & 63]!;
  }
  return token;
}

/** Gateway page payOS returns the payer's browser to; it then opens `appLink`. */
export function payosReturnPage(apiBaseUrl: string, appLink: string): string {
  return `${apiBaseUrl.replace(/\/+$/, '')}/payments/payos/return/${appLinkToken(appLink)}`;
}

/** Only payOS's own hosted page is ever opened for a payOS attempt. */
export function payosCheckoutUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Liên kết thanh toán không hợp lệ.');
  }
  if (url.protocol !== 'https:' || url.hostname !== 'pay.payos.vn' || url.username || url.password)
    throw new Error('Liên kết thanh toán không hợp lệ.');
  return url.href;
}

const LABELS: Record<string, string> = {
  CREATED: 'Đang tạo link thanh toán…',
  PENDING: 'Chờ bạn thanh toán',
  SUCCEEDED: 'Quỹ đã nhận tiền',
  FAILED: 'Thanh toán không thành công',
  EXPIRED: 'Link thanh toán đã hết hạn',
};
export function payosStatusLabel(status: string, needsReconciliation: boolean): string {
  if (needsReconciliation && status !== 'SUCCEEDED') return 'Đang đối chiếu với ngân hàng';
  return LABELS[status] ?? 'Đang đối chiếu thanh toán';
}
