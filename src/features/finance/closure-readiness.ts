import type { ClosureBlockerKind, ClosureReadiness } from "./types";

export type ChecklistTarget = "contribution-requests" | "expenses" | "refunds" | "handovers" | "fund-tools";
export type ChecklistItem = {
  kind: ClosureBlockerKind;
  title: string;
  action: string;
  owner: string;
  target: ChecklistTarget;
  targetLabel: string;
};

const groupVnd = (raw: string) => `${raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".")} ₫`;

/** One line per server rule: what is open, who resolves it, where to go. Order follows the server. */
export function closureChecklist(readiness: ClosureReadiness): ChecklistItem[] {
  return readiness.blockers.map(({ kind, count }) => {
    switch (kind) {
      case "CONTRIBUTIONS_OPEN":
        return {
          kind,
          title: `${count} khoản góp chưa hoàn tất`,
          action:
            "Từng thành viên phải góp đủ và được người giữ quỹ xác nhận đã nhận. Khoản không góp nữa thì chủ nhóm miễn hoặc hủy riêng khoản đó, kèm lý do.",
          owner: "Thành viên, người giữ quỹ, chủ nhóm",
          target: "contribution-requests",
          targetLabel: "Mở Đợt góp",
        };
      case "PAYMENTS_OPEN":
        return {
          kind,
          title: `${count} lần thanh toán MoMo chưa có kết quả`,
          action: "Chờ MoMo trả kết quả, hoặc người giữ quỹ đối soát lần thanh toán trong Công cụ quỹ mở rộng.",
          owner: "Người giữ quỹ",
          target: "fund-tools",
          targetLabel: "Mở công cụ đối soát",
        };
      case "PAYMENT_WEBHOOKS_OPEN":
        return {
          kind,
          title: `${count} thông báo thanh toán cần đối soát`,
          action: "Người giữ quỹ xem và xử lý các thông báo thanh toán còn treo.",
          owner: "Người giữ quỹ",
          target: "fund-tools",
          targetLabel: "Mở công cụ đối soát",
        };
      case "EXPENSES_OPEN":
        return {
          kind,
          title: `${count} khoản chi còn nháp hoặc chờ duyệt`,
          action: "Người tạo gửi duyệt hoặc xóa bản nháp; người giữ quỹ xác nhận hoặc từ chối khoản đã gửi.",
          owner: "Người tạo khoản chi, người giữ quỹ",
          target: "expenses",
          targetLabel: "Mở Khoản chi",
        };
      case "REFUNDS_OPEN":
        return {
          kind,
          title: `${count} khoản hoàn tiền chưa xong`,
          action: "Người giữ quỹ báo đã hoàn; người nhận (hoặc người kiểm chứng) xác nhận đã nhận đủ.",
          owner: "Người giữ quỹ, người nhận hoàn",
          target: "refunds",
          targetLabel: "Mở Hoàn tiền",
        };
      case "HOLDER_HANDOVER_OPEN":
        return {
          kind,
          title: "Đang bàn giao người giữ quỹ",
          action: "Hai bên hoàn tất bàn giao, hoặc chủ nhóm hủy bàn giao trước khi chốt.",
          owner: "Người giữ quỹ cũ và mới, chủ nhóm",
          target: "handovers",
          targetLabel: "Mở Bàn giao",
        };
      case "BALANCE_NOT_ZERO":
        return {
          kind,
          title: readiness.current_balance === "0" ? "Sổ quỹ chưa cân" : `Quỹ còn ${groupVnd(readiness.current_balance)}`,
          action: "Ghi các khoản chi còn lại hoặc tạo hoàn tiền cho thành viên để số dư về 0.",
          owner: "Chủ nhóm, người giữ quỹ",
          target: "refunds",
          targetLabel: "Mở Hoàn tiền",
        };
    }
  });
}
