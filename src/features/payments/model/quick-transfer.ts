/**
 * Scan → check → open the bank app → record the expense (fund holder's "chi nhanh").
 * Pure helpers; the screen keeps the steps and the server writes go through the trip operation.
 */
import { bankDisplayName } from '../../finance/bank-names.ts';
import { AUTOFILL_BANK_APPS, OPEN_ONLY_BANK_APPS } from '../../finance/extended-model.ts';
import type { ExpenseInput } from '../../finance/types';
import type { PaymentTransfer } from './payment-transfer';

export type BankApp = { id: string; name: string; autofill: boolean; logo?: string; fallbackLogo?: string };
const brand: Record<string, string> = { cake: 'Cake', timo: 'Timo' };
/** App icon published with the VietQR deeplink list (https://api.vietqr.io/v2/android-app-deeplinks). */
const logo = (id: string) => `https://cdn.vietqr.io/bank-app-icon/${id}-android.webp`;
/** VietQR's bank list logo, used when the app icon is missing. */
const fallbackLogo = (id: string) => `https://cdn.vietqr.io/img/${id.toUpperCase()}.png`;
export const BANK_APPS: readonly BankApp[] = [
  ...AUTOFILL_BANK_APPS.map(app => ({ id: app.id, name: brand[app.id] ?? app.name, autofill: true, logo: logo(app.id), fallbackLogo: fallbackLogo(app.id) })),
  ...OPEN_ONLY_BANK_APPS.map(app => ({ id: app.id, name: brand[app.id] ?? app.name, autofill: false, logo: logo(app.id), fallbackLogo: fallbackLogo(app.id) })),
];
export const bankApp = (id?: string | null) => BANK_APPS.find(app => app.id === id);
/** "VietinBank" from "VietinBank · Công thương": the short brand for buttons. */
export const shortBankName = (name: string) => name.split(' · ')[0]!;

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '000' | 'back';
export const MAX_AMOUNT_DIGITS = 11; // 99.999.999.999 ₫

/** Amount typed on the on-screen keypad, as plain digits without leading zeros. */
export function pressKey(amount: string, key: KeypadKey): string {
  if (key === 'back') return amount.slice(0, -1);
  const next = (amount + key).replace(/^0+/, '');
  return next.length > MAX_AMOUNT_DIGITS ? amount : next;
}

export function amountLabel(amount: string) {
  return `${(amount || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;
}

/** "Lê Thái Bình" → "LB"; an unnamed QR falls back to the bank's first letters. */
export function initials(name?: string) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return (words.length === 1 ? words[0]!.slice(0, 2) : `${words[0]![0]}${words.at(-1)![0]}`).toUpperCase();
}

/**
 * The expense saved before the bank app opens. It stays a draft (fund unchanged) until the holder
 * says the transfer went through; the description keeps where the money went and how.
 */
export function quickExpense(transfer: PaymentTransfer, category: string, app: BankApp, now: string): ExpenseInput {
  const recipient = transfer.recipientLabel?.trim();
  const title = (transfer.note.trim() || (recipient ? `Chuyển khoản cho ${recipient}` : 'Chuyển khoản')).slice(0, 200);
  const description = [
    `Người nhận: ${recipient || 'không có tên trong QR'}`,
    `Tài khoản: ${transfer.account} · ${shortBankName(bankDisplayName(transfer.bankBin))}`,
    `Chuyển qua: ${shortBankName(app.name)}`,
  ].join('\n');
  return { title, amount: transfer.amount, category: category || null, description, paid_at: now, payment_method: 'BANK_TRANSFER' };
}
