export type Page<T> = { items: T[]; next_cursor: string | null };
export type Fund = {
  id: string;
  trip_id: string;
  holder_user_id: string;
  currency: 'VND';
  budget_amount: string | null;
  current_balance: string;
  reserved_refund: string;
  available_balance: string;
  status: 'OPEN' | 'CLOSING' | 'CLOSED';
  finance_version: number;
  closed_at: string | null;
};
export type Versioned = { id: string; fund_id: string; version: number; finance_version: number };
export type Destination = {
  id: string;
  fund_id: string;
  destination_type: 'VIETQR' | 'MOMO_SANDBOX';
  active: boolean;
  is_default: boolean;
  version: number;
  confirmed_by_holder_at: string | null;
  bank_code?: string;
  account_number?: string;
  account_name?: string;
  momo_phone?: string;
};
export type Contribution = Versioned & {
  request_id: string;
  member_user_id: string;
  amount: string;
  status: 'PENDING' | 'TRANSFER_REPORTED' | 'CONFIRMED' | 'WAIVED' | 'CANCELLED' | 'REVERSED';
  self_contribution: boolean;
  rejected_reason: string | null;
};
export type ContributionRequest = Versioned & {
  title: string;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  due_at: string | null;
  note: string | null;
  contributions: Contribution[];
};
export type Expense = Versioned & {
  title: string;
  description: string | null;
  amount: string;
  category: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'CONFIRMED' | 'REJECTED' | 'REVERSED';
  created_by_user_id: string;
  receipt_available: boolean;
  paid_at: string | null;
  payment_method: string | null;
  rejected_reason: string | null;
};
export type Refund = Versioned & {
  member_user_id: string;
  amount: string;
  reason: string;
  status: 'PENDING' | 'HOLDER_REPORTED' | 'CONFIRMED' | 'CANCELLED' | 'REVERSED';
  nonreceipt_confirmed_at: string | null;
  reversal_requested_at: string | null;
  reversal_consented_at: string | null;
};
export type FinancialNote = Versioned & {
  description: string;
  amount: string | null;
  payer_user_id: string | null;
  created_by_user_id: string;
};
export type LedgerEntry = {
  id: string;
  fund_id: string;
  sequence: string;
  direction: 'IN' | 'OUT';
  transaction_type: string;
  amount: string;
  balance_after: string;
  created_at: string;
  reason: string | null;
};
export type AuditEntry = {
  id: string;
  fund_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_user_id: string | null;
  from_version: number | null;
  to_version: number | null;
  reason: string | null;
  occurred_at: string;
};
export type Closure = {
  id: string;
  fund_id: string;
  status: 'PENDING_CONFIRMATIONS' | 'COMPLETED' | 'CANCELLED';
  snapshot_hash: string;
  snapshot_finance_version: number;
  snapshot: {
    fund: Pick<Fund, 'current_balance' | 'budget_amount'>;
    required_user_ids: string[];
    ledger: LedgerEntry[];
    contributions: Contribution[];
    expenses: Expense[];
    refunds: Refund[];
    financial_notes: FinancialNote[];
    contribution_requests: ContributionRequest[];
  };
  confirmations: { user_id: string; confirmed_at: string | null }[];
};
export type PaymentInstruction = {
  contribution_id: string;
  amount: string;
  currency: 'VND';
  reference: string;
  recipient_name: string;
  bank_code: string;
  bank_bin: string;
  account_number: string;
  environment: 'TEST';
  warning: string;
  qr_url: string;
};
export type PaymentAttempt = {
  id: string;
  contribution_id: string;
  provider: 'MOMO_SANDBOX';
  environment: 'SANDBOX';
  amount: string;
  currency: 'VND';
  status: string;
  payment_url: string | null;
  needs_reconciliation: boolean;
  error_code: string | null;
  expires_at: string | null;
};
export type PaymentException = {
  id: string;
  payment_attempt_id: string | null;
  processing_status: string;
  review_reason: string | null;
  received_at: string;
  reviewed_at: string | null;
};
export type FinanceCollections = {
  'contribution-requests': ContributionRequest;
  contributions: Contribution;
  expenses: Expense;
  refunds: Refund;
  notes: FinancialNote;
  transactions: LedgerEntry;
  history: AuditEntry;
  closures: Closure;
  'payment-exceptions': PaymentException;
};

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
