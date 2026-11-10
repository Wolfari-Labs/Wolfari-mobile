import { useCallback, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useSession } from '@/features/auth/session/session-provider';
import { useApi } from '@/shared/api/use-api';
import { useResource } from '@/shared/hooks/use-resource';
import { View } from 'react-native';
import { Button } from '@/shared/ui/button';
import { Heading, Notice, ResourceFeedback, Segments, StatusBadge, ui } from '@/shared/ui/journal';
import { Screen } from '@/shared/ui/screen';
import {
  ActionSheet,
  Card,
  CommandFeedback,
  Line,
  type ActionForm,
  type Field,
} from '../../finance/components';
import { moneyLabel, statusLabel } from '../../finance/extended-model';
import { historyTimeLabel } from '../../finance/history-labels';
import { useFinanceCommand } from '../../finance/use-finance-command';
import { watchInput, type Watch, type Observations } from '../../price-watch/api';

const cabins = [
  { value: 'ECONOMY', label: 'Phổ thông' },
  { value: 'PREMIUM_ECONOMY', label: 'Phổ thông đặc biệt' },
  { value: 'BUSINESS', label: 'Thương gia' },
  { value: 'FIRST', label: 'Hạng nhất' },
  { value: '', label: 'Bất kỳ' },
];
function watchFields(w?: Watch): Field[] {
  const q = w?.normalized_query;
  return [
    { key: 'origin', label: 'Mã sân bay đi', value: q?.origin ?? '', placeholder: 'SGN' },
    {
      key: 'destination',
      label: 'Mã sân bay đến',
      value: q?.destination ?? '',
      placeholder: 'DAD',
    },
    {
      key: 'departure_date',
      label: 'Ngày đi (UTC)',
      value: q?.departure_date,
      placeholder: 'YYYY-MM-DD',
    },
    {
      key: 'departure_time',
      label: 'Giờ khởi hành (UTC)',
      value: q ? new Date(q.departure_at).toISOString().slice(11, 16) : '12:00',
      placeholder: 'HH:mm',
    },
    {
      key: 'journey_type',
      label: 'Hành trình',
      value: q?.journey_type ?? 'ONE_WAY',
      options: [
        { value: 'ONE_WAY', label: 'Một chiều' },
        { value: 'ROUND_TRIP', label: 'Khứ hồi' },
      ],
    },
    {
      key: 'return_date',
      label: 'Ngày về (chỉ khứ hồi, UTC)',
      value: q?.return_date ?? '',
      placeholder: 'YYYY-MM-DD',
    },
    { key: 'adults', label: 'Người lớn', value: String(q?.passengers.adults ?? 1), numeric: true },
    { key: 'children', label: 'Trẻ em', value: String(q?.passengers.children ?? 0), numeric: true },
    { key: 'infants', label: 'Em bé', value: String(q?.passengers.infants ?? 0), numeric: true },
    {
      key: 'cabin_class',
      label: 'Hạng ghế',
      value: q ? (q.cabin_class ?? '') : 'ECONOMY',
      options: cabins,
    },
    {
      key: 'threshold_price',
      label: 'Ngưỡng giá riêng (VND)',
      value: w?.threshold_price,
      numeric: true,
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
  const [form, setForm] = useState<ActionForm>(),
    [filter, setFilter] = useState('ALL');
  const [error, setError] = useState<string>(),
    [loadingMore, setLoadingMore] = useState(false);
  const reloadTrip = trip.reload,
    reloadList = list.reload;
  const refresh = useCallback(async () => {
    await reloadTrip();
    return reloadList();
  }, [reloadTrip, reloadList]);
  const command = useFinanceCommand(userId, id, 'watch', refresh);
  const writable =
    !!trip.data &&
    !trip.data.current_membership.left_at &&
    trip.data.lifecycle !== 'ARCHIVED' &&
    !trip.error &&
    !list.error &&
    !list.loading;
  function edit(w?: Watch) {
    setForm({
      title: w ? 'Sửa theo dõi giá' : 'Tạo theo dõi giá',
      message:
        'Nguồn MOCK_FLIGHT mô phỏng giá, không phải giá vé để đặt mua. Ngưỡng là riêng cho bạn. Ngày đi được lưu theo UTC; 12:00 UTC là 19:00 Việt Nam.',
      fields: watchFields(w),
      submit: async (values) => {
        const input = watchInput(values);
        await command.send({
          label: w ? 'Sửa theo dõi giá' : 'Tạo theo dõi giá',
          method: w ? 'PATCH' : 'POST',
          path: w ? `/price-watches/${w.id}` : `/trips/${id}/price-watches`,
          body: { ...input, ...(w ? { expected_version: w.version } : {}) },
        });
        return true;
      },
    });
  }
  function transition(w: Watch, action: 'pause' | 'resume' | 'stop') {
    const labels = {
      pause: 'Tạm dừng theo dõi',
      resume: 'Tiếp tục theo dõi',
      stop: 'Dừng theo dõi',
    };
    setForm({
      title: labels[action],
      message:
        action === 'stop'
          ? 'Dừng là trạng thái kết thúc. Muốn theo dõi lại, tạo yêu cầu mới sau khi đối chiếu kết quả.'
          : 'Thay đổi chỉ áp dụng cho yêu cầu của bạn; ngưỡng của người khác giữ nguyên.',
      fields: [],
      submit: async () => {
        await command.send({
          label: labels[action],
          path: `/price-watches/${w.id}${action === 'stop' ? '' : `/${action}`}`,
          method: action === 'stop' ? 'DELETE' : 'POST',
          body: { expected_version: w.version },
        });
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
      setError(e instanceof Error ? e.message : 'Không tải được trang tiếp theo.');
    } finally {
      setLoadingMore(false);
    }
  }
  return (
    <Screen
      title="Theo dõi giá vé"
      tab="trips"
      onRefresh={() => {
        void refresh();
      }}
      refreshing={list.loading && !!list.data}
    >
      <Heading title="Theo dõi giá vé" subtitle={trip.data?.name} />
      <ResourceFeedback
        {...trip}
        hasData={!!trip.data}
        onRetry={() => {
          void trip.reload();
        }}
      />
      <Notice>
        MOCK_FLIGHT · Giá mô phỏng từ backend. Yêu cầu theo dõi và ngưỡng thuộc từng người; các truy
        vấn trùng có thể dùng chung nhóm truy vấn và kết quả giá. Cảnh báo do server quyết định,
        không được tạo bởi việc mở màn hình.
      </Notice>
      <CommandFeedback command={command} />
      <Button
        label="Tải lại danh sách theo dõi"
        variant="soft"
        onPress={() => {
          void refresh();
        }}
        disabled={list.loading}
      />
      <Button
        label="Tạo theo dõi giá"
        onPress={() => edit()}
        disabled={command.blocked || !writable}
      />
      <Button
        label="Xem yêu cầu nháp trên thiết bị"
        variant="soft"
        onPress={() => router.push(`/trip/${id}/price-watch-drafts`)}
      />
      <Segments
        scroll
        value={filter}
        onChange={setFilter}
        items={[
          { value: 'ALL', label: 'Tất cả' },
          ...['ACTIVE', 'PAUSED', 'EXPIRED', 'STOPPED'].map((value) => ({
            value,
            label: statusLabel[value],
          })),
        ]}
      />
      <ResourceFeedback
        {...list}
        hasData={!!list.data}
        onRetry={() => {
          void list.reload();
        }}
      />
      {error && <Notice>{error}</Notice>}
      {list.data?.items
        .filter((w) => filter === 'ALL' || w.status === filter)
        .map((w) => (
          <Card
            key={w.id}
            title={`${w.normalized_query.origin} → ${w.normalized_query.destination}`}
            right={<StatusBadge status={w.status} label={statusLabel[w.status] ?? w.status} />}
          >
            <Line>
              {statusLabel[w.status]} ·{' '}
              {w.user_id === userId ? 'Yêu cầu của bạn' : 'Yêu cầu của thành viên khác'}
            </Line>
            <Line>
              Khởi hành: {historyTimeLabel(w.normalized_query.departure_at)} · Hết hạn: {historyTimeLabel(w.expires_at)}
            </Line>
            <Line>Ngưỡng riêng: {moneyLabel(w.threshold_price)}</Line>
            <Line>
              {w.normalized_query.journey_type === 'ROUND_TRIP'
                ? `Khứ hồi · về ${w.normalized_query.return_date}`
                : 'Một chiều'}{' '}
              · {w.normalized_query.passengers.adults} người lớn,{' '}
              {w.normalized_query.passengers.children} trẻ em,{' '}
              {w.normalized_query.passengers.infants} em bé
            </Line>
            {w.status_reason && <Line>Lý do trạng thái: {w.status_reason}</Line>}
            <Line>
              Cảnh báo gần nhất:{' '}
              {w.last_alert_at && w.last_alert_price
                ? `${moneyLabel(w.last_alert_price)} lúc ${historyTimeLabel(w.last_alert_at)}`
                : 'Chưa ghi nhận'}
            </Line>
            <WatchHistory key={`${w.id}:${w.version}`} watch={w} />
            {w.user_id === userId && ['ACTIVE', 'PAUSED'].includes(w.status) && (
              <View style={ui.actionRow}>
                <Button
                  label="Sửa theo dõi giá"
                  compact
                  variant="soft"
                  onPress={() => edit(w)}
                  disabled={command.blocked || !writable}
                />
                <Button
                  label={w.status === 'ACTIVE' ? 'Tạm dừng theo dõi' : 'Tiếp tục theo dõi'}
                  compact
                  variant="soft"
                  onPress={() => transition(w, w.status === 'ACTIVE' ? 'pause' : 'resume')}
                  disabled={command.blocked || !writable}
                />
                <Button
                  label="Dừng theo dõi"
                  compact
                  variant="destructive"
                  onPress={() => transition(w, 'stop')}
                  disabled={command.blocked || !writable}
                />
              </View>
            )}
          </Card>
        ))}
      {list.data && !list.data.items.some((w) => filter === 'ALL' || w.status === filter) && (
        <Notice>Không có yêu cầu trong các trang đã tải phù hợp bộ lọc.</Notice>
      )}
      {list.data?.next_cursor && (
        <Button
          label="Tải thêm yêu cầu"
          loading={loadingMore}
          onPress={() => {
            void more();
          }}
        />
      )}
      {form && <ActionSheet form={form} close={() => setForm(undefined)} />}
    </Screen>
  );
}
function WatchHistory({ watch }: { watch: Watch }) {
  const api = useApi(),
    [expanded, setExpanded] = useState(false),
    [moreBusy, setMoreBusy] = useState(false),
    [moreError, setMoreError] = useState<string>();
  const epoch = useRef(0);
  const history = useResource(
    useCallback(
      (signal: AbortSignal) => {
        epoch.current++;
        return api.priceWatch.observations(watch.id, null, signal);
      },
      [api, watch.id],
    ),
    expanded,
  );
  async function more() {
    if (!history.data?.next_cursor || moreBusy) return;
    const cursor = history.data.next_cursor,
      generation = epoch.current;
    setMoreBusy(true);
    setMoreError(undefined);
    try {
      const next = await api.priceWatch.observations(watch.id, cursor);
      if (generation === epoch.current)
        history.setData((old) =>
          old?.next_cursor === cursor
            ? {
                ...old,
                stale: old.stale || next.stale,
                last_error: next.last_error ?? old.last_error,
                items: [
                  ...old.items,
                  ...next.items.filter((o) => !old.items.some((v) => v.id === o.id)),
                ],
                next_cursor: next.next_cursor,
              }
            : old,
        );
    } catch (e) {
      setMoreError(e instanceof Error ? e.message : 'Không thể tải thêm giá.');
    } finally {
      setMoreBusy(false);
    }
  }
  const source: Observations | undefined = history.data;
  const latest = source?.items[0];
  return (
    <>
      <Button
        label={expanded ? 'Ẩn lịch sử giá' : 'Xem lịch sử giá'}
        variant="soft"
        onPress={() => setExpanded((v) => !v)}
      />
      {expanded && (
        <>
          <ResourceFeedback
            {...history}
            hasData={!!source}
            onRetry={() => {
              void history.reload();
            }}
          />
          {source?.stale && (
            <Notice>
              Giá cũ · Nguồn giá chưa cập nhật thành công. Giá lưu trước đó không phải giá hiện tại.
            </Notice>
          )}
          {source?.last_error && <Notice>Nguồn giá tạm lỗi; có thể thử tải lại sau.</Notice>}
          {latest && (
            <Line>
              {source?.stale ? 'Giá cũ gần nhất' : 'Giá mô phỏng gần nhất'}:{' '}
              {moneyLabel(latest.price)}
              {!source?.stale && BigInt(latest.price) < BigInt(watch.threshold_price)
                ? ' · Dưới ngưỡng riêng'
                : ''}
            </Line>
          )}
          {source && !source.items.length && (
            <Notice>Chưa có kết quả giá. Không suy ra giá bằng 0 hoặc đã có cảnh báo.</Notice>
          )}
          {source?.items.map((o) => (
            <Line key={o.id}>
              {moneyLabel(o.price)} · {o.provider} · Quan sát: {historyTimeLabel(o.observed_at)} · Thu thập:{' '}
              {historyTimeLabel(o.fetched_at)}
            </Line>
          ))}
          {moreError && <Notice>{moreError}</Notice>}
          <Button
            label="Làm mới lịch sử giá"
            variant="soft"
            onPress={() => {
              void history.reload();
            }}
            disabled={history.loading}
          />
          {source?.next_cursor && (
            <Button
              label="Tải thêm kết quả giá"
              loading={moreBusy}
              onPress={() => {
                void more();
              }}
            />
          )}
        </>
      )}
    </>
  );
}
