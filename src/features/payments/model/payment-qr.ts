// Local-only reader for NAPAS VietQR account transfers (QRIBFTTA).
// CRC detects damaged payloads; it does NOT authenticate a recipient or a payment.
export const MAX_PAYMENT_QR_LENGTH = 2048;

export type PaymentQr = {
  bankBin: string;
  account: string;
  recipientLabel?: string;
  amount?: string;
  note?: string;
  reference?: string;
  billNumber?: string;
};

export type PaymentQrResult =
  | { ok: true; payment: PaymentQr }
  | { ok: false; message: string };

const invalid = "Mã QR bị lỗi hoặc thiếu thông tin chuyển khoản. Hãy quét lại mã đầy đủ.";
const unsupported = "Chỉ hỗ trợ VietQR chuyển khoản đến tài khoản bằng VND. QR liên kết, ví điện tử, thanh toán cửa hàng hoặc chuyển đến thẻ chưa được hỗ trợ.";

function readFields(value: string): Map<string, string> {
  const fields = new Map<string, string>();
  let offset = 0;
  while (offset < value.length) {
    const header = value.slice(offset, offset + 4);
    if (!/^\d{4}$/.test(header)) throw new Error(invalid);
    const id = header.slice(0, 2);
    const length = Number(header.slice(2));
    offset += 4;
    if (!length || offset + length > value.length || fields.has(id)) throw new Error(invalid);
    fields.set(id, value.slice(offset, offset + length));
    offset += length;
  }
  return fields;
}

function crc16(value: string): string {
  let crc = 0xffff;
  // This reader intentionally accepts printable ASCII only, so bytes = code units.
  for (let index = 0; index < value.length; index++) {
    crc ^= value.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function parsePaymentQr(input: string): PaymentQrResult {
  if (input.length > MAX_PAYMENT_QR_LENGTH) return { ok: false, message: invalid };
  const value = input.trim();
  if (!value.startsWith("000201")) return { ok: false, message: unsupported };
  // Never normalize data inside a QR: changing account/amount/text could change its meaning.
  if (!/^[\x20-\x7e]+$/.test(value)) {
    return { ok: false, message: "QR chứa ký tự chưa được hỗ trợ. Hãy quét trực tiếp bằng ứng dụng ngân hàng." };
  }
  try {
    const fields = readFields(value);
    if (!/6304[\dA-Fa-f]{4}$/.test(value) || fields.get("63")?.toUpperCase() !== crc16(value.slice(0, -4))) {
      return { ok: false, message: "Mã kiểm tra QR không khớp. Không sử dụng thông tin này; hãy quét lại hoặc xin mã mới." };
    }
    const method = fields.get("01");
    if (fields.get("00") !== "01" || (method !== undefined && method !== "11" && method !== "12")) throw new Error(invalid);
    if (fields.get("53") !== "704" || fields.get("58") !== "VN" || !fields.has("38")) {
      return { ok: false, message: unsupported };
    }
    const provider = readFields(fields.get("38")!);
    if (provider.get("00") !== "A000000727" || provider.get("02") !== "QRIBFTTA") {
      return { ok: false, message: unsupported };
    }
    // Do not silently discard fees or another payment network's instructions.
    if ([...fields.keys()].some(id => (Number(id) >= 2 && Number(id) <= 51 && id !== "38") || ["55", "56", "57"].includes(id))) {
      return { ok: false, message: "QR có hướng dẫn thanh toán bổ sung. Hãy quét trực tiếp bằng ứng dụng ngân hàng để kiểm tra đầy đủ." };
    }
    const accountFields = readFields(provider.get("01") ?? "");
    const bankBin = accountFields.get("00") ?? "";
    const account = accountFields.get("01") ?? "";
    if (!/^\d{6}$/.test(bankBin) || !/^[A-Za-z0-9]{1,19}$/.test(account)) throw new Error(invalid);
    const encodedAmount = fields.get("54");
    let amount: string | undefined;
    if (encodedAmount !== undefined) {
      // VND whole units only. Never round or parse scientific notation/separators.
      if (encodedAmount.length > 13 || !/^\d+(?:\.0{1,2})?$/.test(encodedAmount) || Number(encodedAmount) <= 0) {
        return { ok: false, message: "Số tiền trong QR không hợp lệ hoặc không phải số nguyên VND. Hãy kiểm tra bằng ứng dụng ngân hàng." };
      }
      amount = String(Number(encodedAmount));
    }
    const extra = readFields(fields.get("62") ?? "");
    if (extra.has("09") || [...extra.values()].some(text => text === "***")) {
      return { ok: false, message: "QR yêu cầu thêm thông tin người trả tiền. Hãy tiếp tục bằng ứng dụng ngân hàng." };
    }
    return {
      ok: true,
      payment: {
        bankBin, account, amount,
        recipientLabel: fields.get("59"),
        note: extra.get("08"),
        reference: extra.get("05"),
        billNumber: extra.get("01"),
      },
    };
  } catch {
    return { ok: false, message: invalid };
  }
}
