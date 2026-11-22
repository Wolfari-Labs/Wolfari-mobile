import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radii, shadows, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { DesignIcon } from "@/shared/ui/design-icon";
import { Feedback } from "@/shared/ui/feedback";
import { Hint } from "@/shared/ui/hint";
import { Notice } from "@/shared/ui/journal";
import { groupAccount } from "../account-format";
import { bankDisplayName } from "../bank-names";
import type { Destination } from "../types";
import { resolveVietQrBank } from "../vietqr-banks";
import { QrImage } from "./qr-image";

/** Receiving QR (no amount/reference) for a VietQR destination whose details the viewer can already see. */
export function destinationQrUrl(row: Destination): string | undefined {
  const bin = row.bank_code ? resolveVietQrBank(row.bank_code)?.bin : undefined;
  if (!bin || !row.account_number || !/^[\dA-Za-z]{1,19}$/.test(row.account_number)) return undefined;
  const url = new URL(`https://img.vietqr.io/image/${bin}-${row.account_number}-compact2.svg`);
  if (row.account_name) url.searchParams.set("accountName", row.account_name);
  return url.href;
}

type Props = {
  row: Destination;
  /** Holder may confirm; Owner may edit and switch it off. */
  canConfirm: boolean;
  canManage: boolean;
  disabled: boolean;
  onConfirm(): void;
  onEdit(): void;
  onToggle(): void;
};

/** One receiving account, drawn like the bank card people will match it against. */
export function DestinationCard({ row, canConfirm, canManage, disabled, onConfirm, onEdit, onToggle }: Props) {
  const [qrOpen, setQrOpen] = useState(false), [consent, setConsent] = useState(false), [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);
  const vietqr = row.destination_type === "VIETQR";
  const [bank, bankNote] = vietqr ? bankDisplayName(row.bank_code ?? "").split(" · ") : ["MoMo", "Ví thử nghiệm (sandbox)"];
  const number = row.account_number ?? row.momo_phone;
  const qrUrl = vietqr && row.active ? destinationQrUrl(row) : undefined;
  const status = !row.active
    ? { tone: colors.muted, text: "Đã tắt · không nhận khoản góp mới" }
    : row.confirmed_by_holder_at
      ? { tone: colors.pinGreen, text: "Người giữ quỹ đã xác nhận" }
      : { tone: colors.amber, text: "Chờ người giữ quỹ xác nhận" };
  const gradient = !row.active ? ["#8A97AB", "#5F6B7E"] as const : vietqr ? ["#1E6FB8", "#173F63"] as const : ["#C2338A", "#8E1F63"] as const;
  const accountLabel = `${vietqr ? bankDisplayName(row.bank_code ?? "") : "MoMo"} ${number ?? ""}`;
  const showQr = () => { setQrOpen(true); setConsent(false); setFailed(false); };

  return <View style={[styles.card, !row.active && styles.inactive]}>
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.face}>
      <View style={styles.faceTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bank} numberOfLines={1}>{bank}</Text>
          {!!bankNote && <Text style={styles.bankNote} numberOfLines={1}>{bankNote}</Text>}
        </View>
        <View style={styles.tags}>
          {row.is_default && <Text style={styles.tag}>Mặc định</Text>}
          <Text style={styles.tag}>{vietqr ? "VietQR" : "SANDBOX"}</Text>
        </View>
      </View>
      {number ? <View style={styles.numberRow}>
        <Text selectable style={styles.number} accessibilityLabel={`Số tài khoản ${number}`}>{groupAccount(number)}</Text>
        <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={`Sao chép số tài khoản ${number}`} hitSlop={8}
          onPress={() => { void Clipboard.setStringAsync(number).then(() => setCopied(true)); }}
          style={({ pressed }) => [styles.copy, pressed && { opacity: 0.7 }]}>
          <Text style={styles.copyText}>{copied ? "Đã chép ✓" : "Sao chép"}</Text>
        </Pressable>
      </View> : <Text style={styles.hidden}>Số tài khoản có trong mã QR của khoản góp của bạn.</Text>}
      {!!row.account_name && <Text selectable style={styles.holder} numberOfLines={1}>{row.account_name.toUpperCase()}</Text>}
    </LinearGradient>

    <View style={styles.body}>
      <View style={styles.status}>
        <View style={[styles.dot, { backgroundColor: status.tone }]} />
        <Text style={[styles.statusText, { color: status.tone }]}>{status.text}</Text>
      </View>

      {canConfirm && <Button label="Xác nhận tài khoản nhận" compact icon="check" accessibilityLabel={`Xác nhận tài khoản ${accountLabel}${row.account_name ? ` ${row.account_name}` : ""}`.trim()}
        disabled={disabled} onPress={onConfirm} />}

      {qrUrl && (qrOpen ? <View style={styles.qrBox}>
        {consent ? <QrImage url={qrUrl} label={`Mã QR nhận tiền ${accountLabel}`} onError={() => setFailed(true)} /> : <>
          <Notice>Để tải ảnh QR nhận tiền, ngân hàng, số tài khoản và tên người nhận sẽ được gửi đến Casso (img.vietqr.io). Chỉ tiếp tục nếu bạn đồng ý.</Notice>
          <Button label="Đồng ý tải ảnh QR" compact variant="soft" onPress={() => setConsent(true)} />
        </>}
        {failed && <Feedback message="Không tải được ảnh QR. Kiểm tra mạng; thông tin tài khoản vẫn hiển thị ở trên." />}
        {consent && <Hint title="Mã này dùng khi nào?" points={["Mã không kèm số tiền hay nội dung; người chuyển tự nhập.", "Để khớp đúng khoản góp, mở Đợt góp và dùng QR của khoản đóng của bạn."]} />}
        <Button label="Ẩn mã QR" compact variant="text" onPress={() => setQrOpen(false)} />
      </View> : <Button label="Xem mã QR nhận tiền" icon="wallet" compact variant="soft" accessibilityLabel={`Xem mã QR nhận tiền ${accountLabel}`} onPress={showQr} />)}

      {canManage && <View style={styles.manage}>
        {vietqr && <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel="Sửa tài khoản nhận" disabled={disabled} onPress={onEdit}
          style={({ pressed }) => [styles.manageButton, pressed && { backgroundColor: colors.fill }, disabled && styles.off]}>
          <DesignIcon name="edit" size={15} tintColor={colors.ink} />
          <Text style={styles.manageText}>Sửa</Text>
        </Pressable>}
        <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={row.active ? "Tắt tài khoản nhận" : "Bật lại tài khoản nhận"} disabled={disabled} onPress={onToggle}
          style={({ pressed }) => [styles.manageButton, pressed && { backgroundColor: row.active ? colors.errorSurface : colors.mint }, disabled && styles.off]}>
          <Text style={[styles.manageText, { color: row.active ? colors.error : colors.pinGreen }]}>{row.active ? "Tắt tài khoản" : "Bật lại"}</Text>
        </Pressable>
      </View>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.card, backgroundColor: colors.surface, overflow: "hidden", ...shadows.glass },
  inactive: { opacity: 0.85 },
  face: { padding: 18, gap: 12, minHeight: 150 },
  faceTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bank: { color: "#FFFFFF", fontSize: 18, fontFamily: fonts.bold },
  bankNote: { color: "rgba(255,255,255,0.78)", fontSize: 12, fontFamily: fonts.bold },
  tags: { flexDirection: "row", gap: 6 },
  tag: { overflow: "hidden", paddingHorizontal: 9, paddingVertical: 3, borderRadius: radii.pill, backgroundColor: "rgba(255,255,255,0.2)", color: "#FFFFFF", fontSize: 11, fontFamily: fonts.bold },
  numberRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  number: { flex: 1, color: "#FFFFFF", fontSize: 24, letterSpacing: 1.5, fontFamily: fonts.bold, fontVariant: ["tabular-nums"] },
  copy: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: "rgba(255,255,255,0.22)" },
  copyText: { color: "#FFFFFF", fontSize: 12, fontFamily: fonts.bold },
  hidden: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  holder: { color: "rgba(255,255,255,0.92)", fontSize: 14, letterSpacing: 1, fontFamily: fonts.bold },
  body: { padding: 16, gap: 12 },
  status: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { ...typography.footnote, fontFamily: fonts.bold },
  qrBox: { gap: 10 },
  manage: { flexDirection: "row", justifyContent: "flex-end", gap: 6, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  manageButton: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: radii.pill },
  manageText: { color: colors.ink, fontSize: 14, fontFamily: fonts.bold },
  off: { opacity: 0.4 },
});
