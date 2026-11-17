# Quản lý chuyến đi, nhắc lịch, PDF và chứng từ

Triển khai ở mobile và backend trên `feat/mobile-integration-ci-cd`. Các phần này cần backend cùng phiên bản; không dùng kết quả HTTP fixture để xác nhận một backend cũ có API mới.

## Chức năng

### Quản lý chuyến đi

Mở **Cài đặt chuyến đi → Quản lý chuyến đi** bằng tài khoản chủ nhóm.

- **Lưu trữ:** kế hoạch chuyển sang chỉ xem, vẫn giữ thành viên và lịch sử. Có thể **Mở lại**.
- **Xóa:** ẩn chuyến đi đối với mọi thành viên bằng soft delete. Không xóa sổ quỹ hay audit. Nhập đúng tên chuyến đi và xác nhận trước khi gửi.
- **Chuyển chủ:** chọn một thành viên đang tham gia, có tài khoản ACTIVE. Chủ cũ trở thành thành viên; người giữ quỹ và tài khoản nhận tiền không đổi. Thu hồi các lời mời PENDING để quyền mời cũ không tiếp tục có hiệu lực.
- Lưu trữ/xóa chỉ khi không có quỹ hoặc quỹ đã CLOSED. Chuyển chủ bị chặn khi quỹ CLOSING hoặc có bàn giao người giữ quỹ chưa hoàn tất. Các lệnh đang xử lý, chờ phục hồi hoặc NEEDS_REVIEW cũng chặn thay đổi.
- Mỗi lệnh khóa Trip và kiểm tra cả ba revision. Finance chỉ đọc trạng thái quỹ khi Trip đang giữ khóa, không gọi ngược về Trip. Entity/revision/audit/outbox/receipt commit trong một transaction.
- Mất phản hồi: giữ mã yêu cầu; có thể gửi lại cùng nội dung/key hoặc tra cứu sau restart, kể cả sau xóa/chuyển chủ. Chỉ initiator được đọc receipt. Không xác nhận thành công từ timeout hay 404.

### Lịch nhắc cá nhân

Mở **Tiện ích → Lịch nhắc của tôi**. Chọn hoạt động có giờ bắt đầu hoặc vật dụng có hạn chuẩn bị, chọn giờ nhắc theo timezone chuyến đi. Mặc định nhắc trước 30 phút; giờ nhắc phải ở tương lai và không sau giờ nguồn.

- Lịch nhắc là của từng người; không thay lịch của cả nhóm. Tối đa 50 lịch đang chờ/người/chuyến. Danh sách hiển thị tối đa 100 mục mới nhất.
- Có thể hủy lịch chưa gửi. Tạo có UUID Idempotency-Key; retry cùng nội dung/key trả lại cùng lịch.
- Khi đến giờ, worker kiểm tra tài khoản, quyền Trip, trạng thái nguồn và thời điểm nguồn. Nguồn đổi giờ/hoàn thành/xóa, Trip lưu trữ hoặc mất quyền sẽ hủy lịch cũ khi xử lý. Cần đặt lịch mới cho giờ mới.
- Worker dùng claim lease và retry hữu hạn trong PostgreSQL; restart không mất hàng đợi. Tạo notification AVAILABLE và đánh dấu reminder SENT trong cùng transaction, có dedupe key.
- **Đã tạo thông báo** nghĩa là đã vào inbox. Không đồng nghĩa điện thoại đã nhận push. Push phụ thuộc cấu hình server, quyền hệ điều hành, thiết bị và tùy chọn thông báo.
- Phạm vi hiện tại là một lần cho hoạt động/hành lý. Chưa có lịch lặp, tự đặt lịch cho mọi thành viên hoặc nhắc trước ngày cho hoạt động chỉ có ngày mà chưa có giờ.

### Push

Worker đọc inbox AVAILABLE chưa đọc, tạo một delivery cho từng thiết bị iOS/Android đang hoạt động. Chỉ lấy notification trong 24 giờ gần nhất, tối đa 1.000 notification mỗi lượt quét. Kiểm tra lại thiết bị, account, quyền Trip và preference toàn cục/nhóm trước dispatch. Reminder còn kiểm tra lại nguồn.

Nội dung màn hình khóa chỉ là thông báo chung của Wolfari. Không gửi số tiền, tài khoản, ảnh chứng từ hoặc nội dung kế hoạch riêng qua push. Bấm reminder mở hành lý/lịch trình; các thông báo quỹ mở quỹ. Payload không được dùng làm URL tùy ý; API tiếp tục kiểm tra quyền.

Delivery đi qua hai bước: Expo **ticket** xác nhận nhận yêu cầu; Expo **receipt** báo trạng thái từ dịch vụ đích. Chỉ đánh dấu SENT sau receipt thành công, không chỉ từ HTTP 200/ticket. Đây vẫn chưa chứng minh điện thoại đã hiển thị thông báo. Lỗi tạm thời retry có giới hạn; token DeviceNotRegistered bị vô hiệu hóa; lỗi credentials không gửi lặp vô hạn. Kết nối bị mất ngay sau provider nhận có thể dẫn tới push lặp khi thử lại; inbox vẫn dedupe.

Email tài khoản/lời mời hiện có giữ luồng gửi riêng. Worker mới không thêm một hệ thống gửi email nhắc lịch.

### PDF và chứng từ

Mở **Tiện ích → Xuất kế hoạch PDF**. API tạo snapshot nhất quán của kế hoạch hiện tại: lịch trình, địa điểm gắn hoạt động, hành lý và dress code. Có font tiếng Việt, phiên bản kế hoạch, timezone và số trang. Không bao gồm sổ quỹ, token hoặc mã lưu trữ chứng từ.

PDF được tạo trực tiếp khi yêu cầu, không tạo URL công khai, không cần dịch vụ PDF bên ngoài hoặc Export Worker đang còn là nền cho các định dạng tương lai. Giới hạn 1.000 mục, snapshot 400.000 ký tự, tệp 10 MB và hai lần render đồng thời. Server kiểm tra membership lại sau render; header private/no-store.

Trong **Quỹ → Khoản chi → Xem chứng từ**, ảnh có thể xem inline; PDF mở bằng trình xem của thiết bị. Có nút tải/chia sẻ cả ảnh và PDF. Mỗi lần tải dùng `GET /expenses/:id/receipt` đã xác thực, kiểm tra quyền và file hiện hành ở backend. Không suy đoán object_key hoặc mở bucket công khai.

Web tải Blob của phản hồi đã xác thực. Native ghi vào cache riêng của ứng dụng để mở/chia sẻ; lần sử dụng tiếp theo dọn bản quá một giờ, hệ điều hành có thể dọn cache sớm hơn. Bản người dùng đã lưu/chia sẻ ra ngoài không thể thu hồi bằng thay đổi quyền trong app. Chức năng này hiện gắn với chứng từ khoản chi; không thêm API xem chứng từ đóng góp theo ID.

## Cấu hình bên ngoài

### Backend

1. Dùng Node 24 và pnpm được pin, cài dependency và build cả hai nhánh tương ứng.
2. Chạy `corepack.cmd pnpm env:init` để bổ sung cấu hình và secrets nội bộ; giữ nguyên giá trị đã có.
3. Khởi động hạ tầng local bằng `corepack.cmd pnpm infra:up` nếu chưa chạy, rồi chạy `corepack.cmd pnpm db:migrate`. Automation cần migration **V007**, đã có SHA trong manifest forward; không sửa baseline V001.
4. Trong `backend/apps/automation-service/.env`:

   ```dotenv
   REMINDER_WORKER_ENABLED=true
   PUSH_DELIVERY_ENABLED=false
   EXPO_PUSH_ACCESS_TOKEN=
   ```

   Chỉ bật `PUSH_DELIVERY_ENABLED=true` sau khi cấu hình native credentials và Expo enhanced push security. Đặt access token tương ứng trong `EXPO_PUSH_ACCESS_TOKEN` ở server. Đây là token dùng cho Expo Push API, không phải biến public của mobile. Worker bật nhưng thiếu token sẽ từ chối khởi động.

5. Khởi động lại Automation, Trip, Finance và Gateway. Automation phải chạy liên tục để lịch nhắc được xử lý. Hai worker mới polling PostgreSQL; các consumer inbox/outbox có sẵn vẫn cần RabbitMQ và cờ riêng. Lịch nhắc tạo trực tiếp inbox nên không phụ thuộc consumer RabbitMQ.
6. MinIO/S3 riêng và Finance receipt storage phải hoạt động để tải chứng từ. PDF kế hoạch xuất trực tiếp, không cần MinIO.

Các cờ mới mặc định false để cấu hình chưa đủ không gửi ra ngoài. Không tự bật shared Finance outbox/consumer; deployment cần duyệt các binding/consumer theo runbook hiện có. Nội bộ gRPC hiện vẫn giới hạn loopback và có guard TLS production của nền dự án; không triển khai nhiều máy qua mạng công khai bằng cách tắt guard đó.

### Android

1. Tạo/chọn Firebase project. Đăng ký Android app với package **`com.tanthanh_67.Wolfarimobile`**.
2. Tải `google-services.json` của app. Đặt biến **`GOOGLE_SERVICES_JSON`** là đường dẫn đến tệp: local dùng đường dẫn máy; Expo build environment preview dùng biến kiểu file. `app.config.ts` đọc đường dẫn và cấu hình `android.googleServicesFile`.
3. Tạo FCM v1 service account key và tải lên **Expo project → Credentials → Android → FCM V1**, hoặc dùng `npx.cmd eas-cli@latest credentials`. JSON này khác `google-services.json`; không đưa private key vào app hoặc Git.
4. Build lại app native sau cấu hình; không chỉ tải lại Metro. Cấp quyền thông báo và mở app để đăng ký thiết bị.

Tham khảo [Expo FCM v1 credentials](https://docs.expo.dev/push-notifications/fcm-credentials/) và [thiết lập push](https://docs.expo.dev/push-notifications/push-notifications-setup/).

### iOS

Cần Apple Developer team, bundle **`com.tan1custeam.wolfarimobile`**, APNs push key/credentials trong cùng Expo project, signing/provisioning phù hợp và build native. Dùng `npx.cmd eas-cli@latest credentials` để thiết lập với tài khoản có quyền. Kiểm thử trên thiết bị iOS có quyền nhận thông báo. Xem [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/).

### GitHub/Expo build

Giữ `EXPO_TOKEN` và Gateway HTTPS trong environment preview như [hướng dẫn CI/CD](integration-ci-cd.md). Thêm biến file `GOOGLE_SERVICES_JSON` cho environment Expo được dùng để build Android. `EXPO_PUSH_ACCESS_TOKEN` thuộc backend, không đặt vào biến `EXPO_PUBLIC_*` hoặc nội dung app config.

Đã thêm module native `expo-file-system` và `expo-sharing` bằng `expo install` cho SDK 58. App đang cài cần build lại để có module tương ứng. Chưa cấu hình submit App Store/Google Play hay phát hành OTA trong thay đổi này.

## Kiểm thử

```powershell
# Mobile
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
$env:EXPO_PUBLIC_API_URL = 'https://ci.invalid/api/v1'
$env:CI = '1'
npm.cmd run export:web
npm.cmd run test:ui:ci

# Backend, hạ tầng test tách biệt database development
corepack.cmd pnpm mobile:completion:test
corepack.cmd pnpm test
corepack.cmd pnpm lint
corepack.cmd pnpm contracts:check
```

URL `ci.invalid` chỉ dùng cho HTTP fixture, không dùng để build APK phát hành. CI mobile thêm suite `mobile-completion`; suite Finance kiểm tra tải ảnh/PDF và file mất. CI backend thêm `mobile-completion-integration` chạy Gateway, Identity, Trip, Finance, Automation và PostgreSQL thật. Chỉ Expo HTTP là fixture trong kiểm thử push. Cần kiểm tra nhận push thực tế, mở/chia sẻ tệp native và giao diện trên Android/iOS sau khi có credentials; không đánh đồng web export với build APK/IPA.
