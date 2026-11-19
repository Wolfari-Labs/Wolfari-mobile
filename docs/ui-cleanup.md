# Giao diện gọn hơn — 18/11/2026

- Quét QR: gộp người nhận/ngân hàng/tài khoản, thu gọn mã hóa đơn và tham chiếu; danh sách chọn ngân hàng/ví thành các hàng radio, không lặp nhiều thẻ và cảnh báo. Chỉ hiển thị lỗi cần xử lý. Chế độ MoMo Test và việc gửi thông tin qua VietQR vẫn được nêu tại hành động liên quan.
- Tiện ích và tài khoản: các mục thành danh sách nhóm, bỏ câu giới thiệu lặp lại; email đã xác minh không còn hiện thêm mục yêu cầu xác minh.
- Quỹ: gộp danh sách khoản góp vào **Đợt góp**, gồm tiến độ, QR của chính người góp và thao tác của Owner/Holder/Self theo quyền backend. Nút **Góp quỹ** ở tổng quan mở thẳng tab này. Các xác nhận góp/chi/hoàn tiền và bàn giao chỉ có một sheet, hiện sẵn thông tin cần đối chiếu và nút hành động cụ thể. Chốt quỹ xác nhận ngay trên bản chốt; tùy chọn nhắc/hủy được thu gọn. Kết quả đã thành công tự cập nhật số liệu, không bắt bấm tải lại. Yêu cầu chưa rõ kết quả vẫn được giữ để kiểm tra, tránh gửi trùng. Mở quỹ, sửa tài khoản nhận và tạo yêu cầu góp/hoàn tiền vẫn có bước xem lại dữ liệu.
- Thông báo lưu thành công là dòng ngắn. Lỗi vẫn hiện rõ tại vị trí thao tác.
- Thuật ngữ quỹ: **Góp quỹ** là đóng tiền, **Chốt quỹ** là kết thúc thu/chi. Nút Góp quỹ ở tổng quan dành cho cả chủ nhóm, người giữ quỹ và thành viên khi quỹ mở. Đổi nhãn thao tác kết thúc từ “Đóng quỹ” thành “Chốt quỹ” để tránh nhầm.
- Bỏ popup xác nhận đăng xuất và chúc mừng hành lý; giữ xác nhận xóa, rời nhóm, thay bản đang sửa hoặc các hành động có hậu quả.
- Bản nháp, địa điểm, lịch nhắc, xuất PDF và điều kiện rời nhóm có mô tả ngắn; giải thích phụ mở ngay trong trang khi cần.
- Xác thực email: hướng dẫn mở thư trên điện thoại là luồng chính, dán token/liên kết chỉ là cách dự phòng. Kiểm tra trạng thái xác minh đọc từ server, không tự sửa trạng thái. Mailpit chỉ hiện khi được cấu hình rõ trên bản development. Xem [Gmail thử nghiệm](email-gmail.md).

Các thay đổi giao diện không xác nhận thanh toán hoặc tự sửa số dư. Chưa gửi email qua Gmail thật khi chưa có thông tin SMTP của người dùng.
