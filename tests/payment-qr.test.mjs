import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { MAX_PAYMENT_QR_LENGTH, parsePaymentQr } from "../src/features/payments/model/payment-qr.ts";
import { dynamicQr, makeQr, staticQr, tlv, withChecksum } from "./fixtures/payment-qr.mjs";

const invalid = input => assert.equal(parsePaymentQr(input).ok, false, input);
const payment = input => {
  const result = parsePaymentQr(input);
  assert.equal(result.ok, true, result.message);
  return result.payment;
};

test("reads independent static and dynamic VietQR vectors, preserving leading zeroes", () => {
  const first = payment(staticQr);
  assert.equal(first.account, "0099999999");
  assert.equal(first.bankBin, "970423");
  assert.equal(first.amount, undefined);
  assert.equal(first.recipientLabel, undefined);
  const second = payment(dynamicQr);
  assert.equal(second.account, "0011012345678");
  assert.equal(second.amount, "180000");
  assert.equal(second.note, "thanh toan don hang");
  assert.equal(second.billNumber, "NPS6869");
});

test("reads optional fields without treating a QR label as a verified recipient", () => {
  const data = payment(makeQr({ account: "ALIAS123", amount: "00180000.00", note: "  noi dung goc  ", recipient: "TEN TU QR", extra: tlv("05", "REF0001") }));
  assert.equal(data.account, "ALIAS123");
  assert.equal(data.amount, "180000");
  assert.equal(data.note, "  noi dung goc  ");
  assert.equal(data.recipientLabel, "TEN TU QR");
  assert.equal(data.reference, "REF0001");
});

test("accepts outer paste whitespace and lowercase CRC, never repairs internal corruption", () => {
  assert.deepEqual(payment(" \n" + staticQr + "\n"), payment(staticQr));
  assert.deepEqual(payment(staticQr.slice(0, -4) + staticQr.slice(-4).toLowerCase()), payment(staticQr));
  invalid(staticQr.replace("0099999999", "0099999998"));
  invalid(dynamicQr.replace("180000", "280000"));
  invalid(staticQr.slice(0, -1) + "0");
  invalid(staticQr.slice(0, -8));
  invalid(staticQr + "x");
});

test("does not interpret URLs, wallet schemes, arbitrary text, or other QR payment rails", () => {
  for (const data of ["", "https://example.test/pay", "javascript:alert(1)", "intent://pay", "momo://pay", "wolfarimobile://trips", "WIFI:T:WPA;S:x;P:y;;", "hello"]) invalid(data);
  for (const service of ["QRIBFTTC", "QRPUSH", "QRCASH"]) invalid(makeQr({ service }));
  invalid(makeQr({ currency: "840" }));
  invalid(makeQr({ country: "US" }));
  invalid(withChecksum(staticQr.slice(0, -8).replace("A000000727", "A000000999")));
});

test("rejects missing, duplicate and truncated TLV fields at every level", () => {
  invalid(makeQr({ fields: tlv("53", "704") }));
  invalid(makeQr({ providerExtra: tlv("02", "QRIBFTTA") }));
  invalid(makeQr({ accountExtra: tlv("01", "DIFFERENT") }));
  invalid(makeQr({ note: "one", extra: tlv("08", "two") }));
  invalid(makeQr({ fields: "9900" }));
  invalid(makeQr({ fields: "9909x" }));
  invalid(makeQr({ fields: "xx01x" }));
  invalid(withChecksum(staticQr.slice(0, -8).replace("5303704", "")));
  invalid(withChecksum(staticQr.slice(0, -8).replace("3854", "3855")));
  invalid(withChecksum(staticQr.slice(0, -8).replace("010211", "010299")));
});

test("refuses misleading account/amount values, controls, Unicode spoofing and oversized payloads", () => {
  for (const account of ["", "000 123", "123-456", "x".repeat(20), "abc\n123", "abc\u202e123"]) invalid(makeQr({ account }));
  for (const bin of ["12345", "1234567", "abcdef"]) invalid(makeQr({ bin }));
  for (const amount of ["", "0", "-1", "+1", "1.5", "1e6", "1,000", " 100", "Infinity", "10000000000000"]) invalid(makeQr({ amount }));
  assert.equal(payment(makeQr({ amount: "9999999999999" })).amount, "9999999999999");
  invalid(makeQr({ note: "mang\u0000x" }));
  invalid(makeQr({ note: "Tiếng Việt" }));
  invalid(staticQr + " ".repeat(MAX_PAYMENT_QR_LENGTH));
});

test("refuses fees, co-branded payment instructions and payer-data requests instead of dropping them", () => {
  for (const id of ["55", "56", "57", "26"]) invalid(makeQr({ fields: tlv(id, "01") }));
  invalid(makeQr({ extra: tlv("09", "AME") }));
  invalid(makeQr({ note: "***" }));
});

test("all truncations and single-byte mutations of an independent vector fail closed", () => {
  for (let length = 0; length < dynamicQr.length; length++) invalid(dynamicQr.slice(0, length));
  for (let index = 0; index < dynamicQr.length; index++) {
    const next = dynamicQr[index] === "0" ? "1" : "0";
    invalid(dynamicQr.slice(0, index) + next + dynamicQr.slice(index + 1));
  }
});

test("native plugins allow scanning without microphone or image-picker camera blocking", async () => {
  const { expo } = JSON.parse(await readFile(new URL("../app.json", import.meta.url), "utf8"));
  const camera = expo.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === "expo-camera")[1];
  const picker = expo.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === "expo-image-picker")[1];
  assert.equal(camera.recordAudioAndroid, false);
  assert.equal(camera.microphonePermission, false);
  assert.equal(camera.barcodeScannerEnabled, true);
  assert.equal(picker.cameraPermission, camera.cameraPermission);
  assert.equal(picker.microphonePermission, false);
});
