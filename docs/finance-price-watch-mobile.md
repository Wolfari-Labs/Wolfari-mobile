# Finance và Price Watch trên mobile

Nhánh: `feature/mobile-finance-price-watch-api`. Chỉ sửa repo mobile; không merge,
thay schema hoặc thay chính sách backend. API được đối chiếu với mã nguồn Finance,
Gateway và OpenAPI trong Wolfari-backend; API162 đối chiếu với `origin/main`
`107d60b40993f6df2345ea8ca6732ff517403d59`.

## Phạm vi kết nối

| Màn hình | API / hành vi |
| --- | --- |
| Quỹ nhóm | API070–077: bật quỹ, đọc số dư/ngân sách/dự phòng/khả dụng, cập nhật ngân sách, nơi nhận tiền, người giữ quỹ xác nhận nơi nhận, sổ quỹ có phân trang |
| Đợt đóng / Đóng góp | API078–089: tạo phân bổ nhiều thành viên, sửa nội dung đợt/mức đóng, miễn/hủy/đảo, hướng dẫn VietQR TEST và mở ảnh QR sau thao tác người dùng (kiểm tra URL khớp hướng dẫn), báo chuyển/từ chối/báo lại/xác nhận; Owner không thay thế quyền Fund Holder |
| MoMo Sandbox | API090–092, API094–095: tạo/tra cứu lần thanh toán, mở đúng HTTPS test-payment.momo.vn sau thao tác người dùng, yêu cầu đối soát, đọc/xử lý ngoại lệ; webhook API093 là server-to-server, app không gọi |
| Khoản chi | API096–104: danh sách, tạo/sửa/xóa nháp, gửi duyệt/rút, Holder xác nhận/từ chối/đảo; xác nhận cần thời điểm và phương thức chi |
| Ảnh chứng từ | POST `/funds/:id/receipts`: chọn JPG/PNG <=10 MB, tải multipart và gắn object_key do server cấp vào khoản chi/báo chuyển. Không tự xác nhận tiền. App chưa cung cấp xem lại ảnh chứng từ của người khác: Expense DTO hiện chỉ có `receipt_available`, không có tham chiếu tải ảnh. Không đoán object_key hoặc mở bucket công khai |
| Ngoài quỹ | GET/POST `/funds/:id/notes`, PATCH/DELETE `/notes/:id`: tạo/sửa/xóa ghi chú, không tác động sổ quỹ |
| Hoàn tiền | API111–119: tạo dự phòng, Holder báo trả, người nhận xác nhận/chưa nhận, hủy hợp lệ, đề nghị/đồng ý/đảo hoàn; lý do đảo phải khớp lý do đề nghị |
| Chốt quỹ | API120–125: tạo bản chụp, đọc danh sách, xác nhận đúng hash, hủy và nhắc. Số dư phải bằng 0, không còn nghĩa vụ/đối soát chờ. `PENDING_CONFIRMATIONS` và từng `confirmed_at` được phân biệt |
| Lịch sử | API162 GET `/funds/:id/history`: metadata audit/phiên bản/lý do, có phân trang; không coi đây là toàn bộ giá trị lịch sử hoặc chứng từ |
| Theo dõi giá | API133–139: tạo, danh sách, sửa, tạm dừng/tiếp tục, DELETE để dừng, lịch sử giá. Chỉ người sở hữu watch được thao tác; luôn gửi expected_version |

Tiền là chuỗi số nguyên VND đến int64, không chuyển qua JavaScript Number.
Ngày/giờ truy vấn Price Watch dùng UTC theo contract. Giá `MOCK_FLIGHT` là mô phỏng
từ backend; không phải dữ liệu đơn vị được ghim sẵn hoặc giá vé để mua. Nhóm truy
vấn, yêu cầu của người dùng, quan sát giá và cảnh báo gần nhất là các khái niệm
khác nhau. App không tự áp dụng quy tắc 5%/24 giờ để phát cảnh báo; backend quyết định.

`meta.stale` và `meta.last_error` được đọc riêng. Khi nguồn lỗi, giá cũ và thời điểm
vẫn được giữ và gắn nhãn; giá cũ không được tô như một giá mới dưới ngưỡng. Không có
quan sát không có nghĩa là giá bằng 0. Lọc danh sách áp dụng trên các trang đã tải.

## Một màn quỹ chính (07/11/2026)

`/trip/:id/fund` là nơi duy nhất cho nghiệp vụ hằng ngày: mở quỹ, ngân sách, tài
khoản nhận VietQR, đợt góp (tạo/sửa tên, ghi chú, hạn đóng), đóng góp, khoản chi,
hoàn tiền, sổ quỹ, chốt quỹ và **Quét QR thanh toán**. **Công cụ quỹ mở rộng**
(`/trip/:id/fund-tools`) chỉ còn các phần màn chính không có: ghi chú ngoài quỹ,
lịch sử kiểm toán (nhãn tiếng Việt, tên người thực hiện), MoMo Sandbox (nơi nhận
và lần thanh toán) và đối soát. Không còn hai nơi thao tác cùng một khoản tiền.
Bản nháp riêng dùng `/trip/:id/fund-drafts`, không ghi vào sổ quỹ.

Tài khoản nhận VietQR được kiểm tra theo đúng danh mục ngân hàng của backend
(`src/features/finance/vietqr-banks.ts`, nhận mã như `VCB` hoặc BIN `970436`) và
số tài khoản 1–19 chữ/số — giới hạn để backend phát hành được QR (sai sẽ là 409).
Chủ nhóm có thể **quét/dán VietQR nhận tiền** của người giữ quỹ để điền sẵn ngân
hàng, số tài khoản và tên; tên trong QR chưa được ngân hàng xác minh. Người giữ quỹ
vẫn phải tự xác nhận tài khoản trước khi tạo đợt góp.

Các màn quỹ và quản lý thành viên dùng chung khóa thao tác theo Gateway/tài
khoản/Trip. API Price Watch cũng đi qua client kiểm tra đúng phiên đăng nhập.

## Mất phản hồi và phiên bản cũ

Finance lưu mã tra cứu tối thiểu trước khi gửi, không lưu nội dung ngân hàng,
số tiền hoặc chứng từ xuống thiết bị. Trong phiên hiện tại có thể gửi lại nguyên
body/key; sau khởi động lại chỉ tra cứu kết quả, không tự gửi giao dịch mới.
`202`, `PENDING_RECOVERY`, `NEEDS_REVIEW` không phải thành công. Lỗi lưu trữ chặn
ghi; sau kết quả cuối cần đối chiếu/tải lại trước khi mở khóa.

Price Watch giữ nhật ký body/key riêng: SecureStore chia nhỏ dữ liệu trên native,
sessionStorage trên Web. Nhật ký không chứa token; không dùng để thay thế cơ chế
khóa Finance/thành viên.

Price Watch chỉ idempotent ở API tạo; cập nhật dùng expected_version. Sau mất phản
hồi rồi 409, người dùng tải lại/đối chiếu danh sách trước khi đóng yêu cầu cũ.
Thao tác đóng nhật ký này không được thông báo thành công như một ghi nhận từ server.

## Kiểm chứng và cách chạy lại

Kiểm chứng bản merge ngày 05/11/2026: typecheck, lint, kiểm tra phiên bản SDK,
150/150 unit tests và export Android/iOS/Web đều đạt. Bảy bộ UI (auth, trips,
finance, finance-price-watch, backend-features, mobile-parity, design-D) đạt trên
bản export `.cache/merge-verified` với HTTP fixtures. Đã xem ảnh sổ quỹ và giá cũ.
Không chạy ghi dữ liệu lên backend thật, chuyển tiền hoặc thử thiết bị vật lý.

Web hiện dùng `output: single`, `asyncRoutes.web: false`; máy chủ phục vụ export
phải fallback các deep link về `index.html`. `expo serve` không fallback trong
lượt kiểm tra này nên trả 404 cho `/trip/...`; dùng máy chủ SPA local để kiểm thử
export, hoặc khởi động Expo Web như bên dưới để chạy lại fixtures.

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
# Terminal riêng, endpoint giả lập; không dùng cho deployment thật:
$env:EXPO_PUBLIC_API_URL='https://api.wolfari.test/api/v1'
npx.cmd expo start --web --port 8082
# Trong terminal chạy test:
$env:WOLFARI_PREVIEW_URL='http://localhost:8082'
npm.cmd run test:ui
npm.cmd run test:ui:trips
npm.cmd run test:ui:features
npm.cmd run test:ui:order
npm.cmd run test:ui:finance
npm.cmd run test:ui:finance-price-watch
npm.cmd run test:ui:parity
```

`test:ui:finance` kiểm tra màn quỹ chính và phục hồi mã thao tác.
`test:ui:finance-price-watch` chặn mọi API bằng HTTP fixtures: Owner/Holder, báo/từ chối/báo
lại, mất phản hồi + gửi lại cùng key + tải lại mã tra cứu, 500.000 VND/2 IN, nháp chi,
ngoài quỹ, tạo/sửa/tạm dừng/tiếp tục/dừng watch, giá cũ. Đây là giao diện React Native
chạy qua Expo Web, không phải bằng chứng trên iPhone/Android thật.

```powershell
# Chỉ chạy trên backend DEMO local đã khởi động; tạo Trip thử nghiệm mới.
$env:WOLFARI_MOBILE_ACCEPTANCE='1'
$env:WOLFARI_DEMO_ACCOUNTS='D:\Wolfari\.local\demo\seed.json'
$env:WOLFARI_API_URL='http://127.0.0.1:13000/api/v1'
npm.cmd run test:backend:finance
```

Script dùng chính API factory của mobile với tài khoản demo, không in mật khẩu,
token hay liên kết mời. Nó để lại Trip có nhãn Mobile acceptance để đối chiếu,
không xóa dữ liệu. Mốc 500.000 VND/2 IN được kiểm tra trước các bài chi/hoàn/chốt
tiếp theo. Quỹ cuối bài đã đóng với số dư 0; không nhầm hai mốc này.

Kết quả local ngày 04/11/2026 trên Expo SDK 58: typecheck và lint đạt; 79/79 unit
đạt; Expo Doctor 20/20 đạt, dependency check khớp SDK. Cả 6 suite UI đạt:
auth, trips, backend-features, order, mobile-parity (có VietQR), finance-price-watch.
`expo export --platform all` đạt với mã cuối cho iOS, Android và Web. Đây là xuất
bundle JavaScript/Hermes và tài nguyên, không phải IPA/APK đã ký hay thử điện thoại.
UI dùng HTTP fixtures và biên camera giả, không tính thành lượt kiểm thử vật lý.
API thật đã kiểm tra quỹ/chi/ngoài quỹ/hoàn/chốt và vòng đời/gom truy vấn Price Watch.
Backend demo đang ở nhánh `feature/finance-price-watch-demo` cũ: API162 trả 404,
được ghi là giới hạn, không tính Passed. MoMo demo mặc định disabled; chưa nghiệm
thu kết nối provider Sandbox thật.

Các lượt đầu đã ghi nhận lỗi Metro HTML renderer và lỗi test bấm/chụp trước khi
route mới sẵn sàng. Preview mobile chuyển sang SPA; test đợi tab/màn hình đích,
giữ nguyên assertions. Các kết quả đạt ở trên là lượt chạy lại sau sửa. Log cũ
không được chuyển thành Passed hoặc dùng làm bằng chứng trên thiết bị.

Chưa thực thi vật lý: iPhone/Android, camera permission native, picker ảnh iOS,
khôi phục SecureStore sau kill process. Chạy theo [hướng dẫn iPhone](iphone-finance-demo.md).
Kết quả iOS không thay AND01–AND05 trong báo cáo yêu cầu Android.
