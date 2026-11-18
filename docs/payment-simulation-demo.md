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

Người giữ quỹ có thể dùng **Quét QR thanh toán → Chọn ứng dụng thanh toán → Mô phỏng trong app**. Lượt này chỉ xem kết quả thử; không tự ghi chi hoặc thay đổi số dư quỹ trên máy chủ. Dùng quỹ mẫu ở trên khi muốn demo cả thay đổi số dư và lịch sử.

Dữ liệu quỹ mẫu chỉ tồn tại trong phiên demo. Tải lại trang/khởi động lại app hoặc đặt lại dữ liệu mẫu sẽ khôi phục dữ liệu ban đầu. Giao diện luôn ghi rõ mô phỏng. Không có yêu cầu API tài chính, webhook, mở ngân hàng hoặc ví thật từ luồng mẫu.

## Kiểm chứng

`npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd test` và UI suite `node scripts/check-ui.mjs payment-simulation` sau khi export web. UI kiểm tra góp quỹ, thất bại/thử lại, điền sẵn từ QR, thu/chi và lịch sử, tránh ghi trùng, thiếu số dư, reset, màn 320px và không gọi Finance API/mở ví ngoài.
