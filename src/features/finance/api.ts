import type { ApiClient } from "../../shared/api/api-client";
import type { OperationCommand } from "../../shared/operations/controller";
import type { Closure, Destination, DestinationInput, ExpenseInput, FinanceCollections, FinancePage, Fund, PaymentInstruction, Receipt, WriteResult } from "./types";

const id = encodeURIComponent;
type Versioned = { id: string; version: number };
const versions = (fund: Fund, row?: Versioned) => ({ expected_finance_version: fund.finance_version, ...(row ? { expected_version: row.version } : {}) });
function command(title: string, path: string, body: Record<string, unknown>, method: OperationCommand["method"] = "POST"): OperationCommand {
  return { kind: "finance", title, path, method, body };
}
// All callers supply a snapshot. Retry must keep this entire command unchanged.
export const financeCommands = {
  enable: (tripId: string, holder_user_id: string, destination: DestinationInput, budget_amount?: string) =>
    command("Mở quỹ nhóm", `/trips/${id(tripId)}/fund`, { holder_user_id, currency: "VND", destination, ...(budget_amount !== undefined ? { budget_amount } : {}) }),
  budget: (fund: Fund, budget_amount: string | null) => command("Cập nhật ngân sách", `/funds/${id(fund.id)}/budget`, { budget_amount, ...versions(fund) }, "PATCH"),
  destination: (fund: Fund, input: Partial<DestinationInput>, row?: Destination) => command(row ? "Sửa tài khoản nhận" : "Thêm tài khoản nhận", `/funds/${id(fund.id)}/destinations${row ? `/${id(row.id)}` : ""}`, { ...input, ...versions(fund, row) }, row ? "PATCH" : "POST"),
  confirmDestination: (fund: Fund, row: Destination) => command("Xác nhận tài khoản nhận", `/funds/${id(fund.id)}/destinations/${id(row.id)}/confirm`, versions(fund, row)),
  contributionRequest: (fund: Fund, input: { title: string; contributions: { member_user_id: string; destination_id: string; amount: string }[]; due_at?: string; note?: string }) =>
    command("Tạo yêu cầu đóng góp", `/funds/${id(fund.id)}/contribution-requests`, { ...input, ...versions(fund) }),
  contribution: (fund: Fund, row: Versioned, action: "amount" | "report-transfer" | "confirm-received" | "reject-transfer" | "waive" | "cancel" | "reverse", input: { amount?: string; reason?: string; evidence_object_key?: string } = {}) =>
    command("Cập nhật đóng góp", `/contributions/${id(row.id)}${action === "amount" ? "" : `/${action}`}`, { ...input, ...versions(fund, row) }, action === "amount" ? "PATCH" : "POST"),
  expense: (fund: Fund, input: ExpenseInput, row?: Versioned) => command(row ? "Sửa khoản chi" : "Tạo khoản chi", row ? `/expenses/${id(row.id)}` : `/funds/${id(fund.id)}/expenses`, { ...input, ...versions(fund, row) }, row ? "PATCH" : "POST"),
  expenseAction: (fund: Fund, row: Versioned, action: "delete" | "submit" | "withdraw" | "confirm" | "reject" | "reverse", input: { reason?: string; paid_at?: string; payment_method?: string } = {}) =>
    command("Cập nhật khoản chi", `/expenses/${id(row.id)}${action === "delete" ? "" : `/${action}`}`, { ...input, ...versions(fund, row) }, action === "delete" ? "DELETE" : "POST"),
  refund: (fund: Fund, input: { member_user_id: string; amount: string; reason: string }) => command("Tạo hoàn tiền", `/funds/${id(fund.id)}/refunds`, { ...input, ...versions(fund) }),
  refundAction: (fund: Fund, row: Versioned, action: "report-paid" | "confirm-received" | "confirm-nonreceipt" | "cancel" | "request-reversal" | "consent-reversal" | "reverse", reason?: string) =>
    command("Cập nhật hoàn tiền", `/refunds/${id(row.id)}/${action}`, { ...(reason !== undefined ? { reason } : {}), ...versions(fund, row) }),
  closure: (fund: Fund) => command("Yêu cầu đóng quỹ", `/funds/${id(fund.id)}/closures`, versions(fund)),
  closureAction: (row: Closure, action: "confirm" | "cancel" | "remind", reason?: string) => command("Cập nhật đóng quỹ", `/closures/${id(row.id)}/${action}`, action === "confirm" ? { snapshot_hash: row.snapshot_hash } : action === "cancel" ? { reason } : {}),
};

export function createFinanceApi(client: ApiClient) {
  return {
    fund: (tripId: string, signal?: AbortSignal) => client.request<Fund>(`/trips/${id(tripId)}/fund`, { signal }),
    destinations: (fundId: string, signal?: AbortSignal) => client.request<Destination[]>(`/funds/${id(fundId)}/destinations`, { signal }),
    list: <K extends keyof FinanceCollections>(fundId: string, collection: K, cursor?: string, signal?: AbortSignal): Promise<FinancePage<K>> => {
      const query = new URLSearchParams({ limit: "20", ...(cursor ? { cursor } : {}) });
      return client.request<FinancePage<K>>(`/funds/${id(fundId)}/${collection}?${query}`, { signal });
    },
    closure: (closureId: string, signal?: AbortSignal) => client.request<Closure>(`/closures/${id(closureId)}`, { signal }),
    instruction: (contributionId: string, signal?: AbortSignal) => client.request<PaymentInstruction>(`/contributions/${id(contributionId)}/vietqr`, { signal }),
    uploadReceipt: (fundId: string, body: FormData) => client.request<Receipt>(`/funds/${id(fundId)}/receipts`, { method: "POST", body }),
    downloadReceipt: (fundId: string, objectKey: string, signal?: AbortSignal) => client.request<Blob>(`/funds/${id(fundId)}/receipts/download?${new URLSearchParams({ object_key: objectKey })}`, { responseType: "blob", signal }),
    execute: (input: OperationCommand, key: string) => client.request<WriteResult>(input.path, { method: input.method, body: input.body, headers: { "Idempotency-Key": key } }),
  };
}
