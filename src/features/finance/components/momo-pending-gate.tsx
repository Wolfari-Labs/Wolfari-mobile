import { useCallback, type ReactNode } from "react";
import { Text } from "react-native";

import { useApi } from "@/shared/api/use-api";
import { useResource } from "@/shared/hooks/use-resource";
import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import type { Contribution } from "../types";

/** Attempt states during which the server rejects every manual contribution action. */
export const momoInFlight = (status: string | undefined) => status === "CREATED" || status === "PENDING";

/**
 * A pending MoMo contribution with a known latest attempt loads that attempt once; while MoMo
 * has not answered, manual actions are hidden instead of failing with a generic conflict.
 */
export function MomoPendingGate({ item, children, onOpen, locked }: {
  item: Contribution;
  children: ReactNode;
  onOpen(item: Contribution): void;
  locked: boolean;
}) {
  // MoMo Sandbox attempts, and payOS attempts on VietQR destinations, both lock manual actions.
  const watch = item.status === "PENDING" && !!item.latest_payment_attempt_id;
  return watch ? <AttemptGate item={item} onOpen={onOpen} locked={locked}>{children}</AttemptGate> : <>{children}</>;
}

function AttemptGate({ item, children, onOpen, locked }: {
  item: Contribution;
  children: ReactNode;
  onOpen(item: Contribution): void;
  locked: boolean;
}) {
  const api = useApi();
  const attemptId = item.latest_payment_attempt_id!;
  const attempt = useResource(useCallback((signal: AbortSignal) => api.finance.attempt(attemptId, signal), [api, attemptId]));
  if (attempt.loading && !attempt.data) return <Text style={typography.footnote}>Đang kiểm tra thanh toán…</Text>;
  const row = attempt.data;
  // The server keeps an attempt that awaits reconciliation in flight as well.
  if (!momoInFlight(row?.status) && !(row?.needs_reconciliation && row.status !== "SUCCEEDED")) return <>{children}</>;
  const provider = row?.provider === "PAYOS" ? "payOS" : "MoMo";
  return <>
    <Text style={[typography.footnote, { color: colors.amber }]}>Đang chờ kết quả {provider}. Các thao tác khác tạm khóa cho đến khi {provider} trả kết quả.</Text>
    <Button label={`Xem thanh toán ${provider}`} compact variant="soft" disabled={locked} onPress={() => onOpen(item)} />
  </>;
}
