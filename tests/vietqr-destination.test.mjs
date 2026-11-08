import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { bankInput, destinationFromQr } from "../src/features/finance/forms.ts";
import { resolveVietQrBank, VIETQR_BANKS } from "../src/features/finance/vietqr-banks.ts";
import { parsePaymentQr } from "../src/features/payments/model/payment-qr.ts";
import { makeQr } from "./fixtures/payment-qr.mjs";

test("bank directory resolves code or BIN like the backend, failing closed", () => {
  assert.deepEqual(resolveVietQrBank(" vcb "), { code: "VCB", bin: "970436" });
  assert.equal(resolveVietQrBank("970436")?.code, "VCB");
  assert.equal(resolveVietQrBank("XYZ"), undefined);
  assert.equal(resolveVietQrBank(""), undefined);
  assert.equal(new Set(VIETQR_BANKS.map(bank => bank.code)).size, VIETQR_BANKS.length);
});

test("mobile bank directory mirrors the sibling backend list when available", async (t) => {
  let source;
  try { source = await readFile(new URL("../../backend/apps/finance-service/src/domain/vietqr-banks.ts", import.meta.url), "utf8"); }
  catch { t.skip("backend checkout not present"); return; }
  const backend = [...source.matchAll(/code:\s*'([^']+)',\s*bin:\s*'(\d+)'/g)].map(([, code, bin]) => ({ code, bin }));
  assert.deepEqual([...VIETQR_BANKS], backend);
});

test("destination input normalizes bank code and enforces the QuickLink account rule", () => {
  assert.deepEqual(bankInput({ bank_code: "970436", account_number: "0012 345 678", account_name: "TEST ACCOUNT" }),
    { destination_type: "VIETQR", bank_code: "VCB", account_number: "0012345678", account_name: "TEST ACCOUNT", active: true, is_default: true });
  assert.throws(() => bankInput({ bank_code: "XYZ", account_number: "1", account_name: "A" }), /danh mục VietQR/);
  assert.throws(() => bankInput({ bank_code: "VCB", account_number: "12345678901234567890", account_name: "A" }), /19 ký tự/);
  assert.throws(() => bankInput({ bank_code: "VCB", account_number: "12-34", account_name: "A" }), /19 ký tự/);
  assert.throws(() => bankInput({ bank_code: "VCB", account_number: "1234", account_name: " " }));
});

test("a receiving account VietQR fills destination fields; unknown BINs are refused", () => {
  const read = (qr) => { const result = parsePaymentQr(qr); assert.equal(result.ok, true); return result.payment; };
  assert.deepEqual(destinationFromQr(read(makeQr({ bin: "970436", account: "0012345678", recipient: "NGUYEN VAN A" }))),
    { bank_code: "VCB", account_number: "0012345678", account_name: "NGUYEN VAN A" });
  assert.deepEqual(destinationFromQr(read(makeQr({ bin: "970436", account: "0012345678" }))), { bank_code: "VCB", account_number: "0012345678" });
  assert.throws(() => destinationFromQr(read(makeQr({ bin: "999999" }))), /BIN 999999/);
});
