# Chạy Wolfari bằng Expo Go qua Wi-Fi

Project dùng Expo SDK 57 và Expo Router trong `src/app`. Không cần bật USB debugging,
không cần `adb reverse`, không cần tạo thư mục `android/` hoặc `ios/`.

## Chạy trên điện thoại

1. Cài Expo Go hỗ trợ SDK 57. Điện thoại và máy tính kết nối cùng Wi-Fi.
2. Bật Docker Desktop, rồi chạy backend trong terminal riêng:

   ```powershell
   Set-Location F:\workspace\pbl6\Wolfari-backend
   corepack.cmd pnpm infra:up
   corepack.cmd pnpm db:status
   corepack.cmd pnpm dev
   ```

   Nếu database báo thiếu migration, chạy `corepack.cmd pnpm db:migrate` trước
   `dev`. Gateway cần trả HTTP 200 tại `http://127.0.0.1:3000/health/ready`.
3. Trong repository mobile, sao chép `.env.example` thành `.env.local` nếu chưa có.
   Để `EXPO_PUBLIC_API_URL=` trống để app tự lấy IP máy chạy Expo.
4. Mở terminal thứ nhất:

   ```powershell
   npm.cmd run dev:gateway
   ```

5. Mở terminal thứ hai:

   ```powershell
   npm.cmd run start:go
   ```

6. Quét QR code bằng Expo Go trên Android hoặc Camera trên iPhone. Giữ hai terminal
   mở trong khi sử dụng app. Nếu PowerShell không chặn npm scripts, có thể dùng `npm`
   thay cho `npm.cmd`.

`dev:gateway` chuyển tiếp cổng LAN 3001 đến Gateway trên máy tính ở cổng 3000.
Backend hiện chỉ nghe `127.0.0.1`, vì thế điện thoại không gọi trực tiếp IP LAN:3000.
Script không sửa backend. Expo Go lấy `Constants.expoConfig.hostUri` và gọi
`http://<IP-máy-chạy-Expo>:3001/api/v1`. Module Crypto và Maps được cài bằng
`expo install` theo SDK; đều hỗ trợ Expo Go.

## Khi không kết nối được

- Mở `http://<IP-máy-tính>:3001/health/ready` bằng trình duyệt điện thoại. Nếu không
  mở được, kiểm tra backend, hai thiết bị cùng Wi-Fi, VPN, Wi-Fi cách ly thiết bị,
  và quyền mạng riêng của Node.js/Windows Firewall cho cổng 3001 và 8081.
- Nếu đang có Metro chiếm cổng 8081, dừng Metro cũ hoặc chạy
  `npm.cmd run start:go -- --port 8082`.
- Máy có nhiều card mạng: chọn IP Wi-Fi mà điện thoại truy cập được, ví dụ
  `EXPO_PUBLIC_API_URL=http://192.168.1.40:3001/api/v1`, sau đó reload app.
- Không đặt `127.0.0.1` hoặc `localhost` khi chạy trên điện thoại thật: chúng trỏ
  về chính điện thoại. `10.0.2.2` chỉ dành cho Android emulator.
- Nếu đổi `.env.local`, reload toàn bộ app. Có thể khởi động lại Expo với
  `npm.cmd run start:go -- --clear`.
- Sau khi thêm route mới mà typed routes bị sai, dừng các Metro trùng project,
  chạy lại Expo để tạo lại `.expo/types/router.d.ts`. Không sửa file generated.

## Backend hoặc mạng khác

Đặt `EXPO_PUBLIC_API_URL=https://<gateway>/api/v1` nếu có Gateway HTTPS công khai.
`npm.cmd run start:tunnel` chỉ tunnel Metro, **không tunnel API**. Khi dùng tunnel,
API vẫn cần URL điện thoại truy cập được. Bản production bắt buộc cấu hình HTTPS.
Không đưa mật khẩu, token, secret dịch vụ vào biến `EXPO_PUBLIC_*`.

Biến tùy chọn của cầu nối (chỉ development):

| Biến | Mặc định | Công dụng |
| --- | --- | --- |
| `WOLFARI_GATEWAY_TARGET` | `http://127.0.0.1:3000` | Gateway HTTP trên máy |
| `WOLFARI_LAN_PORT` | `3001` | Cổng LAN; đặt API URL tương ứng nếu thay đổi |
| `WOLFARI_GATEWAY_WEB_ORIGIN` | `http://127.0.0.1:3000` | Phải khớp `WEB_ORIGIN` của backend khi kiểm tra bản web |

Bridge chỉ chuyển tiếp `/api/v1`, readiness và trang lời mời local. Bản web giữ
HttpOnly refresh cookie và CSRF, chỉ cho phép origin localhost/IP máy ở cổng
8081/8082. Không dùng cầu nối này để triển khai production.

## Kiểm tra

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:backend
npm.cmd run test:backend -- --auth
npm.cmd run test:backend -- --auth --trips
```

`--auth` đọc tài khoản test từ `.env.backend-test.local`, không in token/mật khẩu.
Kiểm thử UI dùng Chromium và fixture đúng hợp đồng API, không gửi email hoặc tạo
chuyến đi trên backend thật:

```powershell
$env:WOLFARI_PREVIEW_URL = 'http://localhost:8082'
npm.cmd run test:ui
npm.cmd run test:ui:trips
npm.cmd run test:ui:order
```

Ảnh kiểm tra nằm trong `.cache/visual/`. Bản đồ tương tác dùng native Maps trong
Expo Go; bản web cho mở bản đồ của từng địa điểm bằng liên kết.

### Kiểm tra các tính năng giao diện mới trên máy thật

- Reload app sau khi cập nhật mã nguồn và dependencies. Liquid Glass native chỉ
  bật khi iOS 26+ và runtime hỗ trợ; iOS cũ dùng blur, Android dùng nền sáng/gradient
  nhẹ. Bật **Reduce Transparency** để kiểm tra nền đặc, chữ vẫn dễ đọc.
- Ở Đăng nhập/Đăng ký, bấm biểu tượng mắt để hiện/ẩn từng ô mật khẩu, nhập tiếp
  rồi thử ẩn lại. Chuyển app ra nền phải ẩn mật khẩu.
- Mở **Lịch trình → Sắp xếp lịch trình** ở ngày có ít nhất hai hoạt động, kéo tay
  nắm ☰ rồi chọn **Lưu thứ tự cho nhóm**. Thử kéo liên tiếp, kéo sát mép danh sách
  dài để tự cuộn, dùng nút ▲/▼ và đóng bản nháp chưa lưu.
- Dùng hai tài khoản có quyền sửa cùng chuyến đi: mở phần sắp xếp trên cả hai,
  cùng đổi thứ tự, lưu thiết bị thứ nhất rồi thiết bị thứ hai. Thiết bị thứ hai
  phải báo thay đổi/xung đột, giữ bản nháp và không ghi đè. Chọn tải bản mới để
  sắp xếp lại. Thành viên chỉ có quyền xem không được sửa.
- Hiện chỉ đổi thứ tự **trong một ngày hoặc mục Chưa xếp lịch**; giờ bắt đầu/kết
  thúc được giữ nguyên, không tự chuyển hoạt động sang ngày khác. Editor kiểm tra
  cập nhật mỗi 15 giây khi đang mở; màn hình lịch trình thường dùng kéo để tải lại.

Native Liquid Glass, thao tác cảm ứng và VoiceOver/TalkBack cần kiểm tra trực tiếp;
các bài kiểm thử trình duyệt không thay thế kiểm thử thiết bị.

Để tạo hoặc dùng lại chuyến mẫu “Đà Nẵng · Expo Go” với một hoạt động thực:

```powershell
npm.cmd run test:backend -- --auth --trips --seed-demo
npm.cmd run test:ui:backend
```

Lệnh đầu kiểm tra cả thêm/sửa/hoàn thành/xóa hoạt động, chống tạo trùng và xung đột
phiên bản. Hoạt động kiểm thử tạm và lời mời LINK được dọn sau kiểm tra; chuyến mẫu
và hoạt động “Dạo biển Mỹ Khê” được giữ lại để xem trên điện thoại. Không gửi email.
Lệnh UI dùng dữ liệu backend thật, không thay API bằng fixture.

Tìm địa điểm cần `GEOAPIFY_API_KEY` trong file
`Wolfari-backend/apps/travel-intelligence-service/.env`, sau đó restart backend.
Nếu backend chưa cấu hình khóa này, app hiển thị trạng thái chưa sẵn sàng và cho
thêm hoạt động thủ công. Giữ khóa ở backend, không đặt trong `EXPO_PUBLIC_*`.

Tài liệu: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/),
[Expo CLI](https://docs.expo.dev/more/expo-cli/),
[GlassEffect SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/glass-effect/),
[React Native Maps](https://docs.expo.dev/versions/v57.0.0/sdk/map-view/).
