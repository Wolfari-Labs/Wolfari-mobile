# Chuyến đi mẫu — giao diện trước, backend sau

Nhánh triển khai: `feat/mobile-trip-features`.

Từ trang chào hoặc trang Khám phá, chọn **Khám phá chuyến đi mẫu**. Có thể mở trực tiếp `/demo-trip` trên web; không cần đăng nhập hay chạy backend.

## Phạm vi giao diện

- Tổng quan: ảnh bìa, điểm đến, ngân sách, số người dự kiến, nhóm nhân vật mẫu và tiến độ hành lý.
- Thông tin chuyến đi: sửa tên, điểm đến, ngân sách/người, phong cách, lời nhắn; đổi ảnh có sẵn hoặc chọn JPEG/PNG/WebP tối đa 5 MB / 40 MP. Ngày 12–14/11/2026 cố định để đồng nhất các hoạt động mẫu. Số người dự kiến không tạo membership.
- Hành lý: thêm/sửa/xóa có xác nhận, phân công cho nhân vật mẫu, đánh dấu chuẩn bị, lọc theo người/trạng thái/danh mục; tiến độ cập nhật trên tổng quan.
- Dress code: thêm/sửa/xóa, phạm vi cả chuyến/ngày/hoạt động, chọn bảng màu, ghi chú trang phục và lọc phạm vi.
- Quỹ: đóng góp, chi, hoàn tiền, khoản ngoài quỹ, lọc khoản chờ, xác nhận/hủy mô phỏng và lịch sử thao tác. Khoản mới chờ xử lý; khoản hoàn chờ giữ riêng tiền, chi không vượt khả dụng; thao tác xác nhận lặp không cộng/trừ hai lần. Khoản đã xử lý không sửa/xóa khỏi sổ mẫu.

## Ranh giới dữ liệu

`src/features/trip-demo/model.ts` chứa fixture và các chuyển trạng thái thuần. Provider riêng ở layout `/demo-trip` giữ dữ liệu trong bộ nhớ. Chuyển màn hình trong khu vực mẫu giữ thay đổi; tải lại trang, thoát layout hoặc đóng app sẽ khôi phục mẫu. Nút Đặt lại có xác nhận. Ảnh chọn chỉ được tham chiếu bằng URI trong phiên, không upload/lưu AsyncStorage. Object URL trên web được giải phóng khi bỏ ảnh nháp, thay ảnh đã lưu, đặt lại hoặc thoát khu vực mẫu; không xóa file ảnh trên thiết bị.

Màn hình sửa thông tin yêu cầu xác nhận trước khi bỏ thay đổi qua navigator, gồm nút quay lại và Back/cử chỉ native. Đóng tab, tải lại trang hoặc hệ điều hành dừng ứng dụng vẫn có thể làm mất bản nháp. Khi thoát từ tổng quan mẫu, nút quay lại trở về màn hình đã mở bản mẫu; nếu không có lịch sử thì về trang chào.

Không gọi API Trip/Finance, không tạo chuyến đi thật, không gửi lời mời, không chuyển tiền. SessionProvider gốc vẫn có thể thử khôi phục đăng nhập như trước nhưng không cản khu vực mẫu. Các thành viên, số dư và giao dịch đều hư cấu; xác nhận mô phỏng không chứng minh đã thanh toán. Không đưa luồng đọc VietQR thật vào sổ mẫu.

Các màn hình dữ liệu thật và bản nháp hiện tại được giữ nguyên. Đây là bản xem trước tương tác để duyệt giao diện, **không phải** triển khai đồng bộ backend. Khi nối backend cần API chính thức, kiểm tra quyền, version/idempotency, xử lý lỗi và tải lại; không dùng reducer mẫu làm sổ quỹ production.

## Kiểm tra

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
# Khởi động preview để tạo typed routes và chạy kiểm tra UI:
npx.cmd expo start --web --localhost --port 8082
npm.cmd run test:ui:demo
```

UI test chạy fixture anonymous và chặn API, kiểm tra thao tác cả bốn màn hình, dữ liệu giữ qua navigation, xác nhận/hủy, giữ/bỏ thay đổi, lưu tên đã chuẩn hóa, vòng đời ảnh bìa web, đặt lại, deep link và màn hình 320px. Unit test kiểm tra cả gửi lại khoản ở giới hạn 100 mục và từ chối mã/loại dữ liệu không hợp lệ. Ảnh kiểm tra ở `.cache/visual/trip-demo/`. Camera không được dùng. Chọn ảnh, bàn phím, nút Back Android, cử chỉ iOS và modal native vẫn cần kiểm tra trên thiết bị thật.
