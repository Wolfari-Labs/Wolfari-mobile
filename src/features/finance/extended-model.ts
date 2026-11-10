import type { PaymentInstruction } from './types';
export type { Page, Fund, Destination, Contribution, ContributionRequest, Expense, Refund, FinancialNote, Transaction as LedgerEntry, AuditEntry, Closure, PaymentInstruction, PaymentAttempt, PaymentException, FinanceCollections } from './types';

// Extended forms use money as a parser; the primary model's money formats labels.
export function money(value: string, positive = true): string {
  const clean = value.trim();
  if (
    !/^\d{1,19}$/.test(clean) ||
    BigInt(clean) > 9223372036854775807n ||
    (positive && BigInt(clean) === 0n)
  )
    throw Error('Nhập số tiền VND nguyên hợp lệ, không có dấu chấm/phẩy.');
  return BigInt(clean).toString();
}
export function moneyLabel(value: string | null): string {
  return value === null
    ? 'Chưa đặt'
    : `${money(value, false).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ₫`;
}
export function required(value: string, max = 1024): string {
  const text = value.trim();
  if (!text || text.includes('\0') || [...text].length > max)
    throw Error(`Vui lòng nhập nội dung (tối đa ${max} ký tự).`);
  return text;
}
export const statusLabel: Record<string, string> = {
  OPEN: 'Đang mở',
  CLOSING: 'Đang chốt',
  PENDING_CONFIRMATIONS: 'Chờ thành viên xác nhận',
  CLOSED: 'Đã đóng',
  PENDING: 'Chờ xử lý',
  TRANSFER_REPORTED: 'Đã báo chuyển',
  CONFIRMED: 'Đã xác nhận',
  WAIVED: 'Được miễn',
  CANCELLED: 'Đã hủy',
  REVERSED: 'Đã đảo bút toán',
  DRAFT: 'Nháp',
  SUBMITTED: 'Chờ duyệt',
  REJECTED: 'Đã từ chối',
  HOLDER_REPORTED: 'Người giữ quỹ đã báo trả',
  COMPLETED: 'Hoàn tất',
  ACTIVE: 'Đang theo dõi',
  PAUSED: 'Tạm dừng',
  EXPIRED: 'Hết hạn',
  STOPPED: 'Đã dừng',
};
export function instructionQrUrl(instruction: PaymentInstruction): string {
  const url = new URL(instruction.qr_url);
  const expected = `/image/${instruction.bank_bin}-${instruction.account_number}-compact2.svg`;
  if (
    instruction.environment !== 'TEST' ||
    url.protocol !== 'https:' ||
    url.hostname !== 'img.vietqr.io' ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    url.pathname !== expected ||
    url.searchParams.get('amount') !== instruction.amount ||
    url.searchParams.get('addInfo') !== instruction.reference ||
    url.searchParams.get('accountName') !== instruction.recipient_name ||
    [...url.searchParams.keys()].length !== 3
  )
    throw Error('Liên kết QR không khớp hướng dẫn chuyển khoản TEST.');
  return url.href;
}
/**
 * Bank apps that a VietQR deeplink opens with account, amount and note pre-filled
 * (autofill=1 in both https://api.vietqr.io/v2/android-app-deeplinks and
 * .../ios-app-deeplinks, checked 2026-11-10). Other apps only open, without the transfer.
 */
export const AUTOFILL_BANK_APPS: readonly { id: string; name: string }[] = [
  { id: 'mb', name: 'MB Bank' },
  { id: 'icb', name: 'VietinBank' },
  { id: 'bidv', name: 'BIDV' },
  { id: 'acb', name: 'ACB' },
  { id: 'ocb', name: 'OCB' },
];
/** https://dl.vietqr.io/pay deeplink for this TEST instruction. The user still confirms in the bank app. */
export function bankAppDeeplink(instruction: PaymentInstruction, appId: string, returnUrl: string): string {
  const bank = instruction.bank_code.trim().toLowerCase();
  if (
    instruction.environment !== 'TEST' ||
    !AUTOFILL_BANK_APPS.some(app => app.id === appId) ||
    !/^[a-z0-9]{1,20}$/.test(bank) ||
    !/^[A-Za-z0-9]{1,19}$/.test(instruction.account_number) ||
    !/^[1-9]\d{0,12}$/.test(instruction.amount) ||
    !instruction.reference.trim()
  )
    throw Error('Không tạo được liên kết mở app ngân hàng cho chỉ dẫn này.');
  const params = new URLSearchParams({
    app: appId,
    ba: `${instruction.account_number}@${bank}`,
    am: instruction.amount,
    tn: instruction.reference,
    url: returnUrl,
  });
  if (instruction.recipient_name.trim()) params.set('bn', instruction.recipient_name.trim());
  return `https://dl.vietqr.io/pay?${params}`;
}
export function sandboxPaymentUrl(raw: string): string {
  const url = new URL(raw);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'test-payment.momo.vn' ||
    url.username ||
    url.password ||
    url.port
  )
    throw Error('Liên kết thanh toán không thuộc MoMo Sandbox.');
  return url.href;
}
