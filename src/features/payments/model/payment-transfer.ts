import { bankAppDeeplink } from '../../finance/extended-model.ts';
import { resolveVietQrBank } from '../../finance/vietqr-banks.ts';
import type { PaymentQr } from './payment-qr';

export type PaymentTransfer = PaymentQr & { amount: string; note: string };

export function paymentTransfer(payment: PaymentQr, amount: string, note: string): PaymentTransfer {
  const rawAmount = amount.trim();
  if (!/^\d{1,13}$/.test(rawAmount) || BigInt(rawAmount) <= 0n)
    throw new Error('Nhập số tiền VND nguyên lớn hơn 0, chỉ gồm chữ số và tối đa 13 chữ số.');
  const content = note.trim();
  if (!content || [...content].length > 150 || /[\u0000-\u001f\u007f]/.test(content))
    throw new Error('Nhập nội dung chuyển khoản từ 1 đến 150 ký tự, trên một dòng.');
  return { ...payment, amount: BigInt(rawAmount).toString(), note: content };
}

export function scannedBankDeeplink(transfer: PaymentTransfer, appId: string): string {
  const bank = resolveVietQrBank(transfer.bankBin);
  if (!bank) throw new Error('Chưa nhận diện được ngân hàng nhận. Hãy chuyển bằng ứng dụng ngân hàng và đối chiếu thông tin.');
  const checked = paymentTransfer(transfer, transfer.amount, transfer.note);
  return bankAppDeeplink({ environment: 'LIVE', bank_code: bank.code, account_number: checked.account,
    amount: checked.amount, reference: checked.note, recipient_name: checked.recipientLabel ?? '' }, appId, 'wolfarimobile://');
}

export function sandboxAmount(amount: string): string {
  if (!/^[1-9]\d{0,7}$/.test(amount) || BigInt(amount) < 1000n || BigInt(amount) > 50000000n)
    throw new Error('Để thử MoMo Sandbox, nhập số tiền từ 1.000 đến 50.000.000 ₫.');
  return amount;
}
