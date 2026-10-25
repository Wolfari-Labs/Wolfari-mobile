// Published interoperability vectors from the upstream generator's own tests:
// https://github.com/subiz/vietqr/blob/master/vietqr_test.go
// Test data only. These accounts must never be used to send real payments.
export const staticQr = "00020101021138540010A00000072701240006970423011000999999990208QRIBFTTA53037045802VN6304CBB4";
export const dynamicQr = "00020101021238570010A00000072701270006970403011300110123456780208QRIBFTTA530370454061800005802VN62340107NPS68690819thanh toan don hang63042E2E";

export const tlv = (id, value) => id + String(value.length).padStart(2, "0") + value;
export function withChecksum(body) {
  const input = body + "6304";
  let crc = 0xffff;
  for (const byte of Buffer.from(input, "utf8")) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff;
  }
  return input + crc.toString(16).toUpperCase().padStart(4, "0");
}

export function makeQr({ account = "000123456789", bin = "970436", service = "QRIBFTTA", currency = "704", country = "VN", amount, note, recipient, extra = "", providerExtra = "", accountExtra = "", fields = "" } = {}) {
  const beneficiary = tlv("00", bin) + tlv("01", account) + accountExtra;
  const provider = tlv("00", "A000000727") + tlv("01", beneficiary) + tlv("02", service) + providerExtra;
  return withChecksum(
    "000201010211" + tlv("38", provider) + tlv("53", currency) + (amount !== undefined ? tlv("54", amount) : "") + tlv("58", country)
    + (recipient ? tlv("59", recipient) : "")
    + (note !== undefined || extra ? tlv("62", (note !== undefined ? tlv("08", note) : "") + extra) : "") + fields,
  );
}
