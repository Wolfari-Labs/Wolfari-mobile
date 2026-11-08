import { useCallback, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { useSession } from '@/features/auth/session/session-provider';
import {
  historyActionLabel,
  historyActorLabel,
  historyEntityLabel,
  historyTimeLabel,
} from '@/features/finance/history-labels';
import { useApi } from '@/shared/api/use-api';
import { useResource } from '@/shared/hooks/use-resource';
import { Button } from '@/shared/ui/button';
import { Heading, Notice, ResourceFeedback, Segments } from '@/shared/ui/journal';
import { Screen } from '@/shared/ui/screen';
import { Sheet } from '@/shared/ui/sheet';
import { ActionSheet, Card, Line, type ActionForm, type Field } from '../../finance/components';
import { useFundCommand } from '../../finance/use-fund-command';
import { OperationFeedback } from '@/shared/operations/operation-feedback';
import {
  money,
  moneyLabel,
  required,
  statusLabel,
  sandboxPaymentUrl,
  type FinanceCollections,
  type Page,
  type PaymentAttempt,
} from '../../finance/extended-model';
import type { WriteIntent } from '../../finance/api';
import { collectPages } from '../api/pagination';
import { userNamer } from '../model/member-name';

/**
 * Extended Finance tools. Everyday fund work (setup, VietQR, contributions, expenses, refunds,
 * ledger, closure) lives only on the main Fund screen; this screen holds what that screen does not:
 * off-fund notes, audit history, MoMo Sandbox payments and payment reconciliation.
 */
type Tab = 'notes' | 'history' | 'momo' | 'payment-exceptions';
const tabs: { value: Tab; label: string }[] = [
  { value: 'notes', label: 'Ngoài quỹ' },
  { value: 'history', label: 'Lịch sử' },
  { value: 'momo', label: 'MoMo Sandbox' },
  { value: 'payment-exceptions', label: 'Đối soát' },
];
const collectionFor = (tab: Tab): keyof FinanceCollections =>
  tab === 'momo' ? 'contributions' : tab;
const amountField: Field = { key: 'amount', label: 'Số tiền (VND)', numeric: true };
const reasonField: Field = { key: 'reason', label: 'Lý do', multiline: true };

export default function FundToolsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  return <FundTools key={`${profile?.id}:${id}`} id={id} userId={profile?.id ?? ''} />;
}
function FundTools({ id, userId }: { id: string; userId: string }) {
  const api = useApi();
  const [tab, setTab] = useState<Tab>('notes');
  const [form, setForm] = useState<ActionForm>();
  const [attempt, setAttempt] = useState<PaymentAttempt>();
  const [dismissedAttempt, setDismissedAttempt] = useState<string>();
  const [readError, setReadError] = useState<string>();
  const resource = useResource(
    useCallback(
      async (signal: AbortSignal) => {
        const [trip, fund] = await Promise.all([
          api.trips.get(id, signal),
          api.finance.fund(id, signal),
        ]);
        return { trip: fund ? trip : await api.trips.get(id, signal), fund };
      },
      [api, id],
    ),
    !!userId && !!id,
  );
  const fund = resource.data?.fund,
    trip = resource.data?.trip;
  const owner = trip?.current_membership.role === 'OWNER' && !trip.current_membership.left_at;
  const holder = fund?.holder_user_id === userId;
  const writable =
    !!trip &&
    trip.lifecycle !== 'ARCHIVED' &&
    !trip.current_membership.left_at &&
    !resource.loading &&
    !resource.error;
  const reload = resource.reload;
  const command = useFundCommand(id, reload);
  const returnedPayment =
    command.lastResult &&
    typeof command.lastResult === 'object' &&
    'provider' in command.lastResult &&
    command.lastResult.provider === 'MOMO_SANDBOX'
      ? (command.lastResult as PaymentAttempt)
      : undefined;
  const activeAttempt =
    attempt ?? (returnedPayment?.id !== dismissedAttempt ? returnedPayment : undefined);
  const closeAttempt = () => {
    setDismissedAttempt(activeAttempt?.id);
    setAttempt(undefined);
  };
  const members = useResource(
    useCallback(
      (signal: AbortSignal) => collectPages((cursor) => api.trips.members(id, cursor, signal)),
      [api, id],
    ),
    !!trip,
  );
  const destinations = useResource(
    useCallback(
      (signal: AbortSignal) =>
        fund ? api.finance.destinations(fund.id, signal) : Promise.resolve([]),
      [api, fund],
    ),
    !!fund && tab === 'momo',
  );
  const pageEpoch = useRef(0);
  const canReconcile = !!owner || holder;
  const page = useResource(
    useCallback(
      async (
        signal: AbortSignal,
      ): Promise<
        Page<FinanceCollections[keyof FinanceCollections]> & { collection: Tab; fundId: string | null }
      > => {
        pageEpoch.current++;
        if (!fund) return { items: [], next_cursor: null, collection: tab, fundId: null };
        return {
          ...(await api.finance.list(fund.id, collectionFor(tab), null, signal)),
          collection: tab,
          fundId: fund.id,
        };
      },
      [api, fund, tab],
    ),
    !!fund && (tab !== 'payment-exceptions' || canReconcile),
  );
  const visiblePage =
    page.data?.collection === tab && page.data.fundId === fund?.id ? page.data : undefined;
  const [loadingMore, setLoadingMore] = useState(false);
  const disabled = command.blocked || !writable || !!page.error || page.loading;
  const who = userNamer(members.data, userId);
  const version = (entity?: { version: number }) => ({
    expected_finance_version: fund!.finance_version,
    ...(entity ? { expected_version: entity.version } : {}),
  });
  const open = (
    title: string,
    path: string,
    method: WriteIntent['method'],
    fields: Field[],
    body: (v: Record<string, string>) => Record<string, unknown>,
    message = 'Kiểm tra nội dung trước khi xác nhận. Số dư chỉ thay đổi khi server ghi nhận đúng nghiệp vụ.',
  ) =>
    setForm({
      title,
      message,
      fields,
      submit: async (v) => {
        const input = body(v);
        const result = await command.send({ label: title, path, method, body: input });
        if (path.endsWith('/payment-attempts') && result?.done && result.result)
          setAttempt(result.result as PaymentAttempt);
        return true;
      },
    });
  const action = (
    label: string,
    path: string,
    body: Record<string, unknown>,
    withReason = false,
    method: WriteIntent['method'] = 'POST',
    message?: string,
  ) =>
    open(
      label,
      path,
      method,
      withReason ? [reasonField] : [],
      (v) => ({ ...body, ...(withReason ? { reason: required(v.reason) } : {}) }),
      message,
    );
  async function read<T>(load: () => Promise<T>, accept: (result: T) => void) {
    setReadError(undefined);
    try {
      accept(await load());
    } catch (e) {
      setReadError(e instanceof Error ? e.message : 'Không thể tải dữ liệu.');
    }
  }
  async function more() {
    if (!fund || !visiblePage?.next_cursor || loadingMore) return;
    setLoadingMore(true);
    const cursor = visiblePage.next_cursor;
    const collection = collectionFor(tab);
    const generation = pageEpoch.current;
    await read(
      () => api.finance.list(fund.id, collection, cursor),
      (next) =>
        page.setData((old) =>
          generation === pageEpoch.current && old && old.next_cursor === cursor
            ? {
                ...old,
                items: [
                  ...old.items,
                  ...next.items.filter((item) => !old.items.some((v) => v.id === item.id)),
                ],
                next_cursor: next.next_cursor,
              }
            : old,
        ),
    );
    setLoadingMore(false);
  }
  const btn = (label: string, onPress: () => void, inactive = disabled) => (
    <Button key={label} label={label} variant="soft" disabled={inactive} onPress={onPress} />
  );
  const lookupAttempt = (message: string) =>
    setForm({
      title: 'Tra cứu lần thanh toán',
      message,
      fields: [{ key: 'id', label: 'Mã lần thanh toán' }],
      submit: async (v) => {
        await read(() => api.finance.attempt(required(v.id)), setAttempt);
        return true;
      },
    });
  const items = visiblePage?.items ?? [];
  const momoContributions = (items as FinanceCollections['contributions'][]).filter(
    (c) => c.member_user_id === userId && c.status === 'PENDING',
  );
  const momoDestinations = (destinations.data ?? []).filter(
    (d) => d.destination_type === 'MOMO_SANDBOX',
  );
  const shown =
    tab === 'momo' ? momoContributions.length : tab === 'payment-exceptions' && !canReconcile ? 1 : items.length;
  return (
    <Screen
      title="Công cụ quỹ mở rộng"
      tab="trips"
      onRefresh={() => {
        void reload();
      }}
      refreshing={resource.loading && !!trip}
    >
      <Heading title="Công cụ quỹ mở rộng" subtitle={trip?.name} />
      <ResourceFeedback
        {...resource}
        hasData={!!trip}
        onRetry={() => {
          void reload();
        }}
      />
      <OperationFeedback operation={command.operation} onFinish={async () => { await reload(); }} />
      <Button
        label="Quay lại quỹ"
        variant="soft"
        onPress={() => router.push({ pathname: '/trip/[id]/fund', params: { id } })}
      />
      {readError && <Notice>{readError}</Notice>}
      {trip && fund === null && (
        <Notice>
          Chuyến đi chưa có quỹ. Chủ nhóm mở quỹ ở màn Quỹ nhóm; các công cụ ở đây dùng sau khi quỹ
          đã mở.
        </Notice>
      )}
      {fund && (
        <>
          <Line>
            {statusLabel[fund.status]} · Số dư: {moneyLabel(fund.current_balance)} · Vai trò:{' '}
            {[owner && 'Chủ nhóm', holder && 'Người giữ quỹ'].filter(Boolean).join(' · ') ||
              'Thành viên'}
          </Line>
          {(!writable || fund.status !== 'OPEN') && (
            <Notice>Quỹ/chuyến đi hiện chỉ đọc. Server sẽ kiểm tra lại quyền và trạng thái.</Notice>
          )}
          <Segments
            scroll
            items={tabs}
            value={tab}
            onChange={(v) => {
              setTab(v as Tab);
              setReadError(undefined);
            }}
          />
          {(tab !== 'payment-exceptions' || canReconcile) && (
            <ResourceFeedback
              {...page}
              hasData={!!visiblePage}
              onRetry={() => {
                void page.reload();
              }}
            />
          )}
          {tab === 'notes' && (
            <>
              <Notice>Khoản ngoài quỹ chỉ là ghi chú; không cộng/trừ số dư sổ quỹ.</Notice>
              {fund.status === 'OPEN' &&
                btn('Thêm khoản ngoài quỹ', () =>
                  open(
                    'Thêm khoản ngoài quỹ',
                    `/funds/${fund.id}/notes`,
                    'POST',
                    [
                      { key: 'description', label: 'Mô tả', multiline: true },
                      { ...amountField, label: 'Số tiền (VND; tùy chọn)' },
                    ],
                    (v) => ({
                      description: required(v.description, 10000),
                      amount: v.amount ? money(v.amount) : null,
                      payer_user_id: userId,
                      ...version(),
                    }),
                  ),
                )}
              {(items as FinanceCollections['notes'][]).map((n) => (
                <Card key={n.id} title={n.description}>
                  <Line>
                    {moneyLabel(n.amount)} · {who(n.created_by_user_id)}
                  </Line>
                  {fund.status === 'OPEN' && (owner || n.created_by_user_id === userId) && (
                    <>
                      {btn('Sửa khoản ngoài quỹ', () =>
                        open(
                          'Sửa khoản ngoài quỹ',
                          `/notes/${n.id}`,
                          'PATCH',
                          [
                            { key: 'description', label: 'Mô tả', value: n.description },
                            { ...amountField, value: n.amount ?? '' },
                          ],
                          (v) => ({
                            description: required(v.description, 10000),
                            amount: v.amount ? money(v.amount) : null,
                            ...version(n),
                          }),
                        ),
                      )}
                      {btn('Xóa khoản ngoài quỹ', () =>
                        action('Xóa khoản ngoài quỹ', `/notes/${n.id}`, version(n), false, 'DELETE'),
                      )}
                    </>
                  )}
                </Card>
              ))}
            </>
          )}
          {tab === 'history' &&
            (items as FinanceCollections['history'][]).map((h) => (
              <Card key={h.id} title={historyActionLabel(h.action)}>
                <Line>
                  {historyActorLabel(h, who)} · {historyTimeLabel(h.occurred_at, trip?.timezone)}
                </Line>
                <Line>{historyEntityLabel(h.entity_type)}</Line>
                <Line>
                  Phiên bản {h.from_version ?? '—'} → {h.to_version ?? '—'}
                </Line>
                {h.reason && <Line>{h.reason}</Line>}
              </Card>
            ))}
          {tab === 'momo' && (
            <>
              <Notice>
                Chỉ môi trường thử nghiệm MoMo Sandbox, không phải thanh toán thật. Chuyển khoản
                VietQR và báo chuyển tiền dùng ở tab Đóng góp của màn Quỹ nhóm.
              </Notice>
              <ResourceFeedback
                {...destinations}
                hasData={!!destinations.data}
                onRetry={() => {
                  void destinations.reload();
                }}
              />
              {momoDestinations.map((d) => (
                <Line key={d.id}>
                  Nơi nhận MoMo Sandbox {d.momo_phone ?? ''} ·{' '}
                  {d.active ? 'Đang dùng' : 'Ngừng dùng'} ·{' '}
                  {d.confirmed_by_holder_at ? 'Người giữ quỹ đã xác nhận' : 'Chưa xác nhận'}
                </Line>
              ))}
              {owner &&
                fund.status === 'OPEN' &&
                btn('Thêm nơi nhận MoMo Sandbox', () =>
                  open(
                    'Thêm nơi nhận MoMo Sandbox',
                    `/funds/${fund.id}/destinations`,
                    'POST',
                    [{ key: 'momo_phone', label: 'Số điện thoại MoMo Sandbox' }],
                    (v) => ({
                      destination_type: 'MOMO_SANDBOX',
                      momo_phone: required(v.momo_phone, 30),
                      active: true,
                      is_default: false,
                      ...version(),
                    }),
                    'Người giữ quỹ cần xác nhận nơi nhận này ở màn Quỹ nhóm trước khi dùng.',
                  ),
                )}
              {btn(
                'Tra cứu lần thanh toán của tôi',
                () => lookupAttempt('Mã lần thanh toán được trả về khi tạo MoMo Sandbox.'),
                command.busy,
              )}
              {momoContributions.map((c) => (
                <Card key={c.id} title={`${moneyLabel(c.amount)} · Khoản của bạn`}>
                  <Line>{statusLabel[c.status]}</Line>
                  {writable &&
                    fund.status === 'OPEN' &&
                    btn('Tạo thanh toán MoMo Sandbox', () =>
                      open(
                        'Tạo thanh toán MoMo Sandbox',
                        `/contributions/${c.id}/payment-attempts`,
                        'POST',
                        [],
                        () => ({ provider: 'MOMO_SANDBOX', ...version(c) }),
                        'Chỉ MoMo Sandbox. Nếu nơi nhận hoặc provider chưa sẵn sàng, server sẽ từ chối; app không tự ghi nhận tiền.',
                      ),
                    )}
                </Card>
              ))}
            </>
          )}
          {tab === 'payment-exceptions' &&
            (canReconcile ? (
              <>
                {btn(
                  'Tra cứu lần thanh toán',
                  () =>
                    lookupAttempt(
                      'Nhập mã lần thanh toán đã được server trả về. Chỉ người thanh toán/người giữ quỹ được đọc.',
                    ),
                  command.busy,
                )}
                {(items as FinanceCollections['payment-exceptions'][]).map((p) => (
                  <Card key={p.id} title={p.processing_status}>
                    <Line>
                      {p.review_reason ?? 'Chưa có lý do'} ·{' '}
                      {historyTimeLabel(p.received_at, trip?.timezone)}
                    </Line>
                    {p.payment_attempt_id &&
                      btn(
                        'Xem lần thanh toán',
                        () => {
                          void read(() => api.finance.attempt(p.payment_attempt_id!), setAttempt);
                        },
                        command.busy,
                      )}
                    {holder &&
                      !p.reviewed_at &&
                      btn('Xử lý ngoại lệ thanh toán', () =>
                        open(
                          'Xử lý ngoại lệ thanh toán',
                          `/payment-exceptions/${p.id}/resolve`,
                          'POST',
                          [
                            {
                              key: 'resolution',
                              label: 'Kết luận sau đối soát',
                              value: 'NO_FINANCIAL_EFFECT',
                              options: [
                                { value: 'NO_FINANCIAL_EFFECT', label: 'Không ảnh hưởng tài chính' },
                                { value: 'LINKED', label: 'Liên kết lần thanh toán' },
                              ],
                            },
                            { key: 'linked_attempt_id', label: 'Mã lần thanh toán (nếu liên kết)' },
                            reasonField,
                          ],
                          (v) => ({
                            resolution: v.resolution,
                            ...(v.resolution === 'LINKED'
                              ? { linked_attempt_id: required(v.linked_attempt_id) }
                              : {}),
                            reason: required(v.reason),
                            ...version(),
                          }),
                          'Chỉ kết luận sau khi kiểm tra dữ liệu Sandbox. Không suy đoán giao dịch đã thành công.',
                        ),
                      )}
                  </Card>
                ))}
              </>
            ) : (
              <Notice>Chỉ chủ nhóm và người giữ quỹ xem được đối soát thanh toán.</Notice>
            ))}
          {shown === 0 && !page.loading && !page.error && (
            <Notice>Chưa có bản ghi trong mục này.</Notice>
          )}
          {!!visiblePage?.next_cursor && (
            <Button
              label="Tải thêm"
              loading={loadingMore}
              onPress={() => {
                void more();
              }}
            />
          )}
        </>
      )}
      {form && <ActionSheet form={form} close={() => setForm(undefined)} />}
      {activeAttempt && (
        <Sheet visible title="Thanh toán MoMo Sandbox" onClose={closeAttempt}>
          <Line>
            {activeAttempt.id} · {activeAttempt.status}
          </Line>
          <Line>{moneyLabel(activeAttempt.amount)}</Line>
          <Button
            label="Sao chép mã lần thanh toán"
            onPress={() => {
              void read(
                () => Clipboard.setStringAsync(activeAttempt.id),
                () => setReadError('Đã sao chép mã lần thanh toán.'),
              );
            }}
          />
          {activeAttempt.payment_url && (
            <Button
              label="Mở trang MoMo Sandbox"
              onPress={() => {
                void read(
                  async () => {
                    if (activeAttempt.environment !== 'SANDBOX')
                      throw Error('Sai môi trường thanh toán.');
                    await Linking.openURL(sandboxPaymentUrl(activeAttempt.payment_url!));
                  },
                  () => {},
                );
              }}
            />
          )}
          <Notice>
            Chỉ trạng thái từ server có giá trị đối chiếu. Mở liên kết không đồng nghĩa đã thanh
            toán.
          </Notice>
          <Button
            label="Làm mới trạng thái thanh toán"
            onPress={() => {
              void read(() => api.finance.attempt(activeAttempt.id), setAttempt);
            }}
          />
          {holder && (
            <Button
              label="Yêu cầu đối soát MoMo"
              onPress={() => {
                const saved = activeAttempt;
                closeAttempt();
                action(
                  'Yêu cầu đối soát MoMo',
                  `/payment-attempts/${saved.id}/reconcile`,
                  {},
                  true,
                );
              }}
            />
          )}
        </Sheet>
      )}
    </Screen>
  );
}
