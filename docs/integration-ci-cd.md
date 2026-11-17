# Mobile integration và CI/CD

Nhánh triển khai: `feat/mobile-integration-ci-cd` ở cả mobile và backend.

## Chức năng được nối thêm

- Hành lý: danh sách chung, tạo/sửa/xóa, số lượng thập phân, phân công bằng membership ID, hạn theo timezone chuyến đi và completion. Thay đổi chỉ được xác nhận sau phản hồi server; conflict yêu cầu tải Plan mới.
- Dress code: backend cung cấp CRUD cho cả chuyến/ngày/hoạt động; mobile bật luồng server khi Plan trả `capabilities.dress_codes_write`.
- Plan trả `capabilities.packing_write` cho hành lý. Backend cũ vẫn dùng chế độ nháp riêng. Nháp cũ được giữ trong storage nhưng không tự ghi lên nhóm khi nâng cấp.
- Cài đặt chuyến đi đọc `GET /trips/:id/plan-policy`, hiển thị và chọn sẵn người đang có quyền sửa. PUT dùng revision của snapshot policy vừa đọc.
- Tìm địa điểm qua Gateway → Travel gRPC → Geoapify; kiểm session và quyền Trip trước khi gọi provider hoặc trả cache. Kết quả có attribution, thời điểm, cờ stale và cảnh báo thiếu giờ mở cửa. Chọn địa điểm trong giao diện hiện vẫn là nháp; chức năng tìm kiếm không tạo selected-location UUID trên server.
- Danh mục ngân hàng mobile chỉ gồm các thành viên hỗ trợ chuyển khoản theo backend. Test parity so sánh danh mục khi hai repo nằm cạnh nhau.
- Request tài chính chưa rõ kết quả giữ nguyên mã đối chiếu. Không bỏ receipt chỉ vì mất phản hồi hoặc poll trả 404. Sau restart chỉ còn mã tra cứu; không lưu số tiền/tài khoản/lý do để tự replay. Nếu tiếp tục 404, giữ mã và đối chiếu với vận hành trước khi tạo nghiệp vụ thay thế.

Phần quản lý chuyến đi, push/reminder và PDF/chứng từ được bổ sung trong [mobile-completion.md](mobile-completion.md), kèm migration và cấu hình bên ngoài cần thiết. Provider vé thật và TLS production vẫn thuộc phạm vi khác.

## Cấu hình backend

Backend trên nhánh cùng tên có các route mới:

```text
POST   /api/v1/trips/:id/dress-codes
PATCH  /api/v1/trips/:id/dress-codes/:itemId
DELETE /api/v1/trips/:id/dress-codes/:itemId
POST   /api/v1/trips/:id/packing-items
PATCH  /api/v1/trips/:id/packing-items/:itemId
DELETE /api/v1/trips/:id/packing-items/:itemId
PATCH  /api/v1/trips/:id/packing-items/:itemId/completion
GET    /api/v1/travel/places?trip_id=:id&q=:query
```

Mỗi lệnh Plan có UUID `Idempotency-Key` và `expected_plan_version`. Trip khóa theo operation và Trip, kiểm permission/reference/version, cập nhật entity + plan/export revision + audit/outbox + receipt trong cùng transaction. Không cần sửa baseline migration: bảng dress_codes và packing_items đã tồn tại.

Dùng Node 24.x và pnpm đã pin ở backend:

```powershell
corepack.cmd pnpm install --frozen-lockfile
corepack.cmd pnpm env:init
corepack.cmd pnpm build
```

`env:init` bổ sung `GATEWAY_TRAVEL_SECRET`, Gateway `TRAVEL_GRPC_TARGET` và Travel `TRAVEL_GRPC_PORT`, giữ nguyên giá trị đã có. Travel dùng cổng gRPC 3203; demo độc lập dùng 13203. Sau khi đổi source/env, restart các service/Gateway.

Đặt `GEOAPIFY_API_KEY` trong `backend/apps/travel-intelligence-service/.env`, không đặt trong biến `EXPO_PUBLIC_*`. Không có key, API trả metadata `ERROR`/`PROVIDER_NOT_CONFIGURED`; không tạo kết quả giả. Provider lỗi có thể trả cache tối đa một ngày với nhãn stale. Mỗi tài khoản có giới hạn 30 search/phút trên một Gateway process.

Provider dùng [Geoapify Forward Geocoding](https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/). Đây là tìm địa chỉ/địa danh bằng văn bản, chưa bao gồm route, dự báo thời tiết hoặc ghi địa điểm chung cho nhóm.

## CI trên GitHub

`.github/workflows/ci.yml` chạy trên push, PR và chạy thủ công, dùng Node 24 và `npm ci`:

1. `Mobile checks`: lint, typecheck, unit/contract/source guard tests.
2. `Mobile web and UI`: export web, cài Chromium đúng phiên bản Playwright và chạy bảy suite HTTP fixture: auth, Trip, backend features, Finance/Price Watch, dress code, hành lý và mobile completion.
3. `Mobile CI passed`: chỉ thành công khi cả hai job trên đạt; đây là status check nên yêu cầu trước khi merge.

Artifact chứa web export, log và screenshot, lưu 7 ngày. CI không cần tài khoản thật hoặc backend đang chạy. URL `https://ci.invalid/api/v1` chỉ dành cho bundle test và bị fixture intercept; không dùng cho APK.

Các Action được pin bằng commit SHA đã xác minh. Workflow chỉ có `contents: read`; job kiểm tra không dùng Expo token. Sau khi push workflow, người có quyền admin vào Settings → Rules → Rulesets, yêu cầu `Mobile CI passed` cho main. Không bỏ qua test lỗi để có check xanh.

Chạy cùng kiểm tra trên máy:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
# Nếu không có Chrome/Edge, cài browser của Playwright:
node node_modules/playwright-core/cli.js install chromium
$env:EXPO_PUBLIC_API_URL = 'https://ci.invalid/api/v1'
npm.cmd run export:web
npm.cmd run test:ui:ci
```

Có thể chạy riêng `node scripts/check-ui.mjs packing` hoặc `node scripts/check-ui.mjs trip dress-code`. Helper tự mở server loopback tạm và dọn khi kết thúc. `WOLFARI_EXPORT_DIR` chọn thư mục export khác, `WOLFARI_BROWSER_PATH` chọn browser cài sẵn. Đây là browser fixture QA; vẫn cần kiểm tra native Android/iOS.

## CD: APK preview

`.github/workflows/preview.yml` có nút Run workflow trên main. Tự động sau push main chỉ bật khi **repository variable** `ENABLE_PREVIEW_BUILDS=true`. Bản build chờ quality gate và chờ EAS hoàn tất; build thất bại sẽ khiến job đỏ. Không submit App Store/Google Play hoặc phát hành OTA trong workflow này.

Thiết lập một lần:

1. Tạo GitHub Environment tên `preview`, giới hạn deployment branch là main. Thêm secret `EXPO_TOKEN` của tài khoản có quyền với Expo project đã liên kết trong app.json. Không gửi token vào chat hoặc commit.
2. Thêm environment variable `EXPO_PUBLIC_API_URL` là URL Gateway HTTPS thực tế, kết thúc `/api/v1`, ví dụ `https://gateway.example.com/api/v1` (thay bằng URL thực).
3. Trong **Expo project environment preview**, tạo cùng biến `EXPO_PUBLIC_API_URL`, visibility plain text. URL được nhúng vào app nên không phải secret. Preflight tải environment Expo và so với GitHub để không build nhầm backend.
4. Hoàn tất signing credentials một lần từ terminal đã đăng nhập Expo:

   ```powershell
   npx.cmd eas-cli@latest build --platform android --profile preview
   ```

5. Khi CI đạt và workflow đã vào main, chọn Actions → Android preview → Run workflow. Nếu muốn tự động, đặt repository variable `ENABLE_PREVIEW_BUILDS=true` sau khi bản preview đầu tiên đã được kiểm tra.

Workflow build đúng SHA đã kích hoạt kiểm tra và dùng profile preview hiện có trong eas.json để tạo APK internal distribution. Link EAS trong log dẫn đến file cài. Main cần dùng Gateway triển khai truy cập được từ điện thoại; bridge LAN không phải URL phát hành.

Tham khảo: [Expo build từ CI](https://docs.expo.dev/build/building-on-ci/), [environment cho build](https://docs.expo.dev/eas/environment-variables/usage/), [GitHub Node.js CI](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs).

## Kiểm chứng backend

`pnpm trip:test` đã được mở rộng bằng `scripts/plan-items-integration.mjs`: CRUD thật qua Gateway, reload, assignment/completion, idempotency, stale revision, access, outbox và receipt trên PostgreSQL cô lập. Cả hành lý và dress code được kiểm tra rollback khi audit/outbox/receipt ghi lỗi, rồi thử lại thành công bằng cùng key. Bộ này được gọi bởi CI backend hiện có.

Unit/contract test mới bao phủ validation/reference/permission, request replay, schema/router REST, Travel auth, metadata thiếu provider và cache. Chạy `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm contracts:check`; chạy `pnpm trip:test` khi Docker Engine sẵn sàng. Không chạy integration fixture vào database development.
