import { ApiError, type ApiClient } from '../../shared/api/api-client.ts';
import { sandboxPaymentUrl } from '../finance/extended-model.ts';
import { sandboxAmount } from './model/payment-transfer.ts';

export type QrSandboxInput = { request_id: string; amount: string; note: string };
export type QrSandboxCheckout = {
  request_id: string; order_id: string; amount: string; payment_url: string; environment: 'SANDBOX';
};

export function createPaymentsApi(client: Pick<ApiClient, 'request'>) {
  return {
    async sandboxCheckout(tripId: string, input: QrSandboxInput, signal?: AbortSignal): Promise<QrSandboxCheckout> {
      sandboxAmount(input.amount);
      const row = await client.request<QrSandboxCheckout>(`/trips/${encodeURIComponent(tripId)}/qr-payments/momo-sandbox`, {
        method: 'POST', body: input, signal, headers: { 'Idempotency-Key': input.request_id }, timeoutMs: 40_000,
      });
      if (!row || row.environment !== 'SANDBOX' || row.request_id !== input.request_id || row.amount !== input.amount ||
        typeof row.order_id !== 'string' || !/^wqr-[a-f0-9]{40}$/.test(row.order_id) || typeof row.payment_url !== 'string')
        throw new ApiError('INVALID_RESPONSE', 'Phản hồi MoMo Sandbox không khớp lần thử.');
      return { ...row, payment_url: sandboxPaymentUrl(row.payment_url) };
    },
  };
}
