# Quét QR chuyển khoản

Vào **Chuyến đi → Tiện ích → Quỹ nhóm → Quét QR thanh toán**.

Quét QR chi tiền chỉ hiện cho **người giữ quỹ hiện tại**, khi quỹ đang mở và chuyến đi chưa lưu trữ. Chủ nhóm không giữ quỹ không có quyền này. Thành viên được bổ nhiệm giữ quỹ vẫn có quyền theo vai trò giữ quỹ. Không hiển thị scanner khi chưa mở quỹ hoặc trong bản nháp dự trù riêng. Thành viên thường vẫn có nút **Góp quỹ**, mở **Đợt góp → khoản đóng của bạn → Xem QR góp quỹ** và báo chuyển tiền ngay trong đợt đó. Xem [bảng đối chiếu quyền với backend](finance-permissions.md).

- Quét bằng camera sau, bật/tắt đèn pin trên mobile; hoặc dán chuỗi dữ liệu QR khi không dùng được camera.
- Cấp quyền khi người dùng bấm cho phép. Từ chối quyền vẫn dùng được cách dán; nếu hệ điều hành không cho hỏi lại, mở cài đặt camera.
- Chỉ đọc VietQR NAPAS chuyển đến tài khoản (`QRIBFTTA`), quốc gia VN, tiền tệ VND. Có hoặc không có số tiền/nội dung đều được; không tự điền số tiền còn thiếu.
- Kiểm tra cấu trúc TLV, trường trùng, mã CRC16 và giá trị trước khi hiển thị. Bản này hỗ trợ ASCII in được, tài khoản số/alias chữ-số tối đa 19 ký tự, số tiền nguyên dương tối đa 13 ký tự (chấp nhận đuôi `.0`/`.00` mà không làm tròn).
- QR lỗi, QR liên kết/deeplink, ví điện tử riêng, chuyển đến thẻ, thanh toán merchant, nhiều mạng thanh toán, phí bổ sung hoặc yêu cầu thông tin người trả tiền được từ chối với hướng dẫn dùng ứng dụng ngân hàng.
- Hiển thị tên thương hiệu kèm mô tả ngắn (ví dụ **Vietcombank · Ngoại thương**, **MB Bank · Quân đội**) theo danh mục BIN đã đối chiếu với backend, tài khoản, số tiền, nội dung, mã tham chiếu/hóa đơn nếu có. Mã ngân hàng trong API giữ nguyên. BIN lạ hiển thị chưa nhận diện, không đoán tên. Tên ghi trong QR luôn là **chưa xác minh**, không phải kết quả tra cứu chủ tài khoản.
- Người nhận, ngân hàng và số tài khoản nằm trong một khối gọn; mã tham chiếu/hóa đơn mở ở **Chi tiết QR**. Có nút sao chép tài khoản và mã tham chiếu/hóa đơn; chỉ sao chép khi người dùng bấm. Không tự đọc clipboard. Nội dung đã sao chép có thể còn trong clipboard hệ điều hành sau khi đóng màn hình.

## Giới hạn thanh toán và dữ liệu

Luồng: **Quét QR → kiểm tra người nhận → nhập/sửa số tiền và nội dung → chọn ngân hàng hoặc ví → mở ứng dụng thanh toán**. Không cần cài thêm dependency native. QR tĩnh không tự đoán số tiền; người dùng nhập trước khi tiếp tục.

Ngân hàng hỗ trợ điền sẵn: Quân đội, Công thương Việt Nam, Đầu tư và Phát triển Việt Nam, Á Châu và Phương Đông (MB, VietinBank, BIDV, ACB, OCB trong API). Chọn ngân hàng trả tiền độc lập với ngân hàng nhận trong QR. Chỉ sau khi bấm mở, ứng dụng gửi tài khoản nhận, số tiền, nội dung và tên trong QR nếu có qua `https://dl.vietqr.io/pay`. Trang miễn phí phải hiển thị cho người dùng; không trích xuất link ký hoặc bỏ qua trang trung gian/quảng cáo. Danh mục và điều kiện có thể thay đổi. Web mở tab mới với `noopener,noreferrer`; native dùng Expo Linking. Trở về `wolfarimobile://` không phải bằng chứng thanh toán.

CRC chỉ phát hiện lỗi dữ liệu, không xác thực người nhận, hạn dùng hoặc trạng thái giao dịch. Người dùng kiểm tra và xác nhận trong app ngân hàng. Wolfari không tự ghi trạng thái “đã thanh toán”, cập nhật quỹ hay tạo nháp khoản chi từ việc mở app.

Dữ liệu quét chỉ ở trong bộ nhớ màn hình, không gửi lên API/analytics, không log hoặc lưu AsyncStorage. Dữ liệu chuyển khoản chỉ gửi VietQR sau thao tác mở rõ ràng nêu trên. Đóng màn hình, đổi tài khoản/chuyến đi hoặc rời trang sẽ bỏ kết quả. Camera tắt sau một kết quả (kể cả lỗi), khi đóng/chuyển chế độ, rời trang hoặc đưa app xuống nền. Nút “Quét mã khác” mở một lượt quét mới.

## Thử với MoMo Sandbox

Muốn demo ngay, không có khóa: chọn **Mô phỏng trong app** sau khi đọc QR và nhập tiền/nội dung. Xem [pipeline demo mô phỏng](payment-simulation-demo.md) để thử cả góp quỹ, cập nhật số dư mẫu và lịch sử. Lựa chọn này không gọi MoMo hay cập nhật sổ quỹ máy chủ.

Sau khi nhập tiền/nội dung, **MoMo Test · Thanh toán thử** được chọn sẵn khi có chuyến đi. Danh sách ngân hàng nằm trong **Chuyển bằng ngân hàng**. Bấm **Mở MoMo Test**; native yêu cầu mở trang thanh toán ngay khi nhận được liên kết, web có nút **Mở lại MoMo Test** để tránh trình duyệt chặn popup sau request bất đồng bộ. Có thể mở lại cùng liên kết. Đây là giao dịch thử với đối tác MoMo cấu hình cho Wolfari, **không chuyển tiền tới tài khoản ngân hàng trong QR**. Chỉ số tiền/nội dung người dùng đã nhập và UUID lần thử được gửi tới backend, không gửi số tài khoản nhận.

API mới: `POST /trips/:id/qr-payments/momo-sandbox`, body `{ request_id, amount, note }`, header `Idempotency-Key` bằng `request_id`. Số tiền từ 1.000–50.000.000 VND. Backend kiểm tra thành viên còn tham gia, người giữ quỹ hiện tại, quỹ đang mở, chuyến đi đang hoạt động và không khóa chốt quỹ trước mỗi lần tạo/thử lại, kể cả khi có checkout trong cache. API dùng provider sandbox hiện có, giữ nguyên order/request khi thử lại, giới hạn 5 lần thử mới trong 5 phút cho mỗi người trên một Finance process. Cache thử lại chỉ ở RAM; restart mất cache, không tạo mã order khác cho cùng khóa. Chỉ mở HTTPS host `test-payment.momo.vn`.

API thử không tạo contribution, expense, receipt, ledger hay payment exception. Callback có chữ ký hợp lệ cho order `wqr-…` được nhận riêng và không đưa vào bộ xử lý góp quỹ. Không triển khai API này trên production; không đánh dấu giao dịch thành công từ redirect. Nếu muốn thanh toán QR thực qua MoMo, cần luồng production riêng do MoMo hỗ trợ; cấu hình sandbox không biến VietQR thành lệnh thanh toán ví.

Backend local đang đọc `backend/apps/finance-service/.env`. Để thử từ điện thoại:

1. Đặt `MOMO_SANDBOX_MODE=remote` và điền `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY` từ tài khoản MoMo Business **môi trường test** trực tiếp trong file này. Không đặt khóa trong biến `EXPO_PUBLIC_*`, không commit hoặc gửi khóa qua chat.
2. Giữ `MOMO_CREATE_URL=https://test-payment.momo.vn/v2/gateway/api/create` và `MOMO_QUERY_URL=https://test-payment.momo.vn/v2/gateway/api/query`. `MOMO_IPN_URL` phải là URL HTTPS công khai trỏ đến Gateway `/api/v1/webhooks/momo`; `MOMO_REDIRECT_URL` là URL HTTPS quay về trang/app của bạn. URL localhost không nhận được callback từ MoMo.
3. Build backend và khởi động lại Gateway/Finance theo cách chạy local đang dùng. Nếu dùng `dev:gateway`, khởi động lại bridge để nhận timeout 40 giây cho API thử này.
4. Cài **MoMo Test**, dùng tài khoản test; quét một VietQR rồi nhập số tiền/nội dung và chọn ví thử. Chưa thực hiện chuyển tiền thật hoặc cài MoMo Test trong kiểm thử tự động.

Kiểm tra ngày 18/11/2026: file Finance local có mode `disabled`, ba khóa trên để trống và URL callback/redirect còn là ví dụ. Chưa thể xác minh end-to-end tới MoMo thật cho đến khi cấu hình test hợp lệ.

Dò lại cả backend/mobile, file ẩn và 42 nhánh/ref Git đang có trên máy: không có bộ khóa remote dùng được; các giá trị không rỗng còn lại thuộc fixture kiểm thử. File `.env` là cấu hình local, không đi kèm commit tích hợp của thành viên. Báo cáo đã che giá trị ở `.cache/momo-config-audit.json`.

Backend phân biệt cấu hình thiếu/sai bằng HTTP503 `PAYMENT_PROVIDER_NOT_CONFIGURED`, `retryable=false`, không trả khóa hoặc chi tiết cấu hình. App báo ví chưa được bật, vô hiệu MoMo trong lượt quét đó và mở sẵn danh sách ngân hàng. Lỗi provider/kết nối tạm thời vẫn cho thử lại với cùng amount/note/request ID. Sau khi sửa cấu hình và tải lại backend, đóng rồi mở lại lượt quét để thử MoMo. Khi chuyển từ nhập tiền sang chọn ứng dụng, popup trở về đầu nội dung để thông tin người nhận không bị khuất do vị trí cuộn lúc nhập.

Backend đã có luồng góp quỹ qua MoMo ở `PaymentService` và `MomoSandboxProvider` (commit `d36acb2`), gồm tạo payment attempt, chữ ký callback và đối soát. Màn quét QR dùng lại provider này cho đơn thử độc lập. Code tích hợp có sẵn không đồng nghĩa bộ khóa đã được cấu hình trên máy này. Mode `mock` chỉ chạy trong `NODE_ENV=test` để kiểm thử tự động; link `/mock/…` không phải checkout MoMo Test có thể thanh toán. Mode `remote` mới gọi dịch vụ sandbox của MoMo với bộ khóa test tương ứng.

## Build và kiểm thử

Hiện dùng `expo-camera ~58.0.14`, `expo-clipboard ~58.0.4` theo Expo SDK 58 (nâng từ SDK 57 ngày 04/11/2026). `app.json` có plugin camera và thông báo quyền tiếng Việt, không bật microphone. `expo-image-picker.cameraPermission` phải không còn là `false` vì giá trị đó chặn CAMERA trên Android dù plugin camera đã thêm quyền.

APK cũ cần build và cài lại để có module native/quyền mới; chỉ reload JavaScript hoặc OTA không đủ. Không tạo/sửa thư mục native bằng tay. Web cần HTTPS hoặc localhost để dùng camera; dán nội dung QR là đường dự phòng.

Kiểm tra tự động:

```powershell
npm.cmd run lint -- --no-cache
npm.cmd run typecheck
npm.cmd test
# Terminal riêng chạy preview web ở cổng 8082
npx.cmd expo start --web --localhost --port 8082
npm.cmd run test:ui:parity
```

Unit tests dùng các vector VietQR độc lập và dữ liệu hỏng: CRC sai, cắt ngắn, sửa từng ký tự, TLV trùng, số tiền sai, QR không hỗ trợ. UI suite dùng API giả, camera giả và decoder giả ở biên phần cứng; kiểm tra quyền bị từ chối, quét trùng, xem lại, sao chép, quét lại, đóng/xóa dữ liệu, lỗi camera và màn hình 360px. Không dùng tài khoản fixture để chuyển tiền thật.

Cần kiểm tra trên thiết bị Android/iOS trước phát hành: từ chối/cấp lại quyền trong Settings, QR in/QR từ màn hình khác, đèn pin, background/foreground, khóa máy, quay lại/đóng sheet, QR dài và chữ phóng to. Kiểm thử web giả không chứng minh camera vật lý đọc được QR.

Tài liệu API và vector đối chiếu:

- [Expo Camera SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/camera/)
- [Expo Clipboard SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/clipboard/)
- [Expo Router SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/router/)
- [Expo Linking SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/linking/)
- [VietQR deeplink](https://www.vietqr.io/deeplink), [điều kiện miễn phí](https://dl.vietqr.io/term)
- [MoMo one-time payment](https://developers.momo.vn/v3/vi/docs/payment/api/wallet/onetime/), [MoMo Test](https://developers.momo.vn/v3/vi/docs/payment/onboarding/test-instructions/)
- [React Native AppState 0.86](https://reactnative.dev/docs/0.86/appstate)
- [Cấu trúc và generator VietQR của Subiz](https://github.com/subiz/vietqr/blob/master/vietqr.go)
- [Vector kiểm thử của generator](https://github.com/subiz/vietqr/blob/master/vietqr_test.go)
