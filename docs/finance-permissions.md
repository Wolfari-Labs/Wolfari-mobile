# Đối chiếu quyền quỹ với backend

Nguồn: nhóm `backend/docs/architecture/finance-*.md` và các kiểm tra quyền tương ứng trong Finance service. Owner, Holder và Self là ba vai trò độc lập; một người có thể giữ nhiều vai trò.

| Chức năng | Quyền |
| --- | --- |
| Mở quỹ, cấu hình nơi nhận, ngân sách, tạo/quản lý đợt góp | Chủ nhóm đang tham gia |
| Xác nhận tài khoản nhận tiền | Người giữ quỹ hiện tại |
| Xem QR góp quỹ | Chính người được phân khoản góp, khi khoản PENDING, đợt góp/quỹ OPEN và không có khóa thanh toán/chốt quỹ |
| Báo đã chuyển tiền hoặc tạo thanh toán MoMo cho khoản góp | Chính người góp; Owner/Holder không thực hiện thay người khác |
| Xác nhận nhận đủ khoản góp | Người giữ quỹ hiện tại |
| Tạo đề nghị chi | Thành viên đang tham gia; sửa/gửi nháp theo quyền người tạo hoặc chủ nhóm |
| Xác nhận, từ chối hoặc đảo khoản chi | Người giữ quỹ hiện tại |
| Xem lịch sử quỹ | Thành viên còn quyền đọc chuyến đi |
| Tạo hoàn tiền / báo đã hoàn | Chủ nhóm tạo; người giữ quỹ báo trả; người nhận hoặc người kiểm chứng độc lập xác nhận theo quy tắc Refund |
| Bàn giao người giữ quỹ | Chủ nhóm đề cử; người được đề cử đồng ý; hai bên xác nhận bản chốt |
| Khởi tạo chốt quỹ / xác nhận bản chốt | Chủ nhóm khởi tạo; những người được ghi trong snapshot tự xác nhận |

## Hai luồng QR trên mobile

- **Góp quỹ:** nút **Góp quỹ** ở tổng quan mở tab **Đợt góp**, dành cho mọi vai trò khi quỹ đang mở, kể cả chủ nhóm và người giữ quỹ. Mỗi đợt chứa khoản của từng người; người góp mở **Xem QR góp quỹ** của chính mình ngay trong đợt. Chủ nhóm muốn tự góp phải chọn chính mình khi tạo đợt. Không có tab Góp quỹ riêng hoặc một bước tạo khoản khác. Sheet có tên **Góp quỹ bằng VietQR**. MoMo thanh toán khoản góp vẫn là quyền của chính người góp ở Công cụ quỹ mở rộng.
- **Quét QR thanh toán:** công cụ chi tiền bổ sung dành cho người giữ quỹ hiện tại khi quỹ OPEN, chuyến đi chưa lưu trữ và vẫn còn membership. Chủ nhóm không giữ quỹ không có quyền này; thành viên được bổ nhiệm giữ quỹ có quyền. Không đặt công cụ chi tiền trong bản nháp riêng hoặc khi chưa có quỹ.

Quyền của công cụ QR chi tiền được kiểm tra ở giao diện và API QR sandbox, kể cả khi thử lại checkout đã cache. Công cụ này không tự ghi Expense hoặc thay đổi số dư. Quy trình xác nhận khoản chi và các guard ghi sổ của backend được giữ nguyên.

## Tài liệu đối chiếu

- [Tạo đợt thu và các khoản góp — API078–084](../../backend/docs/architecture/finance-contribution-requests.md): Owner tạo một request cùng danh sách allocations; một transaction sinh request OPEN và các khoản PENDING. Mở quỹ không tự tạo đợt. Không bắt mở nhiều đợt, cũng không quy định phải tách hai tab. API079 trả đầy đủ allocations trong từng request, kể cả khi Fund CLOSING/CLOSED. Giao diện gộp đợt, tiến độ, QR và thao tác trên từng khoản trong **Đợt góp**.
- [VietQR của khoản góp — API086](../../backend/docs/architecture/finance-payment-instructions.md)
- [Báo chuyển và xác nhận nhận tiền — API087–089](../../backend/docs/architecture/finance-manual-contributions.md)
- [MoMo của khoản góp — API090–095](../../backend/docs/architecture/finance-payments.md)
- [Đề nghị và xác nhận chi — API096–104](../../backend/docs/architecture/finance-expenses.md)
- [Cấu hình quỹ và quyền xem tài khoản nhận](../../backend/docs/architecture/finance-fund-setup.md)
- [Hoàn tiền](../../backend/docs/architecture/finance-refunds.md)
- [Bàn giao người giữ quỹ](../../backend/docs/architecture/finance-holder-handover.md)
- [Chốt quỹ](../../backend/docs/architecture/finance-closures.md)

## Kiểm chứng

Test giao diện bao phủ thành viên thường còn QR góp quỹ nhưng không có scanner chi, Owner không giữ quỹ, Holder có role MEMBER, quỹ đóng/đang đóng, chuyến lưu trữ, chưa có quỹ và bản nháp riêng. Test backend bao phủ các quyền tương ứng, membership đã rời và cache checkout sau khi thay người giữ quỹ.
