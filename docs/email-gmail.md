# Xác thực email bằng Gmail trên điện thoại

Gmail thay Mailpit cho bản thử nghiệm. Người đăng ký nhận email thật, mở liên kết trên điện thoại và xác nhận. Không cần dùng laptop để mở hộp thư. Backend local vẫn cần chạy; để dùng app khi laptop tắt cần triển khai backend lên máy chủ.

## Cấu hình một lần

1. Dùng một Gmail riêng cho Wolfari. Bật xác minh hai bước rồi tạo **Mật khẩu ứng dụng** tại [Tài khoản Google](https://myaccount.google.com/apppasswords). Không dùng mật khẩu đăng nhập Gmail thông thường. Một số tài khoản tổ chức hoặc bật Bảo vệ nâng cao không có mục này. [Hướng dẫn Google](https://support.google.com/accounts/answer/185833?hl=vi).
2. Điền trực tiếp trong `backend/apps/automation-service/.env`:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_REQUIRE_TLS=false
SMTP_USER=your-wolfari-test@gmail.com
SMTP_PASSWORD=your-google-app-password
SMTP_FROM=Wolfari <your-wolfari-test@gmail.com>
```

Địa chỉ `SMTP_FROM` dùng đúng Gmail gửi. Mật khẩu chỉ ở backend, không đặt trong biến `EXPO_PUBLIC_*`, không commit hoặc gửi vào chat. Code không ghi log SMTP chứa thông tin đăng nhập.

3. Để liên kết mở được từ điện thoại, trong `backend/apps/identity-service/.env` đặt `IDENTITY_LINK_BASE_URL` thành địa chỉ Gateway mà điện thoại truy cập được. Ví dụ khi cùng Wi-Fi:

```dotenv
IDENTITY_LINK_BASE_URL=http://192.168.1.10:3001
```

Thay IP bằng IP LAN thật của laptop. `3001` là cổng bridge mặc định của `npm run dev:gateway`; nếu chạy Gateway trực tiếp trên LAN hoặc dùng cổng khác, dùng địa chỉ thực tế tương ứng. Có thể xem các URL LAN khi chạy bridge. Không dùng `127.0.0.1` hoặc `localhost` trong email gửi tới điện thoại.

Giữ đường dẫn local `/api/v1/auth/local/verify` và `/api/v1/auth/local/reset` mặc định. Trang xác thực đã có bố cục cho điện thoại và nút trở về Wolfari. GET liên kết chỉ mở trang; chỉ nút Xác nhận mới sử dụng token một lần. Nếu dùng Expo Go chưa nhận scheme `wolfarimobile://`, tự quay lại app sau khi xác thực.

4. Build và khởi động lại **Identity** và **Automation** theo cách chạy backend hiện tại. Giữ Gateway, bridge nếu dùng, RabbitMQ, database và các dịch vụ liên quan hoạt động. Thư gửi trước khi đổi cấu hình vẫn chứa địa chỉ cũ; hãy đăng ký thử mới hoặc gửi lại thư xác minh.
5. Đăng ký bằng một địa chỉ nhận có thật. Mở Gmail trên điện thoại, bấm liên kết trong thư Wolfari → **Xác nhận**. Trở lại app để đăng nhập, hoặc bấm **Tôi đã xác minh** nếu đã đăng nhập. Kiểm tra cả mục Spam nếu chưa thấy thư.

Không tự đánh dấu email đã xác minh, không tắt kiểm tra token và không thay đổi dữ liệu tài khoản bằng tay. SMTP đã gửi thành công không đồng nghĩa thư đã vào Inbox; Gmail có giới hạn gửi và bộ lọc riêng.

## Khi phát hành app

Dùng backend và trang xác thực HTTPS công khai, cấu hình `IDENTITY_LINK_BASE_URL` cùng `IDENTITY_VERIFY_LINK_PATH=/verify-email`, `IDENTITY_RESET_LINK_PATH=/reset-password` để trỏ tới web app có các route tương ứng. Có thể thêm Universal Links/App Links để email mở app trực tiếp.

Gmail phù hợp bản thử nghiệm nhỏ. Khi phát hành có thể giữ cùng code SMTP và đổi sang dịch vụ gửi thư giao dịch. Các bảo vệ production hiện có của backend về TLS cho gRPC/AMQP vẫn cần hoàn tất trước triển khai; hỗ trợ SMTP TLS không tự hoàn tất phần hạ tầng đó.

Mailpit vẫn dùng được khi chạy thử nội bộ; muốn hiện nút hộp thư thử nghiệm trong app development, đặt rõ `EXPO_PUBLIC_MAILPIT_URL` tới URL Mailpit mà điện thoại mở được. Bản phát hành không hiện công cụ này.

## Trang mở được nhưng bấm Xác nhận báo chưa thể hoàn tất

Nếu liên kết mở qua bridge LAN cổng `3001`, request xác nhận có origin của chính bridge. Bridge cho phép các host local/LAN đã biết ở đúng cổng đang lắng nghe, rồi chuyển origin sang origin Gateway đã cấu hình; vẫn chặn host/cổng ngoài danh sách. Chạy lại `npm run dev:gateway` sau khi cập nhật script để nạp sửa lỗi này. Không cần tạo lại thư chỉ vì thay đổi bridge; liên kết còn hạn và chưa dùng có thể mở lại rồi xác nhận.
