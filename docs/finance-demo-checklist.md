# Kiểm thử đầy đủ luồng quỹ trên app

Checklist thao tác bằng tay trên một chuyến đi **DEMO QUỸ** riêng. Các bước ghi sổ dưới đây dùng số liệu mô phỏng; không cần thực hiện chuyển khoản ngân hàng. Không dùng chuyến đi đang quản lý tiền thực tế để mô phỏng các xác nhận thu/chi.

**Góp quỹ** là đóng tiền vào quỹ: mở **Đợt góp**, dùng khoản được phân cho mình và báo đã chuyển. Chủ nhóm muốn tự góp cũng phải chọn chính mình khi tạo đợt. **Chốt quỹ** là kết thúc thu/chi và giữ lịch sử; trước đây giao diện gọi là “Đóng quỹ”, dễ nhầm với đóng tiền. Quỹ đã chốt không nhận khoản góp mới.

## Môi trường hiện tại — 18/11/2026

- Docker chạy PostgreSQL, RabbitMQ, MinIO và Mailpit. Chưa có image/container cho 7 service backend.
- Gateway, Identity, Trip, Finance, Travel, Automation và Export Worker chạy Node trên máy qua launcher dev. Code Finance mới đã build và tải lại; Gateway/Finance đang sẵn sàng.
- Điện thoại cùng Wi-Fi, API qua bridge `http://192.168.1.9:3001/api/v1`. IP LAN có thể đổi khi chuyển mạng.
- Gmail SMTP đã kết nối. Người dùng cần xác minh email trước khi bắt đầu các ca nghiệp vụ.
- MoMo trong `backend/apps/finance-service/.env` vẫn `disabled`, thiếu bộ khóa và callback HTTPS thực. Chưa đủ điều kiện kiểm thử MoMo Test trên điện thoại.

Các service hiện đã chạy. Reload app để nhận giao diện mới. Có thể kiểm tra backend từ thư mục `backend`:

```powershell
corepack.cmd pnpm dev:check
```

## Ba tài khoản

| Tài khoản | Vai trò ban đầu |
| --- | --- |
| A | Chủ nhóm, không giữ quỹ |
| B | Thành viên được chỉ định giữ quỹ |
| C | Thành viên góp quỹ và đề nghị chi |

Cả ba đã xác minh email và tham gia cùng chuyến đi. Có thể dùng nhiều máy hoặc lần lượt đăng xuất/đăng nhập; luôn đợi thao tác hoàn tất trước khi đổi tài khoản.

## Luồng chính

| Bước | Người thao tác | Thao tác trên app | Kết quả cần thấy |
| --- | --- | --- | --- |
| 1 | A | Tạo chuyến **DEMO QUỸ**, mời B và C; B/C chấp nhận lời mời | Danh sách có đủ ba người đang tham gia |
| 2 | A | Tiện ích → Quỹ nhóm → **Mở quỹ nhóm**; chọn B giữ quỹ, nhập tài khoản nhận và ngân sách dự kiến | Quỹ OPEN, số dư **0đ**; ngân sách không tự nạp tiền |
| 3 | B | Vào quỹ → **Xác nhận tài khoản nhận** | Tài khoản nhận đã xác nhận; B thấy **Quét QR thanh toán**; A/C không thấy scanner chi |
| 4 | A | Tab **Đợt góp** → **Tạo đợt góp**, chỉ chọn C, nhập **200000** | Một đợt cùng khoản góp của C đang chờ; số dư **0đ** |
| 5 | C | **Đợt góp → khoản đóng của bạn → Xem QR góp quỹ**; đối chiếu số tiền, tài khoản, nội dung; đóng sheet rồi **Báo đã chuyển tiền** | Hiển thị chờ người giữ quỹ; số dư vẫn **0đ** |
| 6 | B | Mở khoản của C → **Xác nhận đã nhận đủ**, đối chiếu số tiền/người góp rồi bấm nút cùng tên trong sheet | Khoản góp CONFIRMED, số dư tự cập nhật **200.000đ**; lịch sử có một thu 200.000đ |
| 7 | C | Khoản chi → **Tạo khoản chi**: “Bữa tối”, **80000** → **Lưu khoản chi** → **Gửi duyệt khoản chi** | Chờ duyệt; số dư vẫn **200.000đ** |
| 8 | B | **Xác nhận đã chi**, điền ngày/giờ và hình thức chi của ca mô phỏng | Khoản chi CONFIRMED, số dư **120.000đ**; có đúng một chi 80.000đ |
| 9 | A | Hoàn tiền → **Tạo hoàn tiền**, chọn C, **120000**, lý do “Hoàn quỹ demo” | Số dư **120.000đ**, giữ chỗ **120.000đ**, khả dụng **0đ** |
| 10 | B rồi C | B **Báo đã hoàn tiền**; C **Xác nhận đã nhận đủ** | Chỉ sau C xác nhận, số dư/giữ chỗ/khả dụng cùng về **0đ** |
| 11 | A, C, B | A đề cử C giữ quỹ; C **Đồng ý nhận giữ quỹ**; B/C cùng xác nhận bản chốt | C thành người giữ quỹ, B mất quyền chi; số dư vẫn **0đ**, không phát sinh ledger do bàn giao |
| 12 | A rồi C | Kiểm tra tài khoản nhận cũ đã bị tắt/chưa xác nhận; A thêm tài khoản nhận của C, C xác nhận | Chỉ C có quyền xác nhận tài khoản mới; A vẫn là người cấu hình |
| 13 | A rồi cả nhóm | Chốt quỹ → **Yêu cầu chốt quỹ**; A/B/C lần lượt xem và **Xác nhận bản chốt này** | Quỹ CLOSING rồi CLOSED sau người cuối; mọi người chỉ đọc lịch sử |

Sau cùng phải có đúng ba bút toán nghiệp vụ của luồng chính: **thu 200.000đ, chi 80.000đ, hoàn 120.000đ**. Số dư cuối bằng **0đ**. Tải lại app vẫn thấy đúng dữ liệu. C không còn scanner chi khi quỹ CLOSED.

Chỉ có tab **Đợt góp** cho cả quản lý đợt và các khoản góp bên trong. Có thể dùng một đợt cho cả nhóm, hoặc tạo thêm khi cần thu bổ sung; mỗi lần báo chuyển không tạo đợt mới. Quỹ đóng vẫn đọc được các đợt và khoản cũ, nhưng không còn nút tạo/góp/xác nhận tiền.

Nếu không chốt được, kiểm tra còn khoản góp chờ, đề nghị chi nháp/chờ duyệt, hoàn tiền chưa xác nhận, bàn giao chưa hoàn tất hoặc operation chưa rõ kết quả. Hoàn tất/hủy đúng luồng trước khi chốt; không chỉnh database để bỏ chặn.

Chủ nhóm cũng phải tự xác nhận bản chốt. Mở **Xem bản chốt** rồi bấm **Xác nhận bản chốt này** ngay tại đó; không mở thêm sheet xác nhận. Các xác nhận góp/chi/hoàn tiền chỉ có một sheet và nút hành động cụ thể, không qua **Tiếp tục**. Khi backend đã xác nhận thao tác thành công, app tự cập nhật quỹ; không cần bấm **Tải lại quỹ**. Yêu cầu chưa rõ kết quả vẫn được giữ để kiểm tra/thử lại cùng mã. Trong bản chốt, nhắc xác nhận và hủy phiên nằm ở **Tùy chọn chốt quỹ**.

## Các nhánh lỗi cần thử trước khi chốt quỹ

| Ca | Điều kiện đạt | Dọn dữ liệu thử |
| --- | --- | --- |
| C báo chuyển, B từ chối | Khoản trở lại PENDING, không tăng số dư; C xem lại QR và báo lại được | C báo lại, B xác nhận để tiếp tục luồng chính |
| B từ chối đề nghị chi | Không trừ tiền; khoản REJECTED giữ lịch sử | Tạo đề nghị mới để thử lại |
| Khoản chi vượt số dư khả dụng | Xác nhận bị từ chối, không có bút toán OUT | Người tạo rút đề nghị, xóa nháp trước khi chốt quỹ |
| C báo chưa nhận khoản hoàn | Không ghi chi hoàn tiền; phần giữ chỗ còn nguyên | A hủy khoản sau báo chưa nhận; tạo khoản hoàn mới nếu cần |
| Bấm lặp hoặc reload sau ghi nhận | Không thu/chi thêm lần hai | Đối chiếu lịch sử và số dư |
| Mất mạng giữa thao tác | Không tự báo thành công; có cách tra cứu/thử lại cùng yêu cầu | Đợi kết quả cuối rồi tải lại quỹ; không tạo yêu cầu thay thế khi chưa rõ |
| A/C thử thao tác chi trước bàn giao | Không có scanner chi/xác nhận chi; C vẫn có QR khoản góp của mình | Không cần dọn |
| Sau bàn giao B → C | B mất quyền chi, C có quyền dù role vẫn là MEMBER | Chỉ xác nhận bản chốt đúng phiên bản hiện tại |

## MoMo và chuyển khoản thực tế

Phần trên kiểm chứng nghiệp vụ và sổ quỹ, chưa chứng minh ngân hàng/ví đã chuyển tiền.

- **MoMo góp quỹ:** backend có API tạo payment attempt của chính người góp, callback và đối soát. Muốn kiểm thử trên điện thoại cần mode `remote`, khóa sandbox hợp lệ, callback HTTPS công khai và MoMo Test. Cần có khoản góp mang đích `MOMO_SANDBOX`; form tạo yêu cầu chính trên app hiện chỉ chọn VietQR, nên không tính luồng tạo khoản góp MoMo hoàn toàn bằng app là đã sẵn sàng.
- **Quét QR thanh toán → MoMo Test:** là checkout thử độc lập của người giữ quỹ. Không trả tiền vào tài khoản ngân hàng trong QR, không tạo khoản chi và không tăng/giảm số dư quỹ. Lỗi chưa cấu hình phải được ghi là **NOT RUN / thiếu điều kiện**, không ghi Passed.
- **QR góp quỹ VietQR:** dùng tài khoản ngân hàng thật. Chỉ xem QR không chứng minh đã chuyển tiền. Chạy ca ngân hàng thực tế riêng với thông tin và số tiền do người kiểm thử chủ động quyết định; chỉ xác nhận thu sau khi đối chiếu thực tế hoặc webhook ngân hàng hợp lệ.

## Kiểm thử tự động bổ sung

Mobile:

```powershell
npm.cmd run test:app
```

Backend, với Docker Desktop đang chạy:

```powershell
corepack.cmd pnpm finance:test
corepack.cmd pnpm finance:payments:test
```

Các integration harness này tạo hạ tầng/database kiểm thử cô lập và dùng provider mock; không trỏ fixture vào database development. Chúng không thay thế việc nghiệm thu MoMo Test/ngân hàng thật.

Đối chiếu quyền: [finance-permissions.md](finance-permissions.md). Cấu hình QR/MoMo: [payment-qr.md](payment-qr.md).
