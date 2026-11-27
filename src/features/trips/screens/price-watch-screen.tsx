import { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Keyboard, ScrollView, Text, View } from 'react-native';
import { useSession } from '@/features/auth/session/session-provider';
import { errorMessage } from '@/shared/api/errors';
import { useApi } from '@/shared/api/use-api';
import { useResource } from '@/shared/hooks/use-resource';
import { typography } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/button';
import { ClayChip, ClayField } from '@/shared/ui/clay-form';
import { DesignPopup } from '@/shared/ui/design-popup';
import { Details } from '@/shared/ui/details';
import { Feedback } from '@/shared/ui/feedback';
import { Hint } from '@/shared/ui/hint';
import { EmptyState, Notice, ResourceFeedback, ui } from '@/shared/ui/journal';
import { groupMoney, moneyDigits } from '@/shared/ui/money-input';
import { Screen } from '@/shared/ui/screen';
import { ClayButton, ClayIconButton, SettingCard } from '@/shared/ui/setting-card';
import { ActionSheet, CommandFeedback, Line, type ActionForm, type Field } from '../../finance/components';
import { moneyLabel, statusLabel } from '../../finance/extended-model';
import { historyTimeLabel } from '../../finance/history-labels';
import { useFinanceCommand } from '../../finance/use-finance-command';
import { localWatchValues, QUICK_AIRPORTS, WATCH_TIMEZONE, watchFormDates, watchInput, type Watch } from '../../price-watch/api';
import { PricePanel, RouteCard, watchRoute } from '../../price-watch/components/watch-panel';
import { watchStatusReason } from '../../price-watch/labels';
import { ANY_SOURCE, capabilitiesNote, type Capabilities, unsupportedReason } from '../../price-watch/capabilities';
import { calendarLabel, dateKey } from '../utils';

const cabins = [
  { value: 'ECONOMY', label: 'Phổ thông' },
  { value: 'PREMIUM_ECONOMY', label: 'Phổ thông đặc biệt' },
  { value: 'BUSINESS', label: 'Thương gia' },
  { value: 'FIRST', label: 'Hạng nhất' },
];
/** SRS FR-AU03: offer only what the fare source can compare; a single choice is not a question. */
function watchFields(w: Watch | undefined, can: Capabilities): Field[] {
  const q = w?.normalized_query;
  const dates = watchFormDates(w);
  const journeys = [
    { value: 'ONE_WAY', label: 'Một chiều' },
    { value: 'ROUND_TRIP', label: 'Khứ hồi' },
  ].filter((option) => can.journey_types.includes(option.value as 'ONE_WAY'));
  const cabinOptions = cabins.filter((option) => can.cabin_classes.includes(option.value));
  const pick = (value: string | undefined, options: { value: string }[]) =>
    options.some((option) => option.value === value) ? value! : options[0]!.value;
  return [
    {
      key: 'origin',
      label: 'Mã sân bay đi',
      value: q?.origin ?? '',
      placeholder: 'SGN',
      suggestions: QUICK_AIRPORTS,
    },
    {
      key: 'destination',
      label: 'Mã sân bay đến',
      value: q?.destination ?? '',
      placeholder: 'DAD',
      suggestions: QUICK_AIRPORTS,
    },
    { key: 'departure_date', label: 'Ngày bay', value: dates.departure_date, mode: 'date' },
    {
      key: 'departure_time',
      label: 'Giờ khởi hành (giờ Việt Nam)',
      value: dates.departure_time,
      mode: 'time',
    },
    {
      key: 'journey_type',
      label: 'Hành trình',
      value: pick(q?.journey_type, journeys),
      options: journeys,
      visible: () => journeys.length > 1,
    },
    {
      key: 'return_date',
      label: 'Ngày về',
      value: dates.return_date,
      mode: 'date',
      visible: (values) => values.journey_type === 'ROUND_TRIP',
    },
    {
      key: 'adults',
      label: 'Người lớn',
      value: String(Math.min(q?.passengers.adults ?? 1, can.max_adults)),
      numeric: true,
      visible: () => can.max_adults > 1,
    },
    {
      key: 'children',
      label: 'Trẻ em',
      value: String(Math.min(q?.passengers.children ?? 0, can.max_children)),
      numeric: true,
      visible: () => can.max_children > 0,
    },
    {
      key: 'infants',
      label: 'Em bé',
      value: String(Math.min(q?.passengers.infants ?? 0, can.max_infants)),
      numeric: true,
      visible: () => can.max_infants > 0,
    },
    {
      key: 'cabin_class',
      label: 'Hạng ghế',
      value: pick(q?.cabin_class ?? 'ECONOMY', cabinOptions),
      options: cabinOptions,
      visible: () => cabinOptions.length > 1,
    },
    {
      key: 'threshold_price',
      label: 'Ngưỡng giá riêng (VND)',
      value: w?.threshold_price,
      numeric: true,
      money: true,
    },
  ];
}
export default function PriceWatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { profile } = useSession();
  return <WatchWorkspace key={`${profile?.id}:${id}`} id={id} userId={profile?.id ?? ''} />;
}
function WatchWorkspace({ id, userId }: { id: string; userId: string }) {
  const api = useApi();
  const trip = useResource(
    useCallback((signal: AbortSignal) => api.trips.get(id, signal), [api, id]),
    !!id && !!userId,
  );
  const list = useResource(
    useCallback((signal: AbortSignal) => api.priceWatch.list(id, null, signal), [api, id]),
    !!trip.data,
  );
  const capabilities = useResource(
    useCallback((signal: AbortSignal) => api.priceWatch.capabilities(signal), [api]),
    !!trip.data,
  );
  // Until (or if) the source is known, offer everything and let the server decide.
  const source = capabilities.data ?? ANY_SOURCE;
  const [form, setForm] = useState<ActionForm>(),
    [selectedId, setSelectedId] = useState<string>(),
    [draft, setDraft] = useState<{ key: string; value: string }>();
  const [error, setError] = useState<string>(),
    [loadingMore, setLoadingMore] = useState(false);
  const reloadTrip = trip.reload,
    reloadList = list.reload;
  const refresh = useCallback(async () => {
    await reloadTrip();
    return reloadList();
  }, [reloadTrip, reloadList]);
  const [savedThreshold, setSavedThreshold] = useState<string>();
  const command = useFinanceCommand(userId, id, 'watch', refresh, intent => {
    if ((intent.method === "PATCH" || intent.method === "POST") && intent.body.threshold_price != null)
      setSavedThreshold(moneyLabel(String(intent.body.threshold_price)));
  });
  // Your live requests first, then the group's, then finished ones.
  const rank = (w: Watch) => (w.status === 'ACTIVE' ? 0 : w.status === 'PAUSED' ? 1 : 4) + (w.user_id === userId ? 0 : 2);
  const watches = [...(list.data?.items ?? [])].sort((a, b) => rank(a) - rank(b));
  const writable =
    !!trip.data &&
    !trip.data.current_membership.left_at &&
    trip.data.lifecycle !== 'ARCHIVED' &&
    !trip.error &&
    !list.error &&
    !list.loading;
  function edit(w?: Watch) {
    // An edit keeps the watch's own source; the capabilities describe the configured one.
    const can = !w || w.normalized_query.provider === source.provider ? source : ANY_SOURCE;
    setForm({
      title: w ? 'Sửa theo dõi giá' : 'Tạo theo dõi giá',
      message: `Ngày và giờ bay theo giờ Việt Nam. ${capabilitiesNote(can)}`,
      fields: watchFields(w, can),
      submit: async (values) => {
        const input = watchInput(localWatchValues(values));
        const unsupported = unsupportedReason(can, input);
        if (unsupported) throw Error(unsupported);
        const result = await command.send({
          label: w ? 'Sửa theo dõi giá' : 'Tạo theo dõi giá',
          method: w ? 'PATCH' : 'POST',
          path: w ? `/price-watches/${w.id}` : `/trips/${id}/price-watches`,
          // An edit keeps the source the watch was created with; a new watch lets the server choose.
          body: { ...input, ...(w ? { provider: w.normalized_query.provider, expected_version: w.version } : {}) },
        });
        if (result && 'formError' in result) throw result.formError;
        const row = result?.done && 'result' in result ? result.result : undefined;
        if (!w && row && typeof row === 'object' && 'id' in row && typeof row.id === 'string') setSelectedId(row.id);
        return true;
      },
    });
  }
  function stop(w: Watch) {
    setForm({
      title: 'Dừng theo dõi',
      message: `Dừng theo dõi chặng ${watchRoute(w)}${w.user_id === userId ? ' của bạn' : ' của thành viên này'}? Muốn nhận cảnh báo lại, người theo dõi cần tạo yêu cầu mới.`,
      fields: [],
      submit: async () => {
        await command.send({ label: 'Dừng theo dõi', path: `/price-watches/${w.id}`, method: 'DELETE', body: { expected_version: w.version } });
        return true;
      },
    });
  }
  async function more() {
    if (!list.data?.next_cursor || loadingMore) return;
    const cursor = list.data.next_cursor;
    setLoadingMore(true);
    setError(undefined);
    try {
      const next = await api.priceWatch.list(id, cursor);
      list.setData((old) =>
        old?.next_cursor === cursor
          ? {
              items: [
                ...old.items,
                ...next.items.filter((w) => !old.items.some((v) => v.id === w.id)),
              ],
              next_cursor: next.next_cursor,
            }
          : old,
      );
    } catch (e) {
      setError(errorMessage(e, 'Không tải được trang tiếp theo.'));
    } finally {
      setLoadingMore(false);
    }
  }
  const selected = watches.find((w) => w.id === selectedId) ?? watches[0];
  const own = selected?.user_id === userId;
  const live = !!selected && ['ACTIVE', 'PAUSED'].includes(selected.status);
  const editable = live && own && writable && !command.blocked;
  const draftKey = selected && `${selected.id}:${selected.threshold_price}`;
  const threshold = draft && draft.key === draftKey ? draft.value : selected?.threshold_price ?? '';
  async function saveThreshold() {
    if (!selected || !editable) return;
    setError(undefined);
    const q = selected.normalized_query;
    try {
      const input = watchInput(localWatchValues({
        origin: q.origin, destination: q.destination, ...watchFormDates(selected), journey_type: q.journey_type,
        adults: String(q.passengers.adults), children: String(q.passengers.children), infants: String(q.passengers.infants),
        cabin_class: q.cabin_class ?? '', threshold_price: threshold,
      }));
      const result = await command.send({
        label: 'Lưu ngưỡng giá', method: 'PATCH', path: `/price-watches/${selected.id}`,
        body: { ...input, provider: q.provider, expected_version: selected.version },
      });
      if (result && 'formError' in result) throw result.formError;
    } catch (cause) {
      setError(errorMessage(cause, 'Không lưu được ngưỡng giá.'));
    }
  }
  return (
    <Screen
      clay
      title="Theo dõi giá vé"
      onRefresh={() => { void refresh(); }}
      refreshing={list.loading && !!list.data}
      headerRight={selected ? <ClayIconButton icon="plus" label="Tạo theo dõi giá" onPress={() => { if (!command.blocked && writable && source.available) edit(); }} /> : undefined}
      footer={selected
        ? live && own && <ClayButton label="Lưu ngưỡng giá" loading={command.busy} disabled={!editable || !threshold || threshold === selected.threshold_price} onPress={() => { Keyboard.dismiss(); void saveThreshold(); }} />
        : list.data && <ClayButton label="Tạo theo dõi giá" disabled={command.blocked || !writable || !source.available} onPress={() => edit()} />}
    >
      <View style={{ gap: 4 }}>
        <Text accessibilityRole="header" style={typography.title}>Bay với giá tốt hơn</Text>
        <Text style={typography.footnote}>Nhận thông báo khi giá chạm ngưỡng.</Text>
      </View>
      <ResourceFeedback {...trip} hasData={!!trip.data} onRetry={() => { void trip.reload(); }} />
      <CommandFeedback command={command} />
      <ResourceFeedback {...list} hasData={!!list.data} onRetry={() => { void list.reload(); }} />
      {error && <Feedback message={error} />}
      {capabilities.data && !capabilities.data.available && (
        <Notice>Nguồn giá vé chưa sẵn sàng trên máy chủ nên chưa tạo được theo dõi mới. Các theo dõi đã có vẫn xem được.</Notice>
      )}
      {watches.length > 1 && <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginHorizontal: -24, marginVertical: -6, flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 24, paddingVertical: 6 }}>
        {watches.map((w) => <ClayChip key={w.id} role="tab" selected={w.id === selected?.id} onPress={() => { setSelectedId(w.id); setError(undefined); }}
          label={`${watchRoute(w)} · ${calendarLabel(dateKey(w.normalized_query.departure_at, WATCH_TIMEZONE)).slice(0, 5)}${w.status === 'ACTIVE' ? '' : ` · ${statusLabel[w.status]}`}`} />)}
      </ScrollView>}
      {list.data && !selected && <EmptyState icon="plane" scene="waiting" title="Chưa theo dõi chặng bay nào" message="Tạo theo dõi giá để nhận báo khi vé rẻ hơn ngưỡng của bạn." />}
      {selected && <>
        <RouteCard watch={selected} />
        {!own && <Notice>Yêu cầu của thành viên khác</Notice>}
        {selected.status_reason && <Notice>{watchStatusReason(selected.status_reason)}</Notice>}
        <PricePanel key={`${selected.id}:${selected.version}`} watch={selected} />
        {live && own ? <>
          <ClayField label="Báo tôi khi giá thấp hơn" icon="notifyThreshold" tone="peach" value={groupMoney(threshold)} keyboardType="number-pad" inputMode="numeric"
            editable={editable} onChangeText={(value) => { if (draftKey) setDraft({ key: draftKey, value: moneyDigits(value, 15) }); }} trailing={<Text style={typography.body}>₫</Text>} />
          <SettingCard icon="bell" tone="lilac" title="Thông báo giá vé" value={selected.status === 'ACTIVE'} busy={command.busy} disabled={!editable}
            subtitle={selected.status === 'ACTIVE' ? 'Trên ứng dụng và qua email nếu bạn đã bật' : 'Đang tạm dừng theo dõi giá'}
            onPress={() => {
              const action = selected.status === 'ACTIVE' ? 'pause' : 'resume';
              void command.send({ label: action === 'pause' ? 'Tạm dừng theo dõi' : 'Tiếp tục theo dõi', method: 'POST', path: `/price-watches/${selected.id}/${action}`, body: { expected_version: selected.version } });
            }} />
        </> : <Line>Báo khi giá thấp hơn {moneyLabel(selected.threshold_price)}</Line>}
        <Details key={selected.id} title="Chi tiết chuyến bay">
          <Line>{selected.normalized_query.journey_type === 'ROUND_TRIP'
            ? `Khứ hồi, về ${selected.normalized_query.return_date ? calendarLabel(selected.normalized_query.return_date) : ''}`
            : 'Một chiều'} · {passengerLabel(selected.normalized_query.passengers)}</Line>
          {dateKey(selected.normalized_query.departure_at, WATCH_TIMEZONE) !== selected.normalized_query.departure_date &&
            <Line>Ngày nguồn tra giá · {calendarLabel(selected.normalized_query.departure_date)} (UTC)</Line>}
          {selected.last_alert_at && selected.last_alert_price && <Line>Cảnh báo gần nhất: {moneyLabel(selected.last_alert_price)} lúc {historyTimeLabel(selected.last_alert_at)}</Line>}
          <Line>Theo dõi đến {historyTimeLabel(selected.expires_at)}</Line>
        </Details>
        {live && (own || trip.data?.current_membership.role === 'OWNER') && <View style={ui.actionRow}>
          {own && <Button label="Sửa theo dõi giá" compact variant="soft" onPress={() => edit(selected)} disabled={!editable} />}
          <Button label="Dừng theo dõi" compact variant="destructive" onPress={() => stop(selected)} disabled={command.blocked || !writable} />
        </View>}
      </>}
      {list.data?.next_cursor && <Button label="Tải thêm yêu cầu" loading={loadingMore} onPress={() => { void more(); }} />}
      <Hint
        title="Về giá hiển thị"
        points={[
          'Giá tham khảo có thể thay đổi khi đặt vé. Nguồn dữ liệu hiển thị trên từng chặng.',
          'Mỗi người tự đặt ngưỡng riêng.',
          'Hệ thống gửi cảnh báo khi tìm thấy giá mới thấp hơn ngưỡng của bạn.',
        ]}
      />
      {!form && savedThreshold && <DesignPopup kind="threshold" message={`Thông báo giá vé sẽ dùng ngưỡng ${savedThreshold} bạn đã chọn.`} onPrimary={() => setSavedThreshold(undefined)} onClose={() => setSavedThreshold(undefined)} />}
      {form && <ActionSheet form={form} close={() => setForm(undefined)} />}
    </Screen>
  );
}
/** "2 người lớn" or "2 người lớn, 1 trẻ em": zero counts are left out. */
function passengerLabel(p: { adults: number; children: number; infants: number }) {
  return [
    `${p.adults} người lớn`,
    p.children > 0 && `${p.children} trẻ em`,
    p.infants > 0 && `${p.infants} em bé`,
  ]
    .filter(Boolean)
    .join(', ');
}
