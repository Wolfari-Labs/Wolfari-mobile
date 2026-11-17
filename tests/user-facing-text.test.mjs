import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../src/shared/api/api-client.ts";
import { errorMessage } from "../src/shared/api/errors.ts";
import { authErrorMessage } from "../src/features/auth/auth-errors.ts";
import { historyActionLabel, historyActorLabel, historyEntityLabel, historyTimeLabel } from "../src/features/finance/history-labels.ts";
import { paymentReviewReason } from "../src/features/finance/payment-labels.ts";
import { priceProviderLabel, watchStatusReason } from "../src/features/price-watch/labels.ts";
import { statusText } from "../src/shared/ui/status-labels.ts";

const id = "ad55b446-8676-4caf-a144-f8a009241b49";
const fallback = "Chưa thể hoàn tất. Vui lòng thử lại.";

test("API errors never render server diagnostics or correlation identifiers", () => {
  for (const status of [0, 400, 401, 403, 404, 409, 422, 429, 500, 503]) {
    const error = new ApiError("NEW_INTERNAL_FAILURE", `Lỗi xử lý ${id} NEW_INTERNAL_FAILURE`, status, true, id);
    const message = errorMessage(error);
    assert.ok(message.length > 0);
    assert.ok(!message.includes(id));
    assert.ok(!message.includes("NEW_INTERNAL_FAILURE"));
    assert.equal(error.correlationId, id, "Diagnostics remain available internally");
  }
});

test("network and login errors have fixed readable messages", () => {
  for (const code of ["NETWORK_ERROR", "REQUEST_TIMEOUT"]) {
    const error = new ApiError(code, `NativeException ${id}`);
    assert.doesNotMatch(errorMessage(error), /NativeException|ad55b446/);
    assert.equal(authErrorMessage(error), errorMessage(error));
  }
});

test("local validation remains actionable without exposing technical errors", () => {
  const validation = "Chọn ít nhất một thành viên đang tham gia.";
  assert.equal(errorMessage(new Error(validation)), validation);
  for (const diagnostic of [
    `Không đọc được yêu cầu ${id}`,
    "Lỗi từ máy chủ: UNKNOWN_INTERNAL_STATE",
    "Lỗi kết nối https://gateway.test/debug",
    "Unexpected token in JSON at position 2",
    "Không đọc được dữ liệu: SyntaxError",
    "Lỗi truy cập abcdef0123456789abcdef0123456789",
  ]) assert.equal(errorMessage(new Error(diagnostic)), fallback);
  assert.equal(errorMessage(undefined, "Không tải được ảnh."), "Không tải được ảnh.");
});

test("audit history uses neutral labels for unknown events and actors", () => {
  assert.equal(historyActionLabel("NEW_INTERNAL_ACTION"), "Cập nhật quỹ");
  assert.equal(historyEntityLabel("new_internal_entity"), "Hoạt động quỹ");
  assert.equal(historyActorLabel({ actor_user_id: null, system_actor: `WORKER:${id}` }, () => "Lan"), "Hệ thống");
  assert.equal(historyTimeLabel(id), "Chưa có thời gian");
});

test("payment and price-watch reasons use readable explanations and safe fallbacks", () => {
  assert.equal(paymentReviewReason("AMOUNT_MISMATCH"), "Số tiền thanh toán chưa khớp");
  assert.equal(paymentReviewReason(id), "Cần đối chiếu lại thông tin thanh toán");
  assert.equal(watchStatusReason("TRIP_ARCHIVED"), "Chuyến đi đã được lưu trữ");
  assert.doesNotMatch(watchStatusReason("NEW_INTERNAL_REASON"), /NEW_INTERNAL_REASON/);
  assert.equal(priceProviderLabel("MOCK_FLIGHT"), "Nguồn mô phỏng");
  assert.equal(priceProviderLabel("AMADEUS"), "Amadeus");
  assert.equal(priceProviderLabel(id), "Nhà cung cấp giá");
});

test("unknown statuses do not appear as codes or claim success", () => {
  assert.equal(statusText("PENDING"), "Đang chờ");
  assert.equal(statusText("NEW_INTERNAL_STATE"), "Chưa có thông tin trạng thái");
  assert.equal(statusText(id), "Chưa có thông tin trạng thái");
});
