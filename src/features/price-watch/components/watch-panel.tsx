import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '@/shared/api/errors';
import { useApi } from '@/shared/api/use-api';
import { useResource } from '@/shared/hooks/use-resource';
import { colors, fonts, shadows } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/button';
import { DesignIcon } from '@/shared/ui/design-icon';
import type { DesignIconName } from '@/shared/ui/design-assets';
import { Notice, ResourceFeedback } from '@/shared/ui/journal';
import { claySubtitle } from '@/shared/ui/setting-card';
import { calendarLabel, dateKey, timeLabel } from '@/features/trips/utils';
import { Line } from '@/features/finance/components';
import { moneyLabel, statusLabel } from '@/features/finance/extended-model';
import { historyTimeLabel } from '@/features/finance/history-labels';
import { WATCH_TIMEZONE, type Watch } from '../api';
import { checkStatusLabel, fareFreshness, freshnessLabel, priceKind, priceKindLabel, priceProviderLabel } from '../labels';
import { seriesChange, weekSeries } from '../series';
import { PriceChart } from './price-chart';

const cities: Record<string, string> = { SGN: 'TP. Hồ Chí Minh', HAN: 'Hà Nội', DAD: 'Đà Nẵng', CXR: 'Nha Trang', PQC: 'Phú Quốc', HPH: 'Hải Phòng' };
const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export const watchRoute = (w: Watch) => `${w.normalized_query.origin} → ${w.normalized_query.destination}`;
const shortDay = (value: string) => calendarLabel(dateKey(value, WATCH_TIMEZONE)).slice(0, 5);

function Pill({ icon, label, good = true }: { icon?: DesignIconName; label: string; good?: boolean }) {
  const tint = good ? '#17824F' : colors.muted;
  return <View style={[styles.pill, { backgroundColor: good ? colors.mint : colors.fill }]}>
    {icon && <DesignIcon name={icon} size={12} tintColor={tint} spark={false} />}
    <Text style={[styles.pillText, { color: tint }]}>{label}</Text>
  </View>;
}

function Airport({ code, end = false }: { code: string; end?: boolean }) {
  return <View style={end && { alignItems: 'flex-end' }}>
    <Text style={styles.code}>{code}</Text>
    {!!cities[code] && <Text style={claySubtitle}>{cities[code]}</Text>}
  </View>;
}

/** Figma D · M18 route card. */
export function RouteCard({ watch }: { watch: Watch }) {
  const q = watch.normalized_query;
  const day = dateKey(q.departure_at, WATCH_TIMEZONE);
  const active = watch.status === 'ACTIVE';
  return <View style={styles.route}>
    <LinearGradient pointerEvents="none" colors={[colors.tealSoft, colors.lilac]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 30 }]} />
    <View accessible accessibilityRole="header" accessibilityLabel={watchRoute(watch)} style={styles.between}>
      <Airport code={q.origin} />
      <View style={styles.flight}>
        <View style={styles.dash} />
        <View style={styles.plane}><DesignIcon name="plane" size={18} tintColor={colors.blue} /></View>
        <View style={styles.dash} />
      </View>
      <Airport code={q.destination} end />
    </View>
    <View style={[styles.between, styles.wrap]}>
      <Text style={styles.date}>{weekdays[new Date(`${day}T12:00:00Z`).getUTCDay()]}, {calendarLabel(day)} · {timeLabel(q.departure_at, WATCH_TIMEZONE)}</Text>
      <Pill icon={active ? 'check' : undefined} good={active} label={statusLabel[watch.status] ?? watch.status} />
    </View>
  </View>;
}

/** Price card with the seven-day line; every stored result opens below it. */
export function PricePanel({ watch }: { watch: Watch }) {
  const api = useApi(),
    [expanded, setExpanded] = useState(false),
    [moreBusy, setMoreBusy] = useState(false),
    [moreError, setMoreError] = useState<string>();
  const epoch = useRef(0);
  const history = useResource(
    useCallback((signal: AbortSignal) => {
      epoch.current++;
      return api.priceWatch.observations(watch.id, null, signal);
    }, [api, watch.id]),
  );
  async function more() {
    if (!history.data?.next_cursor || moreBusy) return;
    const cursor = history.data.next_cursor, generation = epoch.current;
    setMoreBusy(true);
    setMoreError(undefined);
    try {
      const next = await api.priceWatch.observations(watch.id, cursor);
      if (generation === epoch.current)
        history.setData((old) => old?.next_cursor === cursor
          ? { ...old, items: [...old.items, ...next.items.filter((o) => !old.items.some((v) => v.id === o.id))], next_cursor: next.next_cursor }
          : old);
    } catch (e) {
      setMoreError(errorMessage(e, 'Không thể tải thêm giá.'));
    } finally {
      setMoreBusy(false);
    }
  }
  const source = history.data;
  const latest = source?.items[0];
  const checkStatus = checkStatusLabel(source?.last_check_status);
  const usable = !!latest && !source?.stale && !source?.last_error &&
    source?.last_check_status !== 'NO_RESULT' && source?.last_check_status !== 'FAILED' &&
    (priceKind(latest.provider) === 'mock' || fareFreshness(latest.fare_metadata) === 'FRESH_REFERENCE');
  const series = weekSeries(source?.items ?? []);
  const change = usable ? seriesChange(series) : undefined;
  const below = watch.status === 'ACTIVE' && usable && BigInt(latest.price) < BigInt(watch.threshold_price);
  const title = !latest ? 'Giá tham khảo' : usable ? `${priceKindLabel(latest.provider)} hiện tại` : source?.stale ? 'Giá cũ gần nhất' : `${priceKindLabel(latest.provider)} gần nhất`;
  return <>
    <View style={styles.price}>
      <View style={[styles.between, styles.wrap, { alignItems: 'flex-end' }]}>
        <View>
          <Text style={claySubtitle}>{title}</Text>
          <Text selectable style={styles.amount}>{latest ? moneyLabel(latest.price) : '—'}</Text>
        </View>
        <View style={styles.pills}>
          {below && <Pill icon="check" label="Dưới ngưỡng riêng" />}
          {change !== undefined && <Pill icon={change < 0 ? 'trendDown' : undefined} good={change < 0}
            label={change === 0 ? 'Không đổi · 7 ngày' : `${change < 0 ? '−' : '+'}${Math.abs(change)}% · 7 ngày`} />}
        </View>
      </View>
      {series.length > 1 ? <>
        <PriceChart series={series} threshold={watch.threshold_price} label={`Giá 7 ngày qua, từ ${moneyLabel(series[0].price)} đến ${moneyLabel(series[series.length - 1].price)}. Ngưỡng ${moneyLabel(watch.threshold_price)}.`} />
        <View style={styles.between}>
          <Text style={styles.axis}>{shortDay(series[0].observed_at)}</Text>
          <Text style={[styles.axis, styles.limit]}>Ngưỡng {moneyLabel(watch.threshold_price)}</Text>
          <Text style={styles.axis}>{shortDay(series[series.length - 1].observed_at)}</Text>
        </View>
      </> : source && <Text style={claySubtitle}>Biểu đồ hiện khi có ít nhất hai mức giá trong 7 ngày qua.</Text>}
      <ResourceFeedback {...history} hasData={!!source} onRetry={() => { void history.reload(); }} />
      {checkStatus && <Text style={claySubtitle}>{checkStatus}</Text>}
      {source?.last_checked_at && <Text style={claySubtitle}>Kiểm tra gần nhất · {historyTimeLabel(source.last_checked_at)}</Text>}
      <Text style={claySubtitle}>Nguồn giá · {priceProviderLabel(watch.normalized_query.provider)}</Text>
    </View>
    {source?.stale && <Notice>Giá cũ · Nguồn giá chưa cập nhật thành công. Giá lưu trước đó không phải giá hiện tại.</Notice>}
    {source?.last_error && !source.stale && <Notice>Nguồn giá tạm thời chưa cung cấp được kết quả.</Notice>}
    <View style={styles.links}>
      <Button label="Làm mới giá" variant="text" compact onPress={() => { void history.reload(); }} disabled={history.loading} />
      <Button label={expanded ? 'Ẩn lịch sử giá' : 'Xem lịch sử giá'} variant="text" compact onPress={() => setExpanded((v) => !v)} />
    </View>
    {expanded && <>
      {source?.next_check_at && watch.status === 'ACTIVE' && <Line>Dự kiến kiểm tra lại · {historyTimeLabel(source.next_check_at)}</Line>}
      {source && !source.items.length && !checkStatus && <Notice>Chưa có giá vé cho chặng này.</Notice>}
      {source?.items.map((o) => {
        const freshness = freshnessLabel(o.fare_metadata);
        return <Line key={o.id}>
          {moneyLabel(o.price)} · {priceProviderLabel(o.provider)}{freshness && ` · ${freshness}`} · Quan sát: {historyTimeLabel(o.observed_at)} · Thu thập: {historyTimeLabel(o.fetched_at)}
        </Line>;
      })}
      {moreError && <Notice>{moreError}</Notice>}
      {source?.next_cursor && <Button label="Tải thêm kết quả giá" loading={moreBusy} onPress={() => { void more(); }} />}
    </>}
  </>;
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  wrap: { flexWrap: 'wrap', gap: 6 },
  route: { gap: 10, paddingHorizontal: 18, paddingVertical: 16, borderRadius: 30, ...shadows.glass },
  code: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 34, color: colors.ink },
  flight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dash: { flex: 1, maxWidth: 40, height: 2, borderRadius: 1, backgroundColor: colors.line },
  plane: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  date: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: colors.ink },
  pills: { gap: 4, alignItems: 'flex-end' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 8, paddingRight: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 18 },
  price: { gap: 8, padding: 16, borderRadius: 30, backgroundColor: colors.surface, ...shadows.card },
  amount: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 32, color: colors.ink },
  axis: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 18, color: claySubtitle.color },
  limit: { color: '#C2412D' },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: -8 },
});
