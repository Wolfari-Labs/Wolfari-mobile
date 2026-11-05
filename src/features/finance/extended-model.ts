import type { Contribution, Fund, PaymentInstruction } from './types';
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
export function contributionActions(
  c: Contribution,
  fund: Fund,
  userId: string,
  owner: boolean,
  writable: boolean,
) {
  if (!writable || fund.status !== 'OPEN') return [];
  const actions: string[] = [];
  if (c.status === 'PENDING') {
    if (c.member_user_id === userId) actions.push('instruction', 'report-transfer', 'payment');
    if (owner) actions.push('edit', 'waive', 'cancel');
  }
  if (c.status === 'TRANSFER_REPORTED' && fund.holder_user_id === userId)
    actions.push('confirm-received', 'reject-transfer');
  if (c.status === 'CONFIRMED' && fund.holder_user_id === userId) actions.push('reverse');
  return actions;
}
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
