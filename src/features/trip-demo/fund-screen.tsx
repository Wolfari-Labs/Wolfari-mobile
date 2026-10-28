import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/feedback";
import { FormField } from "@/shared/ui/form-field";
import { EmptyState, Progress, Segments, ui } from "@/shared/ui/journal";
import { Sheet } from "@/shared/ui/sheet";
import {
  ConfirmSheet,
  DemoScreen,
  MemberBadge,
  MemberPicker,
  Stat,
  demoStyles as s,
} from "./components";
import {
  demoMembers,
  formatMoney,
  fundTotals,
  type DemoEntry,
  type EntryKind,
} from "./model";
import { useTripDemo } from "./provider";

const kinds: { value: EntryKind; label: string }[] = [
  { value: "contribution", label: "Đóng góp" },
  { value: "expense", label: "Khoản chi" },
  { value: "refund", label: "Hoàn tiền" },
  { value: "outside", label: "Ngoài quỹ" },
];
const statusLabels = {
  PENDING: "Chờ xử lý",
  CONFIRMED: "Đã ghi sổ mẫu",
  CANCELLED: "Đã hủy",
};
export default function DemoFundScreen() {
  const { state, send, nextId } = useTripDemo();
  const [tab, setTab] = useState("all");
  const [editing, setEditing] = useState<DemoEntry>();
  const [error, setError] = useState<string>();
  const [confirmError, setConfirmError] = useState<string>();
  const [review, setReview] = useState<{
    entry: DemoEntry;
    confirm: boolean;
  }>();
  const totals = fundTotals(state.entries);
  const pendingCount = state.entries.filter(
    (e) => e.status === "PENDING",
  ).length;
  const visible = state.entries
    .filter(
      (e) =>
        tab === "all" ||
        (tab === "pending" ? e.status === "PENDING" : e.kind === tab),
    )
    .slice()
    .reverse();
  const budget = Number(state.details.budget);
  function open() {
    setError(undefined);
    setEditing({
      id: nextId(),
      kind: kinds.some((k) => k.value === tab)
        ? (tab as EntryKind)
        : "contribution",
      title: "",
      amount: "",
      member: "mai",
      category: "Khác",
      date: "2026-11-12",
      note: "",
      status: "PENDING",
    });
  }
  function save() {
    if (!editing) return;
    const failure = send({ type: "entry.add", value: editing });
    setError(failure);
    if (!failure) {
      setEditing(undefined);
      setTab("pending");
    }
  }
  function resolve() {
    if (!review) return;
    const failure = send({
      type: review.confirm ? "entry.confirm" : "entry.cancel",
      id: review.entry.id,
    });
    setConfirmError(failure);
    if (!failure) setReview(undefined);
  }
  return (
    <DemoScreen
      title="Quỹ nhóm"
      footer={<Button label="Thêm khoản mẫu" icon="plus" onPress={open} />}
    >
      <Text style={s.eyebrow}>MINH BẠCH ĐỂ ĐI XA HƠN</Text>
      <View style={styles.balanceCard}>
        <View style={s.row}>
          <Text style={styles.balanceLabel}>KHẢ DỤNG MÔ PHỎNG</Text>
          <View style={styles.mockPill}>
            <Text style={styles.mockText}>DỮ LIỆU MẪU</Text>
          </View>
        </View>
        <Text accessibilityRole="header" style={styles.balance}>
          {formatMoney(totals.available)}
        </Text>
        <View style={styles.balanceDetails}>
          <Text style={styles.balanceFootnote}>
            Số dư sổ: {formatMoney(totals.balance)}
          </Text>
          <Text style={styles.balanceFootnote}>
            Dành để hoàn: {formatMoney(totals.reserved)}
          </Text>
        </View>
        <View style={styles.holder}>
          <Text style={styles.balanceFootnote}>Mai · Người giữ quỹ mẫu</Text>
          <Text style={styles.balanceFootnote}>Đang mở</Text>
        </View>
      </View>
      <Text style={typography.footnote}>
        Đây là sổ quỹ mô phỏng, không phải số dư ngân hàng. Không chuyển tiền,
        xác minh thanh toán hay gọi API tài chính.
      </Text>
      <View style={s.split}>
        <Stat
          label="Đã góp (mẫu)"
          value={formatMoney(totals.contributed)}
          accent
        />
        <Stat label="Đã chi (mẫu)" value={formatMoney(totals.spent)} />
      </View>
      <View style={ui.card}>
        <View style={s.row}>
          <Text style={[typography.headline, ui.flex]}>Mục tiêu quỹ</Text>
          <Text style={typography.headline}>
            {Math.round((totals.contributed / budget) * 100)}%
          </Text>
        </View>
        <Progress done={Math.min(totals.contributed, budget)} total={budget} />
        <Text style={typography.footnote}>
          {formatMoney(totals.contributed)} / {formatMoney(budget)} · Ngân sách
          cả chuyến
        </Text>
        <Text style={typography.footnote}>
          Chờ xác nhận đóng góp: {formatMoney(totals.pending)}
        </Text>
      </View>
      <Segments
        scroll
        value={tab}
        onChange={setTab}
        items={[
          { value: "all", label: "Tất cả" },
          { value: "pending", label: `Chờ xử lý (${pendingCount})` },
          ...kinds,
          { value: "history", label: "Lịch sử" },
        ]}
      />
      {tab === "contribution" && (
        <View style={ui.card}>
          <Text style={typography.headline}>Đóng góp của từng người</Text>
          {demoMembers.map((member) => (
            <View key={member.id} style={s.row}>
              <View style={ui.flex}>
                <MemberBadge id={member.id} />
              </View>
              <Text style={typography.headline}>
                {formatMoney(
                  state.entries
                    .filter(
                      (e) =>
                        e.kind === "contribution" &&
                        e.status === "CONFIRMED" &&
                        e.member === member.id,
                    )
                    .reduce((sum, e) => sum + Number(e.amount), 0),
                )}
              </Text>
            </View>
          ))}
        </View>
      )}
      {tab === "history" ? (
        <View style={ui.card}>
          <Text accessibilityRole="header" style={typography.section}>
            Dấu vết thao tác mẫu
          </Text>
          <Text style={typography.footnote}>
            Giữ lại các khoản đã xác nhận hoặc hủy, không xóa khỏi sổ mẫu.
          </Text>
          {state.history.map((event, index) => (
            <View key={event.id} style={styles.event}>
              <View style={styles.eventDot} />
              <View style={ui.flex}>
                <Text style={typography.body}>{event.text}</Text>
                <Text style={typography.footnote}>
                  Thao tác {state.history.length - index} · Phiên xem mẫu
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <>
          {visible.map((entry) => (
            <View key={entry.id} style={ui.card}>
              <View style={s.row}>
                <View style={ui.flex}>
                  <Text style={s.label}>
                    {kinds
                      .find((k) => k.value === entry.kind)
                      ?.label.toLocaleUpperCase("vi-VN")}
                  </Text>
                  <Text style={[typography.headline, { marginTop: 6 }]}>
                    {entry.title}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  typography.section,
                  {
                    color:
                      entry.kind === "contribution"
                        ? colors.tealPressed
                        : colors.ink,
                  },
                ]}
              >
                {entry.kind === "contribution"
                  ? "+ "
                  : entry.kind === "outside"
                    ? ""
                    : "− "}
                {formatMoney(entry.amount)}
              </Text>
              <View style={s.row}>
                <MemberBadge id={entry.member} />
                <Text style={typography.footnote}>
                  {entry.date.split("-").reverse().join("/")} · {entry.category}
                </Text>
              </View>
              <View
                style={[
                  s.pill,
                  {
                    backgroundColor:
                      entry.status === "PENDING"
                        ? colors.peach
                        : entry.status === "CANCELLED"
                          ? colors.fill
                          : colors.mint,
                  },
                ]}
              >
                <Text style={[s.label, { color: colors.ink }]}>
                  {statusLabels[entry.status]}
                </Text>
              </View>
              {!!entry.note && (
                <Text style={typography.footnote}>{entry.note}</Text>
              )}
              {entry.kind === "outside" && (
                <Text style={typography.footnote}>
                  Khoản cá nhân, không ảnh hưởng số dư quỹ.
                </Text>
              )}
              {entry.kind === "refund" && entry.status === "PENDING" && (
                <Text style={typography.footnote}>
                  Đã trừ khỏi khả dụng; số dư sổ chỉ giảm khi xác nhận mô phỏng.
                </Text>
              )}
              {entry.status === "PENDING" && (
                <View style={s.cardActions}>
                  <Button
                    label="Xem xét"
                    accessibilityLabel={`Xem xét ${entry.title}`}
                    variant="soft"
                    compact
                    onPress={() => {
                      setConfirmError(undefined);
                      setReview({ entry, confirm: true });
                    }}
                  />
                  <Button
                    label="Hủy khoản"
                    accessibilityLabel={`Hủy ${entry.title}`}
                    variant="soft"
                    compact
                    onPress={() => {
                      setConfirmError(undefined);
                      setReview({ entry, confirm: false });
                    }}
                  />
                </View>
              )}
            </View>
          ))}
          {!visible.length && (
            <EmptyState
              title="Chưa có khoản nào"
              message="Thêm một khoản mẫu hoặc đổi bộ lọc để thử các trạng thái của quỹ."
              icon="wallet"
            />
          )}
        </>
      )}
      <Sheet
        visible={!!editing}
        title="Thêm khoản vào quỹ mẫu"
        onClose={() => setEditing(undefined)}
      >
        {editing && (
          <>
            <Text style={typography.footnote}>
              Khoản mới sẽ chờ xử lý. Bạn xác nhận mô phỏng ở bước sau; chưa có
              giao dịch thực tế.
            </Text>
            <Segments
              scroll
              value={editing.kind}
              onChange={(kind) => setEditing({ ...editing, kind })}
              items={kinds}
            />
            <FormField
              label="Nội dung khoản"
              icon="edit"
              maxLength={200}
              value={editing.title}
              onChangeText={(title) => setEditing({ ...editing, title })}
              placeholder="Ví dụ: Góp quỹ đợt 2"
            />
            <FormField
              label="Số tiền (VND)"
              icon="wallet"
              keyboardType="number-pad"
              maxLength={12}
              value={editing.amount}
              onChangeText={(amount) => setEditing({ ...editing, amount })}
            />
            <MemberPicker
              label={
                editing.kind === "refund"
                  ? "Người nhận hoàn mẫu"
                  : editing.kind === "contribution"
                    ? "Người đóng góp mẫu"
                    : "Người chi mẫu"
              }
              value={editing.member}
              onChange={(member) => setEditing({ ...editing, member })}
            />
            <FormField
              label="Ngày ghi nhận (YYYY-MM-DD)"
              icon="calendar"
              maxLength={10}
              value={editing.date}
              onChangeText={(date) => setEditing({ ...editing, date })}
            />
            <Text style={typography.headline}>Danh mục</Text>
            <Segments
              scroll
              value={editing.category}
              onChange={(category) => setEditing({ ...editing, category })}
              items={[
                "Ăn uống",
                "Di chuyển",
                "Lưu trú",
                "Vé tham quan",
                "Khác",
              ].map((value) => ({ value, label: value }))}
            />
            <FormField
              label="Ghi chú khoản"
              icon="edit"
              multiline
              maxLength={500}
              value={editing.note}
              onChangeText={(note) => setEditing({ ...editing, note })}
            />
            {error && <Feedback message={error} />}
            <Button label="Thêm vào sổ mẫu" onPress={save} />
          </>
        )}
      </Sheet>
      <ConfirmSheet
        visible={!!review}
        title={review?.confirm ? "Xác nhận mô phỏng?" : "Hủy khoản mẫu?"}
        message={
          review
            ? `${review.entry.title} · ${formatMoney(review.entry.amount)}. ${review.confirm ? "Chỉ đổi trạng thái trong sổ quỹ mẫu. Đây không phải xác nhận nhận tiền, chi tiền hay chuyển khoản thực tế." : "Khoản này vẫn có trong lịch sử. Nếu là khoản hoàn đang chờ, số tiền dành riêng sẽ được trả về khả dụng mẫu."}`
            : ""
        }
        label={
          review?.confirm ? "Xác nhận trong bản mẫu" : "Xác nhận hủy khoản"
        }
        error={confirmError}
        destructive={!review?.confirm}
        onClose={() => setReview(undefined)}
        onConfirm={resolve}
      />
    </DemoScreen>
  );
}
const styles = StyleSheet.create({
  balanceCard: {
    padding: 22,
    borderRadius: 26,
    backgroundColor: "#15525D",
    gap: 16,
  },
  balanceLabel: {
    ...typography.footnote,
    color: "#D0E6E8",
    fontWeight: "600",
    letterSpacing: 1,
  },
  balance: {
    ...typography.largeTitle,
    color: colors.surface,
    fontSize: 34,
    lineHeight: 42,
  },
  balanceDetails: { gap: 7 },
  balanceFootnote: { ...typography.footnote, color: "#E1F0F1" },
  holder: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#67939A",
  },
  mockPill: {
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#326C75",
  },
  mockText: { color: colors.surface, fontSize: 10, fontWeight: "700" },
  event: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.teal,
    marginTop: 6,
  },
});
