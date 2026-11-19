# Demo góp quỹ và thanh toán không cần khóa

Luồng này miễn phí và chạy ngay trong Wolfari. Không cần MoMo Business, MoMo Test hoặc callback HTTPS. Đây là ví mô phỏng trong app, không mở MoMo bên ngoài.

## Góp quỹ và xem số dư mẫu

1. Tải lại app. Ở Trang chủ, chọn **Khám phá chuyến đi mẫu → Quỹ nhóm mẫu**. Hoặc trong quỹ nhóm hiện tại: **Công cụ và hướng dẫn → Thử thanh toán mô phỏng**.
2. Chọn **Góp quỹ mô phỏng**, người góp và số tiền, ví dụ `100000`.
3. Chọn **Tiếp tục góp quỹ mô phỏng → Xác nhận thanh toán mô phỏng**.
4. Đóng màn hình: số dư khả dụng mẫu tăng 100.000 ₫, có khoản **Góp quỹ qua ví mô phỏng** và lịch sử tương ứng.

## Quét QR và thanh toán mẫu

1. Trong quỹ mẫu, chọn **Quét QR thanh toán mô phỏng**.
2. Quét VietQR ngân hàng; hoặc **Dán nội dung QR** nếu không dùng được camera. Dùng chuỗi QR, không dùng đường dẫn hay ảnh.
3. Số tiền/nội dung có trong QR được điền sẵn; QR tĩnh cho phép nhập thêm.
4. Chọn **Chọn ứng dụng thanh toán → Xác nhận thanh toán mô phỏng**.
5. Đóng màn hình: số dư mẫu giảm theo số tiền, xuất hiện **Thanh toán QR mô phỏng**. Không lưu tài khoản nhận hoặc nội dung quét vào lịch sử mẫu.

Ví dụ: số dư mẫu ban đầu 3.300.000 ₫, góp 100.000 ₫ rồi chi 150.000 ₫ sẽ còn 3.250.000 ₫. Thử **Thử tình huống thất bại** để xem trạng thái thất bại, sau đó thử lại. Khoản chi vượt số dư khả dụng bị chặn và không tạo khoản dở dang.

## Quét từ quỹ trên máy chủ

Người giữ quỹ dùng **Quét QR thanh toán → Chọn ứng dụng thanh toán → Mô phỏng trong app**. Lần thanh toán đầu tạo **Sổ quỹ mô phỏng** riêng cho tài khoản và quỹ hiện tại, lấy số dư và khoản hoàn đang giữ chỗ làm mốc. Mỗi thanh toán thành công trừ khả dụng mô phỏng và lưu số tiền, nội dung chuyển khoản đã xem lại, thời điểm và mã lần thử. Số tài khoản/tên người nhận trong QR không được lưu. Quỹ trên máy chủ không đổi.

Đóng màn hình thanh toán để xem **Sổ quỹ mô phỏng → Lịch sử mô phỏng** ngay dưới phần quỹ. Mở lại trang/app vẫn còn lịch sử trên thiết bị này; tài khoản hoặc quỹ khác dùng sổ riêng. Dữ liệu hết hạn sau 30 ngày kể từ lần lưu cuối, tối đa 200 khoản. **Đặt lại sổ mô phỏng** xóa lịch sử thử trên thiết bị; lần thử tiếp theo lấy số dư quỹ hiện tại làm mốc mới. Thay đổi quỹ trên máy chủ sau khi bắt đầu không tự thay mốc mô phỏng.

Chỉ báo thanh toán thành công sau khi lưu sổ thành công. Lỗi lưu hoặc thiếu khả dụng không ghi khoản dở dang; thử lại giữ cùng mã thanh toán và không trừ lặp. Số dư mô phỏng được hiện trong màn thanh toán; số dư quỹ chính vẫn lấy từ máy chủ.

Dữ liệu **chuyến đi mẫu** chỉ tồn tại trong phiên demo. Tải lại trang/khởi động lại app hoặc đặt lại dữ liệu mẫu sẽ khôi phục dữ liệu ban đầu. Giao diện luôn ghi rõ mô phỏng. Không có lệnh ghi API tài chính, webhook, mở ngân hàng hoặc ví thật từ thao tác thanh toán mô phỏng.

## Kiểm chứng

`npm.cmd run lint`, `npm.cmd run typecheck`, các test `simulated-fund`, `trip-demo`, `payment-transfer` và UI suite `node scripts/check-ui.mjs finance payment-simulation` sau khi export web với `EXPO_PUBLIC_API_URL=https://ci.invalid/api/v1` chỉ dành cho fixture. UI kiểm tra góp quỹ, thất bại/thử lại, điền sẵn từ QR, thu/chi và lịch sử, tránh ghi trùng, thiếu số dư, lỗi lưu/thử lại, mở lại trang vẫn còn lịch sử, reset và màn 320px. Thanh toán mô phỏng không gửi lệnh ghi Finance hoặc mở ví ngoài.
