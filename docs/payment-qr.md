# Quét QR chuyển khoản

Vào **Chuyến đi → Tiện ích → Quỹ nhóm → Quét QR thanh toán**.

- Quét bằng camera sau, bật/tắt đèn pin trên mobile; hoặc dán chuỗi dữ liệu QR khi không dùng được camera.
- Cấp quyền khi người dùng bấm cho phép. Từ chối quyền vẫn dùng được cách dán; nếu hệ điều hành không cho hỏi lại, mở cài đặt camera.
- Chỉ đọc VietQR NAPAS chuyển đến tài khoản (`QRIBFTTA`), quốc gia VN, tiền tệ VND. Có hoặc không có số tiền/nội dung đều được; không tự điền số tiền còn thiếu.
- Kiểm tra cấu trúc TLV, trường trùng, mã CRC16 và giá trị trước khi hiển thị. Bản này hỗ trợ ASCII in được, tài khoản số/alias chữ-số tối đa 19 ký tự, số tiền nguyên dương tối đa 13 ký tự (chấp nhận đuôi `.0`/`.00` mà không làm tròn).
- QR lỗi, QR liên kết/deeplink, ví điện tử riêng, chuyển đến thẻ, thanh toán merchant, nhiều mạng thanh toán, phí bổ sung hoặc yêu cầu thông tin người trả tiền được từ chối với hướng dẫn dùng ứng dụng ngân hàng.
- Hiển thị mã BIN ngân hàng (không đoán tên ngân hàng), tài khoản, số tiền, nội dung, mã tham chiếu/hóa đơn nếu có. Tên ghi trong QR luôn là **chưa xác minh**, không phải kết quả tra cứu chủ tài khoản.
- Có nút sao chép từng trường; chỉ sao chép khi người dùng bấm. Không tự đọc clipboard. Nội dung đã sao chép có thể còn trong clipboard hệ điều hành sau khi đóng màn hình.

## Giới hạn thanh toán và dữ liệu

Đây là bước đọc/kiểm tra thông tin, **không phải cổng thanh toán**. Người dùng tự mở ứng dụng ngân hàng, kiểm tra người nhận và xác nhận ở đó. CRC chỉ phát hiện lỗi dữ liệu, không xác thực người nhận, hạn dùng hoặc trạng thái giao dịch. Không tạo lệnh chuyển tiền, API tài chính, biên lai, trạng thái “đã thanh toán”, cập nhật quỹ hay tự tạo bản nháp.

Dữ liệu quét chỉ ở trong bộ nhớ màn hình, không gửi lên API/analytics, không log hoặc lưu AsyncStorage. Đóng màn hình, đổi tài khoản/chuyến đi hoặc rời trang sẽ bỏ kết quả. Camera tắt sau một kết quả (kể cả lỗi), khi đóng/chuyển chế độ, rời trang hoặc đưa app xuống nền. Nút “Quét mã khác” mở một lượt quét mới.

## Build và kiểm thử

Thêm `expo-camera ~57.0.6`, `expo-clipboard ~57.0.2` theo Expo SDK 57. `app.json` có plugin camera và thông báo quyền tiếng Việt, không bật microphone. `expo-image-picker.cameraPermission` phải không còn là `false` vì giá trị đó chặn CAMERA trên Android dù plugin camera đã thêm quyền.

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

- [Expo Camera SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/camera/)
- [Expo Clipboard SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/clipboard/)
- [Expo Router SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/router/)
- [React Native AppState 0.86](https://reactnative.dev/docs/0.86/appstate)
- [Cấu trúc và generator VietQR của Subiz](https://github.com/subiz/vietqr/blob/master/vietqr.go)
- [Vector kiểm thử của generator](https://github.com/subiz/vietqr/blob/master/vietqr_test.go)
