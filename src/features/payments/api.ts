import { ApiError, type ApiClient } from '../../shared/api/api-client.ts';
import { sandboxPaymentUrl } from '../finance/extended-model.ts';
import { sandboxAmount } from './model/payment-transfer.ts';

export type QrSandboxInput = { request_id: string; amount: string; note: string };
export type QrSandboxCheckout = {
  request_id: string; order_id: string; amount: string; payment_url: string; environment: 'SANDBOX';
};

export type WalletCheckoutInput = QrSandboxInput & { redirect_url: string };
export type WalletCheckout = { request_id: string; order_id: string; amount: string; payment_url: string; environment: 'SANDBOX' };
export type WalletStatus = { order_id: string; status: 'PAID' | 'PENDING' | 'FAILED'; amount: string; provider_transaction_id: string | null; environment: 'SANDBOX' };
const WALLET_ORDER = /^\d{6}_w[a-f0-9]{24}$/;
/** Sandbox wallets that send the browser back to the app and report paid/unpaid themselves. */
export type SandboxWallet = 'momo';
const WALLET_PATH: Record<SandboxWallet, string> = { momo: 'momo-checkout' };
const WALLET_HOST: Record<SandboxWallet, (host: string) => boolean> = {
  momo: host => host === 'test-payment.momo.vn',
};

/** Base64url of an ASCII app link, for the Gateway page the wallet returns the browser to. */
export function paymentReturnPage(apiBaseUrl: string, appLink: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const bytes = [...appLink].map(char => {
    const code = char.charCodeAt(0);
    if (code > 0x7e || code < 0x20) throw new Error('App link must be ASCII');
    return code;
  });
  let token = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = bytes.slice(i, i + 3), n = (a << 16) | (b << 8) | c;
    token += alphabet[(n >> 18) & 63] + alphabet[(n >> 12) & 63] + (i + 1 < bytes.length ? alphabet[(n >> 6) & 63] : '') + (i + 2 < bytes.length ? alphabet[n & 63] : '');
  }
  return `${apiBaseUrl.replace(/\/+$/, '')}/qr-payments/payment-return/${token}`;
}

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
    /** Sandbox wallet (MoMo test gateway) order for a QR payment; the browser comes back through the Gateway page. */
    async walletCheckout(wallet: SandboxWallet, tripId: string, input: WalletCheckoutInput, signal?: AbortSignal): Promise<WalletCheckout> {
      sandboxAmount(input.amount);
      const row = await client.request<WalletCheckout>(`/trips/${encodeURIComponent(tripId)}/qr-payments/${WALLET_PATH[wallet]}`, {
        method: 'POST', body: input, signal, headers: { 'Idempotency-Key': input.request_id }, timeoutMs: 40_000,
      });
      if (!row || row.environment !== 'SANDBOX' || row.request_id !== input.request_id || row.amount !== input.amount ||
        typeof row.order_id !== 'string' || !WALLET_ORDER.test(row.order_id) || typeof row.payment_url !== 'string')
        throw new ApiError('INVALID_RESPONSE', 'Phản hồi ví thử không khớp lần thử.');
      const link = new URL(row.payment_url);
      if (link.protocol !== 'https:' || !WALLET_HOST[wallet](link.hostname)) throw new ApiError('INVALID_RESPONSE', 'Link thanh toán không thuộc ví đã chọn.');
      return row;
    },
    async walletStatus(wallet: SandboxWallet, tripId: string, orderId: string, signal?: AbortSignal): Promise<WalletStatus> {
      if (!WALLET_ORDER.test(orderId)) throw new ApiError('VALIDATION_FAILED', 'Mã đơn thanh toán không hợp lệ.');
      const row = await client.request<WalletStatus>(`/trips/${encodeURIComponent(tripId)}/qr-payments/${WALLET_PATH[wallet]}/${orderId}`, { signal, timeoutMs: 40_000 });
      if (!row || row.order_id !== orderId || !['PAID', 'PENDING', 'FAILED'].includes(row.status))
        throw new ApiError('INVALID_RESPONSE', 'Phản hồi ví thử không khớp đơn.');
      return row;
    },
  };
}
