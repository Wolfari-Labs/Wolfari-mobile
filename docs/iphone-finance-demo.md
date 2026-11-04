# Chạy Finance / Price Watch bằng iPhone và Windows

Repo mobile đã có tại `D:\Wolfari\.local\clients\Wolfari-mobile`, nhánh
`feature/mobile-finance-price-watch-api`. Không cần clone lại. Không dùng `npm run ios`
trên Windows để mở iOS Simulator; thử trên iPhone qua Expo Go.

Chuẩn bị Node.js 24 (backend yêu cầu), Docker Desktop đang chạy, iPhone có Expo Go
và hai thiết bị cùng Wi-Fi. Kiểm tra `node --version` và `npm.cmd --version`.
Không cần nối USB hoặc cài Xcode cho cách thử qua Expo Go này.

## 1. Backend

Backend cần main đã có Finance, Price Watch và API162. Bản demo cũ vẫn chạy được
quỹ/giá nhưng mục Lịch sử quỹ trả 404. Trước khi chuyển nhánh, xem `git status`
và giữ nguyên các thay đổi riêng; không dùng reset/clean để ép chuyển. Trước khi
khởi động backend, nếu không có thay đổi code chưa lưu:

```powershell
cd D:\Wolfari
git status --short --branch
git switch main
git pull --ff-only origin main
corepack pnpm install --frozen-lockfile
```

Nếu Git báo không thể fast-forward hoặc có thay đổi cản trở chuyển nhánh, giữ
nguyên và kiểm tra nguyên nhân. Không ép ghi đè bản làm việc. Đây là hướng dẫn
để bạn cập nhật backend; tác vụ mobile chưa chuyển nhánh backend hiện tại.

Mở Docker Desktop. Terminal 1:

```powershell
cd D:\Wolfari
corepack pnpm demo:init
corepack pnpm demo:start
```

Giữ terminal mở. Terminal khác:

```powershell
cd D:\Wolfari
corepack pnpm demo:check
corepack pnpm demo:accounts
```

Gateway demo: `http://127.0.0.1:13000`; Mailpit: `http://127.0.0.1:18025`.
Tài khoản thử nghiệm được lưu riêng trong `.local/demo/seed.json`. Đọc tại máy,
không đưa mật khẩu/token vào báo cáo hoặc commit. Nếu chưa có tài khoản demo,
chạy `corepack pnpm demo:seed`. Nếu đã đổi mật khẩu, dùng mật khẩu mới/khôi phục
qua Mailpit; không mặc định mật khẩu seed vẫn đúng.

## 2. Cầu nối cho điện thoại

PC và iPhone cùng Wi-Fi. Terminal 2:

```powershell
cd D:\Wolfari\.local\clients\Wolfari-mobile
npm.cmd ci
$env:WOLFARI_GATEWAY_TARGET='http://127.0.0.1:13000'
$env:WOLFARI_GATEWAY_WEB_ORIGIN='http://localhost:5273'
npm.cmd run dev:gateway
```

Giữ terminal mở. Dùng địa chỉ LAN mà script in ra, ví dụ
`http://192.168.1.20:3001/api/v1`. IP chỉ là ví dụ, phải lấy IP thực tế máy bạn.
Mở Safari trên iPhone tới `http://<IP-PC>:3001/health/ready`: phải có phản hồi
JSON/HTTP 200 trước khi thử đăng nhập app. `localhost` trên iPhone là chính iPhone.

Nếu không vào được: kiểm tra cùng mạng, VPN/AP isolation, Windows Firewall cho
Node trên mạng Private, cổng 3001 và cổng Expo. Không cần tắt toàn bộ firewall.

## 3. Expo Go

1. Cài/cập nhật Expo Go trên App Store. App Store ngày 04/11/2026 có 58.0.5 hỗ trợ
   SDK58; Expo Go và project phải cùng SDK. Không nâng/hạ ngẫu nhiên một thư viện.
2. Mở terminal 3:

   ```powershell
   cd D:\Wolfari\.local\clients\Wolfari-mobile
   npx.cmd expo login
   npm.cmd run start:go
   ```

3. Đăng nhập **cùng tài khoản Expo** trên Expo Go của iPhone. Đây là tài khoản Expo,
   khác với tài khoản Wolfari dùng trong app.
4. Camera iPhone quét QR trong terminal → mở Expo Go. Cho phép **Local Network**.
5. Để `EXPO_PUBLIC_API_URL` trống, app lấy IP Expo host và cổng 3001. Nếu đã đặt biến
   này trước đó, sửa `.env.local` hoặc biến môi trường thành URL LAN đúng, khởi động
   lại Expo. Biến EXPO_PUBLIC là công khai; không đặt secret tại đây.

Nếu iOS đã từ chối Local Network: Settings → Apps → Expo Go → Local Network.
Nếu dùng tunnel cho Expo, tunnel đó chỉ chuyển bundle JS; backend cũng phải có URL
điện thoại truy cập được. Cách LAN ở trên ít bước hơn cho demo trên cùng mạng.

## 4. Kiểm tra trên app

Đăng nhập Wolfari → Chuyến đi → chọn Trip mà tài khoản đang là thành viên → Tiện ích.

- **Quỹ nhóm**: có số dư/ngân sách/trạng thái từ server. Owner bật quỹ nếu chưa có,
  chọn Holder và nơi nhận TEST. Holder đăng nhập, mở Thiết lập, xác nhận nơi nhận.
  Owner tạo đợt đóng, nhập 200000 cho Member và 300000 cho Owner. Member/Owner
  lần lượt báo chuyển khoản của mình. Holder thử từ chối khoản đầu, Member báo
  lại, Holder xác nhận cả hai. Đối chiếu 500.000 ₫ và 2 bút toán thu trong Sổ quỹ.
- **Quyền**: Owner khác Holder không có nút xác nhận nhận tiền. Nếu Trip/quỹ thay
  đổi trên Web, bấm Tải lại quỹ. Khi mất kết nối sau thao tác, dùng Gửi lại yêu cầu
  đã lưu hoặc Kiểm tra trạng thái xử lý, không tạo khoản mới để thay thế.
- **Khoản chi/Hoàn tiền**: nháp/gửi duyệt chưa tương đương đã chi. Người giữ quỹ
  và người nhận thực hiện đúng vai trò; đối chiếu số dư, dự phòng và bút toán sau
  mỗi xác nhận. Chốt quỹ chỉ khi số dư 0 và không còn nghĩa vụ/đối soát chờ.
- **Theo dõi giá**: tạo SGN → DAD, ngày tương lai, 1 người lớn, ngưỡng 2000000.
  Xem lịch sử; chấp nhận trường hợp chưa có quan sát nếu worker chưa chạy. Kiểm tra
  nhãn MOCK_FLIGHT, giá cũ khi nguồn lỗi, sửa ngưỡng, tạm dừng/tiếp tục/dừng. App
  không tạo giá hoặc cảnh báo giả để lấp dữ liệu thiếu.
- **Quét QR thanh toán** trong Quỹ nhóm: từ chối camera rồi dán QR; CRC đúng mới
  được đọc. Đọc được 180.000 ₫ không phải đã thanh toán và không tăng số dư.
- **Ảnh chứng từ**: chọn JPG/PNG khi báo chuyển hoặc sửa/tạo khoản chi. Thử hủy
  picker, từ chối quyền, ảnh quá lớn. Chỉ sau upload thành công mới gắn vào lệnh.
- **MoMo**: màn hình đã nối API Sandbox; demo backend mặc định tắt provider nên
  không lấy đó làm bằng chứng thanh toán Sandbox thành công.

## 5. Ghi kết quả kiểm thử

Ghi phiên bản iOS, Expo Go, commit app/backend, thời gian, tài khoản theo vai trò
(không ghi mật khẩu), mã Trip/quỹ và ảnh màn hình phù hợp. Không ghi Passed cho
thiết bị thật trước khi chạy. iOS là kiểm thử bổ sung, không thay thế các mã AND
được yêu cầu chạy trên Android. Bản Expo Go dùng quyền camera của Expo Go;
nghiệm thu ứng dụng Wolfari đã ký riêng cần build riêng và lượt kiểm tra tương ứng.

Nguồn thiết lập: [Expo Start developing](https://docs.expo.dev/get-started/start-developing/),
[Expo Go trên App Store](https://apps.apple.com/us/app/expo-go/id982107779),
[quy tắc tương thích SDK](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).
