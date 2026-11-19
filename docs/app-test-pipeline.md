# Pipeline kiểm thử Wolfari

Chạy từ thư mục `mobile`. Pipeline tự động kiểm tra code, bundle Android/iOS/Web và 11 bộ test giao diện với API giả lập. Sau đó kiểm tra backend thật và điện thoại theo các bước bên dưới trước khi chốt bản thử nghiệm.

## 1. Một lệnh kiểm tra trên máy

Dùng Node 24.x như CI. Với checkout mới, cài dependency và Chromium một lần:

```powershell
npm.cmd ci
node node_modules/playwright-core/cli.js install chromium
```

Nếu máy đã có dependency và Chrome/Edge thì chạy ngay:

```powershell
npm.cmd run test:app
```

| Thứ tự | Lệnh do pipeline chạy | Điều kiện đạt |
| --- | --- | --- |
| 1 | `npm run lint` | Không có lỗi ESLint |
| 2 | `npm run typecheck` | Không có lỗi TypeScript |
| 3 | `npm run test` | Tất cả unit/contract/source guard test đạt |
| 4 | `npm run export:all` | Expo export thành công cả Android, iOS và Web |
| 5 | `npm run test:ui:ci` | Cả 11 suite giao diện đạt |

Lỗi ở bước nào thì dừng tại đó và trả exit code khác 0. Kết quả từng bước và thời gian chạy nằm trong `.cache/app-tests/report.json`; bước chưa chạy có trạng thái `skipped`. Lệnh này luôn đặt API fixture là `https://ci.invalid/api/v1` và dùng export `dist`, không phụ thuộc Gateway local đang bật hay tắt. Bundle trong `dist` chỉ dành cho QA tự động; khi build app cài trên điện thoại phải dùng URL Gateway thật.

Export kiểm tra JavaScript và asset theo từng nền tảng; bước này chưa biên dịch APK/IPA, chưa kiểm chứng camera hay khả năng mở ứng dụng khác trên thiết bị.

## 2. Giao diện được kiểm tra những gì?

Các suite chạy trên Chromium với viewport điện thoại, tối đa hai suite đồng thời. API được fixture chặn; không cần Gmail, MoMo key hay tài khoản backend thật.

| Suite | Phạm vi chính |
| --- | --- |
| `auth` | Đăng ký, đăng nhập, xác thực email và validation |
| `trip` | Tạo và xem chuyến đi, hoạt động, điều hướng |
| `order` | Kéo thả sắp xếp hoạt động, xung đột hai người sửa, mất phản hồi |
| `backend-features` | Khôi phục/đổi mật khẩu, avatar, lời mời, thành viên và quản lý chuyến đi |
| `finance` | Quỹ, góp quỹ, khoản chi, hoàn tiền và đối soát |
| `finance-price-watch` | Quỹ và theo dõi giá theo contract hiện tại |
| `dress-code` | Trang phục chung và quyền sửa |
| `packing` | Hành lý, phân công và hoàn thành |
| `mobile-completion` | Nhắc việc, tải PDF, chuyển chủ và xóa chuyến đi |
| `reliability` | Phục hồi sau mất phản hồi, địa điểm chung, phân trang và đọc thông báo |
| `mobile-parity` | Giao diện mobile/web, nhập QR, sửa chuyển khoản và lựa chọn ngân hàng/ví |

Log: `.cache/ui/<suite>.log`. Ảnh chụp: `.cache/visual/`.

Khi có lỗi, sửa rồi chạy riêng suite để kiểm tra nhanh, sau đó chạy lại pipeline đầy đủ:

```powershell
# Dùng dist vừa được export:
node scripts/check-ui.mjs auth finance mobile-parity
# Sau khi sửa xong:
npm.cmd run test:app
```

`WOLFARI_BROWSER_PATH` chọn Chrome/Chromium/Edge khác. Khi chạy riêng helper, `WOLFARI_EXPORT_DIR` chọn thư mục export khác. Helper tự mở server loopback ở cổng tạm và đóng sau khi chạy.

## 3. Kiểm tra backend local thật

Tại thư mục `backend`, chạy quality gate riêng của backend:

```powershell
corepack.cmd pnpm build
corepack.cmd pnpm lint
corepack.cmd pnpm test
corepack.cmd pnpm contracts:check
```

Chạy `corepack.cmd pnpm trip:test` khi Docker Engine và môi trường DB kiểm thử cô lập đã sẵn sàng. Bộ integration này tạo dữ liệu để kiểm tra transaction, revision, quyền và idempotency; không trỏ fixture vào database đang dùng.

Sau khi backend local hoạt động, quay về `mobile`:

```powershell
$env:WOLFARI_TEST_API_URL = 'http://127.0.0.1:3000/api/v1'
npm.cmd run test:backend
```

Đạt khi Gateway readiness trả `200` và `/me` chưa đăng nhập trả đúng `401`. Để kiểm tra đăng nhập/profile/refresh, cấu hình tài khoản thử trong `.env.backend-test.local` rồi chạy:

```dotenv
WOLFARI_TEST_EMAIL=your-test-account@example.com
WOLFARI_TEST_PASSWORD=your-test-account-password
```

```powershell
npm.cmd run test:backend -- --auth
```

Không commit file thông tin đăng nhập. Muốn kiểm tra tạo chuyến đi qua API thật, chỉ trên môi trường thử dùng riêng:

```powershell
npm.cmd run test:backend -- --auth --trips
```

Test backend thật là bước riêng, không nằm trong `test:app` hay job fixture trên GitHub.

## 4. Checklist trên điện thoại

Dùng một chuyến đi và tài khoản dành riêng cho kiểm thử. Ghi model máy, phiên bản hệ điều hành, SHA source, URL Gateway và kết quả từng ca. Thử Android trước; chạy lại trên iPhone nếu phát hành iOS.

Với backend local, giữ backend chạy, điện thoại cùng Wi-Fi và mở bridge ở terminal riêng:

```powershell
npm.cmd run dev:gateway
```

Ở terminal khởi động Expo, dùng IP LAN thật mà bridge hiển thị, ví dụ:

```powershell
$env:EXPO_PUBLIC_API_URL = 'http://192.168.1.10:3001/api/v1'
npm.cmd run start -- --lan
```

Mở bằng development build đã cài đúng module native. Nếu thay module/quyền native, cần build và cài lại; reload JavaScript chưa đủ. Hướng dẫn Gmail và MoMo ở các tài liệu liên kết dưới đây.

| Ca | Thao tác cụ thể | Kết quả cần đạt |
| --- | --- | --- |
| UI-01 | Mở lần lượt Tài khoản, Tiện ích chuyến đi và Quỹ; dùng máy hẹp và tăng cỡ chữ | Nhãn/nút đọc được, không tràn ngang, không che nút lưu |
| UI-02 | Lưu nháp khoản chi, ngân sách và hành lý; đăng xuất rồi đăng nhập lại | Thao tác lưu gửi một lần; phản hồi gọn; không xuất hiện popup thành công hay xác nhận đăng xuất thừa |
| UI-03 | Cố lưu dữ liệu thiếu, ngắt mạng rồi thử lại | Lỗi nhìn thấy; nội dung nhập còn; yêu cầu chưa rõ kết quả không bị tạo trùng |
| EMAIL-01 | Theo [cấu hình Gmail](email-gmail.md), đăng ký bằng email nhận thật trên điện thoại | Nhận thư trong Gmail; liên kết dùng địa chỉ điện thoại truy cập được |
| EMAIL-02 | Chỉ mở trang trong email, chưa bấm Xác nhận; sau đó bấm Xác nhận | Mở trang chưa tiêu thụ token; chỉ xác nhận rõ ràng mới xác minh tài khoản |
| EMAIL-03 | Quay lại app, bấm Tôi đã xác minh; thử lại link đã dùng/link hết hạn | App đọc lại trạng thái server; link không hợp lệ không xác minh lại hoặc báo thành công giả |
| QR-00 | Thử bằng thành viên thường, chủ nhóm không giữ quỹ, người giữ quỹ có role MEMBER; thử quỹ đóng/đang đóng, chuyến lưu trữ, chưa có quỹ và bản nháp | Chỉ người giữ quỹ với quỹ đang mở/chuyến chưa lưu trữ thấy scanner; thành viên vẫn góp quỹ bằng QR của khoản góp |
| QR-01 | Với tài khoản giữ quỹ: Chuyến đi → Tiện ích → Quỹ nhóm → Quét QR thanh toán; từ chối camera rồi thử dán QR | Có đường dự phòng; không lặp popup xin quyền; có thể cấp lại quyền trong Settings |
| QR-02 | Quét VietQR từ giấy và từ màn hình khác; thử mã có/không có tiền, nội dung | Đúng ngân hàng nhận/tài khoản; tên thương hiệu dễ nhận diện; tiền/nội dung lấy từ QR khi có, sửa được |
| QR-03 | Thử mã lỗi CRC, QR liên kết và QR không hỗ trợ | Báo lỗi; không tự mở liên kết hay đoán người nhận |
| QR-04 | Bật đèn pin, đưa app xuống nền, quay lại, đóng màn quét và quét mã mới | Camera dừng khi rời/nền; không nhận lặp cùng một lượt; dữ liệu cũ được bỏ khi đóng |
| BANK-01 | Nhập số tiền/nội dung → chọn một ngân hàng hỗ trợ đã cài → bấm mở | Đi qua trang VietQR và mở ngân hàng; đối chiếu người nhận, tiền, nội dung trước khi xác nhận ở ngân hàng |
| BANK-02 | Quay về Wolfari khi chưa thanh toán; thử máy chưa cài ngân hàng đã chọn | Có phản hồi mở/thử lại phù hợp; Wolfari không tự đánh dấu đã trả hoặc thay đổi số dư |
| MOMO-01 | Theo [cấu hình MoMo Test](payment-qr.md), nhập 10.000 VND và nội dung thử → chọn ứng dụng (MoMo Test được chọn sẵn) → Mở MoMo Test | Backend trả liên kết `https://test-payment.momo.vn`; trang thanh toán/MoMo Test nhận đúng tiền và nội dung thử |
| MOMO-02 | Hủy thanh toán test rồi quay lại; thử mở lại và thử khi backend/provider lỗi | Không báo thành công từ redirect; có thể thử lại; không ghi khoản chi/góp quỹ/ledger |
| MOMO-03 | Hoàn tất một giao dịch bằng tài khoản MoMo Test, kiểm tra callback backend | Callback được kiểm chữ ký và nhận riêng cho đơn thử; không chuyển tiền vào ngân hàng quét được, số dư quỹ không đổi |

Với BANK-01 chỉ cần đối chiếu ở màn xác nhận, không cần thực hiện chuyển tiền thật. MoMo sandbox kiểm tra giao dịch thử của Wolfari với MoMo; không thanh toán tới tài khoản ngân hàng trong VietQR.

Gmail hiện cần cấu hình SMTP riêng; Finance local cần bật remote sandbox và điền khóa test/callback hợp lệ. Ca chưa có cấu hình hoặc chưa chạy trên máy thật phải ghi `NOT RUN`, không tính là đạt. Backend local vẫn phụ thuộc laptop đang chạy; nhận email qua Gmail không thay thế việc triển khai backend.

## 5. GitHub CI và bản cài thử

Mỗi push/PR chạy hai job: `Mobile checks` (lint/typecheck/unit) và `Mobile bundles and UI` (export ba nền tảng + 11 suite). Job `Mobile CI passed` chỉ xanh khi cả hai đạt. Yêu cầu status này trong ruleset của main. Artifact `mobile-bundles-and-ui-<run_id>` giữ `dist`, log và screenshot 7 ngày, kể cả khi bước test lỗi.

Sau khi CI đạt, dùng workflow **Android preview** đã có để tạo APK từ đúng SHA và URL backend HTTPS triển khai. Cấu hình token, môi trường và cách chạy tại [integration-ci-cd.md](integration-ci-cd.md#cd-apk-preview). EAS build là bước riêng; `test:app` không tự gửi build lên cloud.

Chỉ chốt bản thử nghiệm khi CI xanh, kiểm tra backend thật đạt và các ca thiết bị liên quan đã được ghi nhận. Cài APK preview rồi chạy lại tối thiểu: đăng nhập → xác thực Gmail → mở quỹ → quét QR → chọn ngân hàng/MoMo Test → quay về app. Export xanh chưa thay thế được lần kiểm tra trên bản cài này.

Tham khảo: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Expo CLI export](https://docs.expo.dev/more/expo-cli/), [EAS build trên CI](https://docs.expo.dev/build/building-on-ci/).
