import { ApiError, type ApiClient, type RequestOptions } from '../../shared/api/api-client.ts';
import type {
  Destination,
  FinanceCollections,
  Fund,
  Page,
  PaymentAttempt,
  PaymentInstruction,
} from './model.ts';

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ApiError('INVALID_RESPONSE', 'Dữ liệu máy chủ không hợp lệ.');
  return value as Record<string, unknown>;
}
export function validateMoney(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    !/^(0|[1-9]\d{0,18})$/.test(value) ||
    BigInt(value) > 9223372036854775807n
  )
    throw new ApiError('INVALID_RESPONSE', 'Số tiền từ máy chủ không hợp lệ.');
}
export function decodeRow<T>(value: unknown, scope?: { field: string; id: string }): T {
  const r = object(value);
  if (typeof r.id !== 'string' || (scope && r[scope.field] !== scope.id))
    throw new ApiError('INVALID_RESPONSE', 'Phản hồi không đúng chuyến đi/quỹ.');
  for (const field of [
    'amount',
    'current_balance',
    'reserved_refund',
    'available_balance',
    'budget_amount',
    'balance_after',
    'threshold_price',
    'price',
  ]) {
    if (r[field] !== undefined && r[field] !== null) validateMoney(r[field]);
  }
  for (const field of ['version', 'finance_version'])
    if (r[field] !== undefined && (!Number.isInteger(r[field]) || Number(r[field]) < 1))
      throw new ApiError('INVALID_RESPONSE', 'Phiên bản không hợp lệ.');
  return r as T;
}
export function decodePage<T>(value: unknown, decode: (item: unknown) => T): Page<T> {
  const r = object(value);
  if (!Array.isArray(r.items) || (r.next_cursor !== null && typeof r.next_cursor !== 'string'))
    throw new ApiError('INVALID_RESPONSE', 'Trang dữ liệu không hợp lệ.');
  return { items: r.items.map(decode), next_cursor: r.next_cursor as string | null };
}
export function decodeCollection<K extends keyof FinanceCollections>(
  value: unknown,
  kind: K,
  fundId: string,
): FinanceCollections[K] {
  const row = decodeRow<Record<string, unknown>>(
    value,
    kind === 'payment-exceptions' ? undefined : { field: 'fund_id', id: fundId },
  );
  const fail = () => {
    throw new ApiError('INVALID_RESPONSE', 'Bản ghi quỹ không đúng đặc tả.');
  };
  if (
    ['contributions', 'contribution-requests', 'expenses', 'refunds', 'notes'].includes(kind) &&
    (!Number.isInteger(row.version) || !Number.isInteger(row.finance_version))
  )
    fail();
  if (['contributions', 'expenses', 'refunds', 'transactions'].includes(kind))
    validateMoney(row.amount);
  if (kind === 'contribution-requests') {
    if (!Array.isArray(row.contributions)) fail();
    (row.contributions as unknown[]).forEach((c) => decodeCollection(c, 'contributions', fundId));
  }
  if (kind === 'closures') {
    const snap = object(row.snapshot);
    object(snap.fund);
    validateMoney(object(snap.fund).current_balance);
    if (
      ![
        'ledger',
        'contributions',
        'expenses',
        'refunds',
        'financial_notes',
        'contribution_requests',
        'required_user_ids',
      ].every((k) => Array.isArray(snap[k])) ||
      !Array.isArray(row.confirmations) ||
      typeof row.snapshot_hash !== 'string'
    )
      fail();
    (snap.ledger as unknown[]).forEach((v) => {
      const t = object(v);
      validateMoney(t.amount);
      validateMoney(t.balance_after);
    });
    (row.confirmations as unknown[]).forEach((v) => {
      const c = object(v);
      if (
        typeof c.user_id !== 'string' ||
        (c.confirmed_at !== null && typeof c.confirmed_at !== 'string')
      )
        fail();
    });
  }
  return row as FinanceCollections[K];
}
export const pageQuery = (cursor?: string | null) =>
  new URLSearchParams({ limit: '20', ...(cursor ? { cursor } : {}) });
export type WriteIntent = {
  path: string;
  method: NonNullable<RequestOptions['method']>;
  body: Record<string, unknown>;
  label: string;
  key: string;
  kind: 'finance' | 'watch';
  createdAt: string;
  attempted: boolean;
};
export function createFinanceApi(client: ApiClient) {
  const enc = encodeURIComponent;
  return {
    async fund(tripId: string, signal?: AbortSignal) {
      try {
        const row = decodeRow<Fund>(
          await client.request(`/trips/${enc(tripId)}/fund`, { signal }),
          { field: 'trip_id', id: tripId },
        );
        for (const amount of [row.current_balance, row.reserved_refund, row.available_balance])
          validateMoney(amount);
        if (
          !['OPEN', 'CLOSING', 'CLOSED'].includes(row.status) ||
          !row.holder_user_id ||
          !Number.isInteger(row.finance_version) ||
          row.currency !== 'VND'
        )
          throw new ApiError('INVALID_RESPONSE', 'Thông tin quỹ không hợp lệ.');
        return row;
      } catch (e) {
        if (e instanceof ApiError && e.status === 404 && e.code === 'RESOURCE_NOT_FOUND')
          return null;
        throw e;
      }
    },
    async destinations(fundId: string, signal?: AbortSignal) {
      const rows = await client.request<unknown>(`/funds/${enc(fundId)}/destinations`, { signal });
      if (!Array.isArray(rows))
        throw new ApiError('INVALID_RESPONSE', 'Danh sách nơi nhận tiền không hợp lệ.');
      return rows.map((row) => decodeRow<Destination>(row, { field: 'fund_id', id: fundId }));
    },
    async list<K extends keyof FinanceCollections>(
      fundId: string,
      collection: K,
      cursor?: string | null,
      signal?: AbortSignal,
    ): Promise<Page<FinanceCollections[K]>> {
      return decodePage(
        await client.request(`/funds/${enc(fundId)}/${collection}?${pageQuery(cursor)}`, {
          signal,
        }),
        (item) => decodeCollection(item, collection, fundId),
      );
    },
    async instruction(id: string) {
      const row = object(await client.request(`/contributions/${enc(id)}/vietqr`));
      validateMoney(row.amount);
      if (row.contribution_id !== id || row.environment !== 'TEST' || row.currency !== 'VND')
        throw new ApiError('INVALID_RESPONSE', 'Chỉ hỗ trợ hướng dẫn chuyển khoản TEST.');
      return row as PaymentInstruction;
    },
    async attempt(id: string) {
      return decodeRow<PaymentAttempt>(await client.request(`/payment-attempts/${enc(id)}`));
    },
    async write(intent: WriteIntent) {
      const result = await client.request<unknown>(intent.path, {
        method: intent.method,
        body: intent.body,
        headers: { 'Idempotency-Key': intent.key },
      });
      const row = object(result);
      if (row.operation_id !== undefined) {
        if (
          row.operation_id !== intent.key ||
          (!(row.accepted === true && typeof row.closure_id === 'string') &&
            !['PROCESSING', 'PENDING_RECOVERY', 'NEEDS_REVIEW', 'SUCCEEDED', 'FAILED'].includes(
              String(row.state),
            ))
        )
          throw new ApiError('INVALID_RESPONSE', 'Trạng thái xử lý không hợp lệ.');
      } else if (
        typeof row.id !== 'string' &&
        typeof row.deleted !== 'boolean' &&
        typeof row.closure_id !== 'string'
      ) {
        throw new ApiError('INVALID_RESPONSE', 'Chưa xác định được kết quả thao tác từ phản hồi.');
      }
      return result;
    },
    operation: (key: string) => client.request<unknown>(`/operations/${enc(key)}`),
  };
}
