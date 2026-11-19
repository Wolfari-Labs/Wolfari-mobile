import type { PaymentInstruction } from './types';
import { parsePaymentQr } from '../payments/model/payment-qr.ts';
import { bankDisplayName } from './bank-names.ts';
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
// Plain QR SVG as Finance renders it: one background rect and one path, nothing else.
const QR_SVG =
  /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 \d+ \d+" shape-rendering="crispEdges" role="img" aria-label="[A-Za-z0-9 ]*"><rect width="\d+" height="\d+" fill="#ffffff"\/><path d="(?:M\d+ \d+h\d+v1h-\d+z)+" fill="#000000"\/><\/svg>$/;
/**
 * Data URI of the server-rendered VietQR. Published only when the NAPAS payload (checked by the same
 * reader the scanner uses, CRC included) carries exactly this instruction's bank, account, amount and
 * transfer content, and the SVG is the plain shape Finance produces.
 */
export function instructionQrImage(instruction: PaymentInstruction): string {
  const parsed = parsePaymentQr(instruction.qr_payload);
  if (
    instruction.environment !== 'LIVE' ||
    !parsed.ok ||
    parsed.payment.bankBin !== instruction.bank_bin ||
    parsed.payment.account !== instruction.account_number ||
    parsed.payment.amount !== instruction.amount ||
    parsed.payment.note !== instruction.reference ||
    instruction.qr_svg.length > 65536 ||
    !QR_SVG.test(instruction.qr_svg)
  )
    throw Error('Mã QR không khớp hướng dẫn chuyển khoản.');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(instruction.qr_svg)}`;
}
/**
 * Bank apps that a VietQR deeplink opens with account, amount and note pre-filled
 * (autofill=1 in both https://api.vietqr.io/v2/android-app-deeplinks and
 * .../ios-app-deeplinks, checked 2026-11-10). Other apps only open, without the transfer.
 */
export const AUTOFILL_BANK_APPS: readonly { id: string; name: string }[] = [
  { id: 'mb', name: bankDisplayName('MB') },
  { id: 'icb', name: bankDisplayName('ICB') },
  { id: 'bidv', name: bankDisplayName('BIDV') },
  { id: 'acb', name: bankDisplayName('ACB') },
  { id: 'ocb', name: bankDisplayName('OCB') },
];
/** https://dl.vietqr.io/pay deeplink for this instruction. The user still confirms in the bank app. */
export function bankAppDeeplink(instruction: Pick<PaymentInstruction, 'environment' | 'bank_code' | 'account_number' | 'amount' | 'reference' | 'recipient_name'>, appId: string, returnUrl: string): string {
  const bank = instruction.bank_code.trim().toLowerCase();
  if (
    instruction.environment !== 'LIVE' ||
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
