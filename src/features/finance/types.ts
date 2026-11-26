import type { MembershipOperation, Page } from "../trips/types";
export type { Page } from "../trips/types";

// Money and ledger sequence are int64 decimal strings, never JS numbers.
export type Money = string;
export type Fund = {
  id: string; trip_id: string; holder_user_id: string; currency: "VND";
  budget_amount: Money | null; current_balance: Money; reserved_refund: Money;
  available_balance: Money; status: "OPEN" | "CLOSING" | "CLOSED";
  finance_version: number; closed_at: string | null;
};
export type DestinationInput = {
  destination_type: "VIETQR"; bank_code: string; account_number: string; account_name: string;
  active: boolean; is_default: boolean;
} | { destination_type: "MOMO_SANDBOX"; momo_phone: string; active: boolean; is_default: boolean };
export type Destination = {
  id: string; fund_id: string; destination_type: "VIETQR" | "MOMO_SANDBOX";
  active: boolean; is_default: boolean; version: number; confirmed_by_holder_at: string | null;
  bank_code?: string; account_number?: string; account_name?: string; momo_phone?: string;
};
export type Contribution = {
  id: string; request_id: string; fund_id: string; member_user_id: string; amount: Money;
  status: "PENDING" | "TRANSFER_REPORTED" | "CONFIRMED" | "WAIVED" | "CANCELLED" | "REVERSED";
  self_contribution: boolean; version: number; finance_version: number;
  member_reported_at: string | null; confirmed_at: string | null;
  confirmed_by_user_id: string | null; waived_reason: string | null; cancelled_reason: string | null;
  rejected_reason?: string | null;
  destination_type?: "VIETQR" | "MOMO_SANDBOX";
  latest_payment_attempt_id?: string;
};
export type ContributionRequest = {
  id: string; fund_id: string; title: string; status: "OPEN" | "CLOSED" | "CANCELLED";
  version: number; finance_version: number; created_by_user_id: string; created_at: string;
  due_at: string | null; note: string | null; contributions: Contribution[];
};
export type Expense = {
  id: string; fund_id: string; title: string; amount: Money; description: string | null;
  category: string | null; status: "DRAFT" | "SUBMITTED" | "CONFIRMED" | "REJECTED" | "REVERSED";
  created_by_user_id: string; receipt_available: boolean; submitted_at: string | null;
  paid_at: string | null; payment_method: string | null; paid_by_user_id: string | null;
  confirmed_at: string | null; confirmed_by_user_id: string | null; rejected_reason: string | null;
  created_at: string; updated_at: string; version: number; finance_version: number;
};
export type ExpenseInput = {
  title: string; amount: Money; description?: string | null; category?: string | null;
  receipt_object_key?: string | null; paid_at?: string | null; payment_method?: string | null;
};
export type Refund = {
  id: string; fund_id: string; member_user_id: string; amount: Money; reason: string;
  status: "PENDING" | "HOLDER_REPORTED" | "CONFIRMED" | "CANCELLED" | "REVERSED";
  holder_reported_at: string | null; confirmed_at: string | null; nonreceipt_confirmed_at: string | null;
  reversal_requested_at: string | null; reversal_consented_at: string | null;
  created_at: string; updated_at: string; version: number; finance_version: number;
  /** Optional on older Gateways: reason of the reversal request, verifier and how it was confirmed. */
  reversal_reason?: string | null; verifier_user_id?: string | null; confirmed_by_user_id?: string | null;
  confirmation_mode?: "RECIPIENT" | "OWNER" | "ASSIGNED_MEMBER" | "SELF_UNVERIFIED" | null;
  independent_verification?: boolean | null;
};
/** FR-FN06 Holder handover; the snapshot is frozen when the nominee accepts. */
export type HolderHandover = {
  id: string; fund_id: string; old_holder_user_id: string; new_holder_user_id: string; nominated_by_user_id: string;
  status: "NOMINATED" | "ACCEPTED" | "COMPLETED" | "CANCELLED";
  version: number; finance_version: number; snapshot_finance_version: number | null; snapshot_stale: boolean;
  snapshot: {
    current_balance: Money; reserved_refund: Money; available_balance: Money; ledger_sequence: Money; fingerprint: string;
    pending_contribution_ids: string[]; pending_refund_ids: string[]; pending_expense_ids: string[];
    pending_payment_ids: string[]; payment_destination_ids: string[]; pending_payment_exception_ids: string[];
  } | null;
  accepted_at: string | null; old_holder_confirmed_at: string | null; new_holder_confirmed_at: string | null;
  completed_at: string | null; cancelled_at: string | null; cancellation_reason: string | null;
  created_at: string; updated_at: string;
};
export type Transaction = {
  id: string; fund_id: string; sequence: string; direction: "IN" | "OUT";
  transaction_type: "CONTRIBUTION" | "EXPENSE" | "REFUND" | "REVERSAL";
  amount: Money; balance_after: Money; contribution_id: string | null; expense_id: string | null;
  refund_id: string | null; reversal_of_id: string | null; actor_user_id: string | null;
  reason: string | null; created_at: string;
};
export type Closure = {
  id: string; fund_id: string; status: "PENDING_CONFIRMATIONS" | "CANCELLED" | "COMPLETED";
  snapshot_hash: string; snapshot_finance_version: number; snapshot_schema_version: number;
  snapshot: {
    schema_version: number; fund: Pick<Fund, "id" | "trip_id" | "holder_user_id" | "currency" | "budget_amount" | "current_balance" | "finance_version">;
    required_user_ids: string[]; contribution_requests: Record<string, unknown>[];
    contributions: Contribution[]; expenses: Expense[];
    financial_notes: FinancialNote[]; refunds: Refund[]; ledger: Transaction[];
  };
  confirmations: { user_id: string; confirmed_at: string | null }[];
  requested_by_user_id: string; requested_at: string; cancelled_at: string | null;
  cancelled_reason: string | null; closed_at: string | null; finance_version: number;
};
export type ClosureBlockerKind =
  | "BALANCE_NOT_ZERO" | "CONTRIBUTIONS_OPEN" | "EXPENSES_OPEN" | "REFUNDS_OPEN"
  | "PAYMENTS_OPEN" | "PAYMENT_WEBHOOKS_OPEN" | "BANK_TRANSFERS_REVIEW" | "HOLDER_HANDOVER_OPEN";
export type ClosureReadiness = {
  ready: boolean; fund_status: Fund["status"]; current_balance: Money;
  blockers: { kind: ClosureBlockerKind; count: number }[];
  bank_transfers_needing_review: number;
};
export type BankTransfer = {
  id: string; provider: string; transfer_type: "IN" | "OUT"; amount: Money; content: string;
  account_number_masked: string; bank_gateway: string;
  processing_status: "MATCHED" | "UNMATCHED" | "NEEDS_REVIEW" | "IGNORED" | "RESOLVED";
  contribution_id: string | null; review_reason: string | null;
  transaction_at: string | null; received_at: string; processed_at: string | null;
  /** All set on RESOLVED rows, all null otherwise; absent on older servers. */
  resolution?: BankTransferResolution | null; resolution_note?: string | null;
  resolved_by_user_id?: string | null; resolved_at?: string | null;
};
export type BankTransferResolution = "RETURNED_TO_SENDER" | "HANDLED_IN_APP" | "NOT_OURS";
export type PaymentInstruction = {
  contribution_id: string; amount: Money; currency: "VND"; reference: string;
  recipient_name: string; bank_code: string; bank_bin: string; account_number: string;
  bank_name: string; qr_payload: string; qr_svg: string; environment: "LIVE"; warning: string;
  /** Online checkouts that pay into exactly this destination; PAYOS moves real money. */
  online_payment_providers: "PAYOS"[];
};
export type Receipt = { object_key: string; mime_type: string; size_bytes: number };
export type FinanceCollections = {
  "contribution-requests": ContributionRequest; contributions: Contribution;
  expenses: Expense; refunds: Refund; transactions: Transaction; closures: Closure;
  notes: FinancialNote; history: AuditEntry; "payment-exceptions": PaymentException;
};
export type FinancePage<K extends keyof FinanceCollections> = Page<FinanceCollections[K]>;
export type WriteResult = Fund | Destination | ContributionRequest | Contribution | Expense | Refund | Closure
  | FinancialNote | PaymentAttempt | PaymentException | MembershipOperation | { deleted: true }
  | { accepted: true; operation_id?: string; closure_id: string };

export type Versioned = { id: string; fund_id: string; version: number; finance_version: number };

export type FinancialNote = Versioned & {
  description: string;
  amount: string | null;
  payer_user_id: string | null;
  created_by_user_id: string;
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

export type PaymentAttempt = {
  id: string;
  contribution_id: string;
  /** MOMO_SANDBOX is a test wallet; PAYOS is a real VietQR payment link (LIVE). */
  provider: 'MOMO_SANDBOX' | 'PAYOS';
  environment: 'SANDBOX' | 'LIVE';
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
