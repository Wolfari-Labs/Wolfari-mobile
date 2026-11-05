# Khởi chạy Backend + Mobile trên máy khác

Hướng dẫn cho môi trường development, đối chiếu mã nguồn ngày **02/11/2026**.
Luồng chính: backend và Expo chạy trên cùng máy tính, điện thoại chạy Expo Go
qua Wi-Fi. Không cần chạy `Wolfari-web`, Android Studio hoặc bật USB debugging
cho luồng này. Đây không phải hướng dẫn triển khai production.

## 1. Chuẩn bị máy mới

- **Node.js 24.x, tối thiểu 24.3.0**, kèm npm. Backend yêu cầu Node `>=24 <25`;
  mobile SDK 58 yêu cầu ít nhất 24.3.0 trong nhánh 24. Dùng chung Node 24.x cho cả hai.
- **Corepack**, để backend dùng đúng **pnpm 10.34.5** đã pin trong `package.json`.
- **Docker Desktop + Docker Compose**. Trên Windows, bật virtualization/WSL 2
  theo [hướng dẫn Docker](https://docs.docker.com/desktop/setup/install/windows-install/),
  dùng Linux containers và mở Docker Desktop trước khi chạy backend.
- **Git** nếu lấy mã bằng clone; Internet để tải dependencies và Docker images lần đầu.
- **Expo Go tương thích SDK 58** trên điện thoại; xem bản phù hợp tại
  [Expo Go](https://expo.dev/go). Không dùng client SDK 57 cho mã nguồn này.
- Máy tính và điện thoại ở cùng mạng LAN/Wi-Fi, cho phép truy cập lẫn nhau.

Kiểm tra trong PowerShell mới sau khi cài:

```powershell
node --version
npm.cmd --version
corepack.cmd --version
docker --version
docker compose version
docker info
```

`docker info` phải kết nối được Docker Engine, không chỉ in phiên bản CLI.
Nếu không tìm thấy Corepack, cài rồi mở lại terminal:

```powershell
npm.cmd install --global corepack
```

Các lệnh dưới gọi trực tiếp `corepack.cmd pnpm`, không bắt buộc chạy
`corepack enable`. Nếu gặp lỗi cài Corepack qua Node Windows Installer, xem
[hướng dẫn Corepack](https://github.com/nodejs/corepack#how-to-install);
không dùng `--force` để ghi đè công cụ đang có.

## 2. Mang đúng mã nguồn sang máy mới

Lấy cả **Wolfari-backend** và **Wolfari-mobile**, ở các phiên bản tương thích.
Ví dụ đặt cạnh nhau:

```text
D:\projects\pbl6\
  Wolfari-backend\
  Wolfari-mobile\
```

Mọi đường dẫn `D:\projects\pbl6` dưới đây đều là **ví dụ**: thay bằng thư mục
thực tế của máy mới. Không cần tạo ổ F: hay dùng đường dẫn của máy cũ.

- Giữ `package.json`, `pnpm-lock.yaml` của backend và `package-lock.json` của mobile.
- Không cần chép `node_modules`, `.pnpm-store`, `.expo`, `.cache`, `dist`; cài lại
  dependencies trên máy mới. Đừng dùng npm cho backend hoặc pnpm cho mobile.
- Khi chuyển qua Git, nhớ đưa các thay đổi mã nguồn cần thiết và file mới vào
  commit/push của **từng repository**. Clone không lấy được thay đổi chưa commit/push.
- Với môi trường mới hoàn toàn, **không cần chép secret từ máy cũ**: backend tự sinh
  cấu hình ở bước tiếp theo; mobile dùng `.env.example`.
- Database, ảnh/file trong MinIO, tài khoản và chuyến đi cũ **không nằm trong Git**.
  Máy mới sẽ có dữ liệu trống. Nếu cần giữ dữ liệu, phải backup/restore riêng,
  đồng bộ credentials và cấu hình liên quan; chép thư mục source là chưa đủ.
- Không commit `.env`, `apps/*/.env`, `.env.local`, `.env.backend-test.local`,
  hoặc thư mục dữ liệu/secret `.local` của backend. Giữ lại các `.env.example`.

## 3. Backend: cài lần đầu

Mở PowerShell tại backend. Chạy lần lượt; nếu một lệnh lỗi, xử lý trước khi
chạy lệnh tiếp theo:

```powershell
Set-Location D:\projects\pbl6\Wolfari-backend
corepack.cmd pnpm --version
corepack.cmd pnpm install --frozen-lockfile
corepack.cmd pnpm env:init
corepack.cmd pnpm infra:up
corepack.cmd pnpm infra:check
corepack.cmd pnpm db:migrate
corepack.cmd pnpm db:status
```

Kết quả mong đợi:

- pnpm báo `10.34.5`.
- `env:init` tạo `.env` ở gốc backend và `apps/<tên-app>/.env`, sinh mật khẩu,
  signing key và service secret. Không tự copy backend `.env.example` thành `.env`
  rồi để nguyên mật khẩu `change-me-*`.
- `infra:up` chạy PostgreSQL, RabbitMQ, MinIO và Mailpit bằng Docker; lần đầu cần
  tải/build image. Các ứng dụng NestJS **chưa chạy** ở bước này.
- `infra:check` báo `PASS`; `db:status` báo không còn migration thiếu cho cả 5 DB.

`env:init` giữ giá trị đã có và bổ sung cấu hình còn thiếu; không tự sửa cấu hình
cũ bị lệch. Nếu đã chép `.env`/volume từ máy khác, đối chiếu trước khi chạy tiếp.
Đổi mật khẩu trong `.env` không tự đổi mật khẩu bên trong PostgreSQL volume cũ.

## 4. Mobile: cài lần đầu

Mở PowerShell khác tại mobile:

```powershell
Set-Location D:\projects\pbl6\Wolfari-mobile
npm.cmd ci
if (-not (Test-Path -LiteralPath .env.local)) {
    Copy-Item -LiteralPath .env.example -Destination .env.local
}
```

Mở `Wolfari-mobile/.env.local`, để cấu hình sau khi backend và Expo cùng máy:

```dotenv
EXPO_PUBLIC_API_URL=
```

Để trống là **có chủ ý**: app lấy IP máy chạy Expo và gọi cổng `3001`.
Nếu file đã có từ máy cũ, kiểm tra và bỏ IP cũ. Giá trị đặt sẵn trong môi trường
terminal cũng có thể ảnh hưởng cấu hình. `EXPO_PUBLIC_*` được nhúng vào app,
không chứa mật khẩu/token/khóa dịch vụ; xem
[biến môi trường Expo](https://docs.expo.dev/guides/environment-variables/).

`npm ci` dùng lockfile và chạy bước chuẩn bị CanvasKit cho bản web. Nếu báo
lockfile không khớp, lấy lại cặp `package.json`/`package-lock.json` cùng phiên bản;
không chữa bằng cách xóa lockfile hoặc dùng `--legacy-peer-deps`.

## 5. Mỗi lần chạy: giữ 3 terminal mở

Luồng kết nối API:

```text
Điện thoại (Expo Go)
  → http://<IP-máy-tính>:3001/api/v1  [cầu nối dev:gateway]
  → http://127.0.0.1:3000/api/v1     [API Gateway]
  → các service backend + hạ tầng Docker
```

Expo/Metro dùng cổng `8081` để cung cấp mã ứng dụng. Cổng `3001` là cầu nối
API, không phải Metro. Backend mặc định chỉ nghe `127.0.0.1`, nên điện thoại
không gọi trực tiếp `http://<IP-máy-tính>:3000`.

### Terminal 1 — Backend

Mở Docker Desktop trước, rồi chạy:

```powershell
Set-Location D:\projects\pbl6\Wolfari-backend
corepack.cmd pnpm infra:up
corepack.cmd pnpm db:migrate
corepack.cmd pnpm dev
```

`db:migrate` chỉ áp dụng migration còn thiếu; hữu ích sau khi cập nhật source.
`dev` tự build workspace rồi chạy 7 ứng dụng NestJS và theo dõi thay đổi source.
Chờ build và các service khởi động xong; **giữ terminal này mở**.

### Terminal 2 — Kiểm tra backend rồi mở cầu nối LAN

```powershell
Set-Location D:\projects\pbl6\Wolfari-backend
corepack.cmd pnpm dev:check
Invoke-RestMethod http://127.0.0.1:3000/health/ready

Set-Location ..\Wolfari-mobile
npm.cmd run dev:gateway
```

Chỉ mở cầu nối khi kiểm tra backend thành công. `dev:check` phải báo `PASS`;
readiness của Gateway trả `status: ok`. Readiness này kiểm tra Identity/Trip,
không chứng minh mọi tính năng và provider đã sẵn sàng.

Cầu nối in các địa chỉ `http://<IP>:3001/api/v1`; chọn IP Wi-Fi/LAN thực,
không chọn IP Docker/WSL/VPN. **Giữ terminal này mở**.

### Terminal 3 — Expo

```powershell
Set-Location D:\projects\pbl6\Wolfari-mobile
npm.cmd run start:go -- --clear
```

Quét QR code bằng Expo Go trên Android hoặc Camera trên iPhone.
Theo [hướng dẫn Expo hiện tại](https://docs.expo.dev/get-started/start-developing/),
Expo Go trên iPhone thật cần Expo CLI và Expo Go đăng nhập cùng tài khoản Expo;
nếu cần, chạy `npx.cmd expo login` trước khi khởi động Metro.
**Giữ terminal này mở**; lần chạy sau có thể bỏ `--clear` khi không cần xóa cache.

Nếu Windows hỏi quyền mạng cho Node.js, chỉ cho phép trên mạng **Private** đáng tin
cậy. Không tắt toàn bộ firewall; bảo đảm điện thoại truy cập được TCP `3001`
và cổng Metro đang dùng (`8081`, hoặc `8082` nếu đã đổi).

## 6. Kiểm tra trên máy mới và tạo tài khoản

1. Trên máy tính: `http://127.0.0.1:3000/health/ready` phải trả HTTP 200.
2. Trên máy tính: `http://127.0.0.1:3001/health/ready` cũng phải trả HTTP 200.
3. Trên trình duyệt **điện thoại**: mở `http://<IP-máy-tính>:3001/health/ready`.
   Nếu máy tính truy cập được mà điện thoại không được, kiểm tra LAN/firewall/VPN.
4. Mở app, chọn đăng ký tài khoản mới; đăng nhập, tạo chuyến đi rồi tải lại danh sách.
   Tài khoản máy cũ không tồn tại trên DB mới nếu chưa khôi phục dữ liệu.
5. Email local nằm ở [Mailpit](http://127.0.0.1:8025) trên **máy tính**, không gửi
   tới hộp thư thật. Mở link xác minh/reset trên máy tính: link local mặc định
   dùng `127.0.0.1`, không mở trực tiếp bằng địa chỉ đó trên điện thoại.

Kiểm tra API cơ bản từ terminal phụ tại mobile:

```powershell
npm.cmd run test:backend
```

Lệnh trên kiểm tra Gateway readiness và phản hồi `/me` khi chưa đăng nhập,
không tự tạo tài khoản. `.env.backend-test.local` **không bắt buộc để chạy app**.
Nếu muốn test đăng nhập, tự tạo file này tại mobile với tài khoản test đã đăng ký:

```dotenv
WOLFARI_TEST_API_URL=http://127.0.0.1:3000/api/v1
WOLFARI_TEST_EMAIL=your-test-account@example.com
WOLFARI_TEST_PASSWORD=replace-with-your-test-password
```

Sau đó chạy `npm.cmd run test:backend -- --auth`. Chỉ dùng tài khoản thử nghiệm.
Các cờ `--trips --seed-demo` có ghi dữ liệu thật lên backend; không cần cho lần
khởi động đầu. **Khám phá chuyến đi mẫu** trong app dùng dữ liệu giả riêng,
không phải bằng chứng app đã kết nối backend.

## 7. Địa chỉ API và lỗi thường gặp

| Tình huống | Cách xử lý |
| --- | --- |
| Điện thoại thật, Expo và backend cùng máy | Để `EXPO_PUBLIC_API_URL=` trống; chạy đủ 3 terminal. |
| Muốn chỉ định IP thủ công | Trong `.env.local`, đặt `EXPO_PUBLIC_API_URL=http://192.168.1.40:3001/api/v1`, thay IP bằng máy mới. Lấy IP từ `ipconfig` hoặc output cầu nối. |
| Backend ở máy A, Expo ở máy B | Chạy backend **và cầu nối** trên A; đặt API URL ở B thành `http://<IP-máy-A>:3001/api/v1`. Điện thoại phải truy cập được cả A lẫn B. |
| Android Emulator chuẩn của Android Studio | Có thể đặt `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api/v1` khi backend chạy trên host; không dùng địa chỉ này cho điện thoại thật. |
| Backend triển khai từ xa | Dùng `EXPO_PUBLIC_API_URL=https://<gateway>/api/v1`. Bản production bắt buộc HTTPS, không dùng cầu nối development. |
| `Network request failed` | Kiểm tra readiness trên máy tính rồi điện thoại, IP cũ, VPN, Wi-Fi guest/cách ly thiết bị, quyền Local Network trên iPhone và firewall. |
| `localhost`/`127.0.0.1` trên điện thoại | Đây là chính điện thoại, không phải máy chạy backend. Dùng IP LAN và cổng `3001`. |
| API URL không hợp lệ | URL phải kết thúc bằng `/api/v1`, không kèm thông tin đăng nhập/query/hash. |
| Gateway trả 503 | Xem log Terminal 1, chạy `db:status`, `db:migrate`, `dev:check`; đừng chỉ sửa IP mobile. |
| `EADDRINUSE` / port is already allocated | Kiểm tra tiến trình/container đang giữ cổng. Dừng đúng phiên cũ của mình, không kill/xóa hàng loạt. Metro có thể chạy `npm.cmd run start:go -- --clear --port 8082`. |
| PowerShell chặn `npm.ps1` / `corepack.ps1` | Dùng `npm.cmd`, `npx.cmd`, `corepack.cmd` như hướng dẫn, không cần nới ExecutionPolicy toàn máy. |
| Lỗi native module / SDK không tương thích | Cài Expo Go đúng SDK 58, đóng/mở lại app, chạy lại Metro với `--clear`. APK/development client cũ cần build lại; reload JS không cập nhật native modules. |
| `28P01` / password authentication failed | Credential `.env` lệch DB volume cũ; khôi phục/đồng bộ đúng cấu hình. Không xóa volume để thử sửa lỗi. |
| Tìm địa điểm, thanh toán/provider chưa hoạt động | Khởi động thành công không có nghĩa provider đã cấu hình. Kiểm tra tài liệu module/backend và cấu hình riêng; không mang khóa dịch vụ vào mobile. |

Sau khi đổi `.env.local`, reload toàn bộ app; nếu cần dừng Metro và chạy lại
`npm.cmd run start:go -- --clear`. Nếu đổi `.env` backend, restart Terminal 1.
Khi chuyển Wi-Fi, địa chỉ IP có thể đổi.

`npm.cmd run start:tunnel` chỉ tunnel **Metro**, không tunnel backend API.
Nó không tự sửa lỗi điện thoại không truy cập được cổng `3001`.
Cầu nối mở API ra LAN: chỉ chạy trên mạng tin cậy, không port-forward ra Internet.

## 8. Dừng và chạy lại an toàn

- Nhấn `Ctrl+C` ở Terminal 3 (Expo), Terminal 2 (cầu nối), Terminal 1 (backend).
- Sau đó, tại backend:

  ```powershell
  corepack.cmd pnpm infra:down
  ```

- `infra:down` giữ Docker volumes, nên tài khoản/chuyến đi/file vẫn còn khi chạy lại.
  Không dùng `docker compose down -v` hoặc xóa volume nếu cần giữ dữ liệu.
- Lần sau chỉ cần mở Docker Desktop và làm lại **mục 5**. Không cần sinh lại secret.
- Sau khi lấy source mới: chạy lại `corepack.cmd pnpm install --frozen-lockfile`
  tại backend và `npm.cmd ci` tại mobile nếu dependencies/lockfile đổi; chạy
  `db:migrate` trước backend. Khi SDK/native dependencies đổi, kiểm tra lại Expo Go
  hoặc build lại native client theo [ghi chú SDK 58](sdk-58-upgrade.md).

Chi tiết thêm: [Expo Go và xử lý mạng](expo-go.md),
[phạm vi API mobile](mobile-api.md). Ở repository backend, xem
`docs/architecture/development-environment.md` cho môi trường development.
Luồng `demo:init`/`demo:start` trong backend là profile demo riêng, có cổng và
credentials khác; **không trộn** với các lệnh development trong hướng dẫn này.
