import { useCallback, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { useSession } from '@/features/auth/session/session-provider';
import { PaymentQrEntry } from '@/features/payments/components/payment-qr-entry';
import { useApi } from '@/shared/api/use-api';
import { useResource } from '@/shared/hooks/use-resource';
import { Button } from '@/shared/ui/button';
import { Heading, Notice, ResourceFeedback, Segments } from '@/shared/ui/journal';
import { Screen } from '@/shared/ui/screen';
import { Sheet } from '@/shared/ui/sheet';
import {
  ActionSheet,
  Card,
  Line,
  type ActionForm,
  type Field,
} from '../../finance/components';
import { useFundCommand } from '../../finance/use-fund-command';
import { OperationFeedback } from '@/shared/operations/operation-feedback';
import {
  contributionActions,
  money,
  moneyLabel,
  required,
  statusLabel,
  sandboxPaymentUrl,
  instructionQrUrl,
  type FinanceCollections,
  type Page,
  type PaymentAttempt,
  type PaymentInstruction,
} from '../../finance/extended-model';
import type { WriteIntent } from '../../finance/api';
import { collectPages } from '../api/pagination';

const tabs: { value: keyof FinanceCollections | 'setup'; label: string }[] = [
  { value: 'contributions', label: 'Đóng góp' },
  { value: 'contribution-requests', label: 'Đợt đóng' },
  { value: 'expenses', label: 'Khoản chi' },
  { value: 'refunds', label: 'Hoàn tiền' },
  { value: 'notes', label: 'Ngoài quỹ' },
  { value: 'transactions', label: 'Sổ quỹ' },
  { value: 'history', label: 'Lịch sử' },
  { value: 'closures', label: 'Chốt quỹ' },
  { value: 'setup', label: 'Thiết lập' },
  { value: 'payment-exceptions', label: 'Đối soát' },
];
const amountField: Field = { key: 'amount', label: 'Số tiền (VND)', numeric: true };
const reasonField: Field = { key: 'reason', label: 'Lý do', multiline: true };
const titleField: Field = { key: 'title', label: 'Nội dung', multiline: true };
const destinationFields = (type: string, initial: Record<string, string> = {}): Field[] =>
  (type === 'VIETQR'
    ? [
        { key: 'bank_code', label: 'Mã ngân hàng thử nghiệm', placeholder: 'VCB' },
        { key: 'account_number', label: 'Số tài khoản thử nghiệm' },
        { key: 'account_name', label: 'Tên người nhận thử nghiệm' },
      ]
    : [{ key: 'momo_phone', label: 'Số điện thoại MoMo Sandbox' }]
  ).map((f) => ({ ...f, value: initial[f.key] ?? '' }));
function destinationInput(type: string, v: Record<string, string>) {
  return {
    destination_type: type,
    active: true,
    is_default: true,
    ...(type === 'VIETQR'
      ? {
          bank_code: required(v.bank_code, 30),
          account_number: required(v.account_number, 80),
          account_name: required(v.account_name, 150),
        }
      : { momo_phone: required(v.momo_phone, 30) }),
  };
}

export default function FundScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  return <FundWorkspace key={`${profile?.id}:${id}`} id={id} userId={profile?.id ?? ''} />;
}
function FundWorkspace({ id, userId }: { id: string; userId: string }) {
  const api = useApi();
  const [tab, setTab] = useState<keyof FinanceCollections | 'setup'>('contributions');
  const [form, setForm] = useState<ActionForm>();
  const [instruction, setInstruction] = useState<PaymentInstruction>(),
    [attempt, setAttempt] = useState<PaymentAttempt>();
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
    !!trip && !!owner,
  );
  const pageEpoch = useRef(0);
  const destinations = useResource(
    useCallback(
      (signal: AbortSignal) =>
        fund ? api.finance.destinations(fund.id, signal) : Promise.resolve([]),
      [api, fund],
    ),
    !!fund,
  );
  const page = useResource(
    useCallback(
      async (
        signal: AbortSignal,
      ): Promise<
        Page<FinanceCollections[keyof FinanceCollections]> & {
          collection: typeof tab;
          fundId: string | null;
        }
      > => {
        pageEpoch.current++;
        if (!fund || tab === 'setup')
          return { items: [], next_cursor: null, collection: tab, fundId: fund?.id ?? null };
        return {
          ...(await api.finance.list(fund.id, tab, null, signal)),
          collection: tab,
          fundId: fund.id,
        };
      },
      [api, fund, tab],
    ),
    !!fund && (tab !== 'payment-exceptions' || !!owner || holder),
  );
  const visiblePage =
    page.data?.collection === tab && page.data.fundId === fund?.id ? page.data : undefined;
  const [loadingMore, setLoadingMore] = useState(false);
  const disabled = command.blocked || !writable || !!page.error || page.loading;
  const memberOptions = (members.data ?? [])
    .filter((m) => !m.left_at)
    .map((m) => ({
      value: m.user_id,
      label:
        m.user_id === userId
          ? 'Bạn'
          : `Thành viên ${m.user_id.slice(0, 8)}${m.role === 'OWNER' ? ' (Owner)' : ''}`,
    }));
  const memberField: Field = {
    key: 'member_user_id',
    label: 'Thành viên',
    options: memberOptions,
    value: memberOptions[0]?.value,
  };
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
    if (!fund || tab === 'setup' || !visiblePage?.next_cursor || loadingMore) return;
    setLoadingMore(true);
    const cursor = visiblePage.next_cursor;
    const currentTab = tab;
    const generation = pageEpoch.current;
    await read(
      () => api.finance.list(fund.id, currentTab, cursor),
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
  const receiptField: Field = {
    key: 'receipt_object_key',
    label: 'Chứng từ',
    receiptFundId: fund?.id,
  };
  function createRequest() {
    const available = (destinations.data ?? []).filter((d) => d.active && d.confirmed_by_holder_at);
    open(
      'Tạo đợt đóng góp',
      `/funds/${fund!.id}/contribution-requests`,
      'POST',
      [
        titleField,
        {
          key: 'destination',
          label: 'Nơi nhận đã được người giữ quỹ xác nhận',
          value: available[0]?.id,
          options: available.map((d) => ({
            value: d.id,
            label: `${d.destination_type} · ${d.bank_code ?? d.momo_phone ?? ''} ${d.account_number ?? ''}`,
          })),
        },
        { key: 'note', label: 'Ghi chú' },
        ...memberOptions.map((m) => ({
          key: m.value,
          label: `Mức đóng của ${m.label} (VND; bỏ trống để bỏ qua)`,
          numeric: true,
        })),
      ],
      (v) => {
        if (!available.some((d) => d.id === v.destination))
          throw Error('Cần nơi nhận đang hoạt động và đã xác nhận.');
        const contributions = memberOptions
          .filter((m) => v[m.value]?.trim())
          .map((m) => ({
            member_user_id: m.value,
            amount: money(v[m.value]),
            destination_id: v.destination,
          }));
        if (!contributions.length) throw Error('Nhập ít nhất một khoản đóng.');
        return {
          title: required(v.title, 200),
          contributions,
          ...(v.note ? { note: v.note } : {}),
          ...version(),
        };
      },
    );
  }
  function createFund(type: string) {
    open(
      'Bật quỹ nhóm',
      `/trips/${id}/fund`,
      'POST',
      [
        memberField,
        { ...amountField, key: 'budget_amount', label: 'Ngân sách dự kiến (VND; có thể để trống)' },
        ...destinationFields(type),
      ],
      (v) => ({
        holder_user_id: required(v.member_user_id),
        currency: 'VND',
        ...(v.budget_amount ? { budget_amount: money(v.budget_amount, false) } : {}),
        destination: destinationInput(type, v),
      }),
      'Owner chọn người giữ quỹ cố định. Nơi nhận cần được chính người giữ quỹ xác nhận trước khi tạo khoản đóng. Chỉ dùng dữ liệu TEST/Sandbox.',
    );
  }
  return (
    <Screen
      title="Quỹ nhóm"
      tab="trips"
      onRefresh={() => {
        void reload();
      }}
      refreshing={resource.loading && !!trip}
    >
      <Heading title="Quỹ nhóm" subtitle={trip?.name} />
      <ResourceFeedback
        {...resource}
        hasData={!!trip}
        onRetry={() => {
          void reload();
        }}
      />
      <Button
        label="Tải lại quỹ"
        variant="soft"
        onPress={() => {
          void reload();
        }}
        disabled={resource.loading}
      />
      <OperationFeedback operation={command.operation} onFinish={async () => { await reload(); }} />
      <Button label="Quay lại quỹ" variant="soft" onPress={() => router.push({ pathname: '/trip/[id]/fund', params: { id } })} />
      {readError && <Notice>{readError}</Notice>}
      {trip && (
        <>
          <PaymentQrEntry key={id} />
          <Button
            label="Dự toán riêng trên thiết bị"
            variant="soft"
            onPress={() => router.push(`/trip/${id}/fund-drafts`)}
          />
        </>
      )}
      {trip && fund === null && (
        <>
          <Notice>
            Chuyến đi chưa có quỹ. Đây không phải số dư 0 VND của một quỹ đang hoạt động.
          </Notice>
          {owner && writable && (
            <>
              <ResourceFeedback
                {...members}
                hasData={!!members.data}
                onRetry={() => {
                  void members.reload();
                }}
              />
              {btn(
                'Bật quỹ với VietQR TEST',
                () => createFund('VIETQR'),
                command.blocked || !members.data,
              )}
              {btn(
                'Bật quỹ với MoMo Sandbox',
                () => createFund('MOMO_SANDBOX'),
                command.blocked || !members.data,
              )}
            </>
          )}
        </>
      )}
      {fund && (
        <>
          <Card title={`Trạng thái: ${statusLabel[fund.status]}`}>
            <Line>Số dư: {moneyLabel(fund.current_balance)}</Line>
            <Line>Dự phòng hoàn: {moneyLabel(fund.reserved_refund)}</Line>
            <Line>Khả dụng: {moneyLabel(fund.available_balance)}</Line>
            <Line>Ngân sách: {moneyLabel(fund.budget_amount)}</Line>
            <Line>
              Vai trò: {holder ? 'Người giữ quỹ' : owner ? 'Owner' : 'Thành viên'}
              {holder && owner ? ' · Owner' : ''}
            </Line>
          </Card>
          {(!writable || fund.status !== 'OPEN') && (
            <Notice>
              Quỹ/chuyến đi hiện hạn chế thao tác. Chỉ các bước chốt quỹ hợp lệ được hiển thị;
              server sẽ kiểm tra lại quyền và trạng thái.
            </Notice>
          )}
          <Segments
            scroll
            items={tabs.filter((t) => t.value !== 'payment-exceptions' || owner || holder)}
            value={tab}
            onChange={(v) => {
              setTab(v as typeof tab);
              setReadError(undefined);
            }}
          />
          {tab !== 'setup' && (
            <ResourceFeedback
              {...page}
              hasData={!!visiblePage}
              onRetry={() => {
                void page.reload();
              }}
            />
          )}
          {tab === 'setup' && (
            <>
              <ResourceFeedback
                {...destinations}
                hasData={!!destinations.data}
                onRetry={() => {
                  void destinations.reload();
                }}
              />
              {owner && fund.status === 'OPEN' && (
                <>
                  {btn('Sửa ngân sách', () =>
                    open(
                      'Sửa ngân sách',
                      `/funds/${fund.id}/budget`,
                      'PATCH',
                      [
                        {
                          key: 'budget_amount',
                          label: 'Ngân sách (VND; trống để xóa)',
                          value: fund.budget_amount ?? '',
                          numeric: true,
                        },
                      ],
                      (v) => ({
                        budget_amount: v.budget_amount ? money(v.budget_amount, false) : null,
                        ...version(),
                      }),
                    ),
                  )}
                  {['VIETQR', 'MOMO_SANDBOX'].map((type) =>
                    btn(`Thêm nơi nhận ${type}`, () =>
                      open(
                        `Thêm nơi nhận ${type}`,
                        `/funds/${fund.id}/destinations`,
                        'POST',
                        destinationFields(type),
                        (v) => ({ ...destinationInput(type, v), ...version() }),
                      ),
                    ),
                  )}
                </>
              )}
              {destinations.data?.map((d) => (
                <Card
                  key={d.id}
                  title={`${d.destination_type}${d.is_default ? ' · Mặc định' : ''}`}
                >
                  <Line>
                    {d.active ? 'Đang dùng' : 'Ngừng dùng'} ·{' '}
                    {d.confirmed_by_holder_at ? 'Người giữ quỹ đã xác nhận' : 'Chưa xác nhận'}
                  </Line>
                  {d.account_number && (
                    <Line>
                      {d.bank_code} · {d.account_number} · {d.account_name}
                    </Line>
                  )}
                  {d.momo_phone && <Line>{d.momo_phone}</Line>}
                  {fund.status === 'OPEN' && (
                    <>
                      {holder &&
                        !d.confirmed_by_holder_at &&
                        d.active &&
                        btn('Xác nhận nơi nhận', () =>
                          action(
                            'Xác nhận nơi nhận',
                            `/funds/${fund.id}/destinations/${d.id}/confirm`,
                            version(d),
                          ),
                        )}
                      {owner && (
                        <>
                          {btn('Sửa nơi nhận', () =>
                            open(
                              'Sửa nơi nhận',
                              `/funds/${fund.id}/destinations/${d.id}`,
                              'PATCH',
                              destinationFields(d.destination_type, {
                                bank_code: d.bank_code ?? '',
                                account_number: d.account_number ?? '',
                                account_name: d.account_name ?? '',
                                momo_phone: d.momo_phone ?? '',
                              }),
                              (v) => {
                                const {
                                  active: _active,
                                  is_default: _default,
                                  ...recipient
                                } = destinationInput(d.destination_type, v);
                                return { ...recipient, ...version(d) };
                              },
                              'Thay đổi thông tin người nhận sẽ xóa xác nhận cũ. Người giữ quỹ cần xác nhận lại.',
                            ),
                          )}
                          {btn(d.active ? 'Ngừng dùng nơi nhận' : 'Dùng lại nơi nhận', () =>
                            action(
                              'Đổi trạng thái nơi nhận',
                              `/funds/${fund.id}/destinations/${d.id}`,
                              { active: !d.active, ...version(d) },
                              false,
                              'PATCH',
                            ),
                          )}
                          {!d.is_default &&
                            btn('Đặt làm mặc định', () =>
                              action(
                                'Đặt làm mặc định',
                                `/funds/${fund.id}/destinations/${d.id}`,
                                { is_default: true, ...version(d) },
                                false,
                                'PATCH',
                              ),
                            )}
                        </>
                      )}
                    </>
                  )}
                </Card>
              ))}
            </>
          )}
          {tab === 'contribution-requests' &&
            owner &&
            fund.status === 'OPEN' &&
            btn('Tạo đợt đóng góp', createRequest, disabled || !members.data || !destinations.data)}
          {tab === 'contributions' &&
            btn(
              'Tra cứu lần thanh toán của tôi',
              () =>
                setForm({
                  title: 'Tra cứu lần thanh toán',
                  message: 'Mã lần thanh toán được trả về khi tạo MoMo Sandbox.',
                  fields: [{ key: 'id', label: 'Mã lần thanh toán' }],
                  submit: async (v) => {
                    await read(() => api.finance.attempt(required(v.id)), setAttempt);
                    return true;
                  },
                }),
              command.busy,
            )}
          {tab === 'contributions' &&
            (visiblePage?.items as FinanceCollections['contributions'][] | undefined)?.map((c) => (
              <Card
                key={c.id}
                title={`${moneyLabel(c.amount)} · ${c.member_user_id === userId ? 'Khoản của bạn' : c.member_user_id.slice(0, 8)}`}
              >
                <Line>
                  {statusLabel[c.status]}
                  {c.self_contribution ? ' · Người giữ quỹ tự đóng' : ''}
                </Line>
                {c.rejected_reason && <Line>Lý do từ chối gần nhất: {c.rejected_reason}</Line>}
                {contributionActions(c, fund, userId, !!owner, writable).map((a) => {
                  const labels: Record<string, string> = {
                    instruction: 'Thông tin chuyển khoản TEST',
                    'report-transfer': 'Báo đã chuyển',
                    'confirm-received': 'Xác nhận đã nhận đủ',
                    'reject-transfer': 'Từ chối báo chuyển',
                    edit: 'Sửa mức đóng',
                    waive: 'Miễn khoản đóng',
                    cancel: 'Hủy khoản đóng',
                    reverse: 'Đảo khoản thu',
                    payment: 'Tạo thanh toán MoMo Sandbox',
                  };
                  return btn(labels[a], () => {
                    if (a === 'instruction') {
                      void read(() => api.finance.instruction(c.id), setInstruction);
                      return;
                    }
                    if (a === 'edit') {
                      open(
                        labels[a],
                        `/contributions/${c.id}`,
                        'PATCH',
                        [{ ...amountField, value: c.amount }],
                        (v) => ({ amount: money(v.amount), ...version(c) }),
                      );
                      return;
                    }
                    if (a === 'report-transfer') {
                      open(
                        labels[a],
                        `/contributions/${c.id}/report-transfer`,
                        'POST',
                        [receiptField],
                        (v) => ({
                          ...version(c),
                          ...(v.receipt_object_key
                            ? { evidence_object_key: v.receipt_object_key }
                            : {}),
                        }),
                        'Báo chuyển chưa cộng số dư. Người giữ quỹ phải kiểm tra và xác nhận đã nhận đủ.',
                      );
                      return;
                    }
                    if (a === 'payment') {
                      open(
                        labels[a],
                        `/contributions/${c.id}/payment-attempts`,
                        'POST',
                        [],
                        () => ({ provider: 'MOMO_SANDBOX', ...version(c) }),
                        'Chỉ MoMo Sandbox. Nếu nơi nhận hoặc provider chưa sẵn sàng, server sẽ từ chối; app không tự ghi nhận tiền.',
                      );
                      return;
                    }
                    action(
                      labels[a],
                      `/contributions/${c.id}/${a}`,
                      version(c),
                      ['reject-transfer', 'waive', 'cancel', 'reverse'].includes(a),
                      'POST',
                      a === 'confirm-received'
                        ? `Chỉ xác nhận sau khi kiểm tra đã nhận đủ ${moneyLabel(c.amount)}. Thao tác này ghi một bút toán thu.`
                        : undefined,
                    );
                  });
                })}
              </Card>
            ))}
          {tab === 'contribution-requests' &&
            (visiblePage?.items as FinanceCollections['contribution-requests'][] | undefined)?.map(
              (r) => (
                <Card key={r.id} title={r.title}>
                  <Line>
                    {statusLabel[r.status]} · {r.contributions.length} khoản
                  </Line>
                  {r.note && <Line>{r.note}</Line>}
                  {r.contributions.map((c) => (
                    <Line key={c.id}>
                      {c.member_user_id.slice(0, 8)}: {moneyLabel(c.amount)} ·{' '}
                      {statusLabel[c.status]}
                    </Line>
                  ))}
                  {owner &&
                    fund.status === 'OPEN' &&
                    r.status === 'OPEN' &&
                    btn('Sửa đợt đóng', () =>
                      open(
                        'Sửa đợt đóng',
                        `/funds/${fund.id}/contribution-requests/${r.id}`,
                        'PATCH',
                        [
                          { ...titleField, value: r.title },
                          { key: 'note', label: 'Ghi chú', value: r.note ?? '' },
                          {
                            key: 'due_at',
                            label: 'Hạn đóng ISO có múi giờ (trống để giữ nguyên)',
                            placeholder: '2026-12-01T12:00:00+07:00',
                          },
                        ],
                        (v) => {
                          if (v.due_at && !Number.isFinite(Date.parse(v.due_at)))
                            throw Error('Hạn đóng không hợp lệ.');
                          return {
                            title: required(v.title, 200),
                            note: v.note,
                            ...(v.due_at ? { due_at: v.due_at } : {}),
                            ...version(r),
                          };
                        },
                      ),
                    )}
                </Card>
              ),
            )}
          {tab === 'expenses' &&
            fund.status === 'OPEN' &&
            btn('Đề xuất khoản chi', () =>
              open(
                'Đề xuất khoản chi',
                `/funds/${fund.id}/expenses`,
                'POST',
                [
                  titleField,
                  amountField,
                  { key: 'description', label: 'Mô tả' },
                  { key: 'category', label: 'Danh mục' },
                  receiptField,
                ],
                (v) => ({
                  title: required(v.title, 200),
                  amount: money(v.amount),
                  description: v.description || null,
                  category: v.category || null,
                  ...(v.receipt_object_key ? { receipt_object_key: v.receipt_object_key } : {}),
                  ...version(),
                }),
              ),
            )}
          {tab === 'expenses' &&
            (visiblePage?.items as FinanceCollections['expenses'][] | undefined)?.map((e) => (
              <Card key={e.id} title={e.title}>
                <Line>
                  {moneyLabel(e.amount)} · {statusLabel[e.status]}
                </Line>
                {e.description && <Line>{e.description}</Line>}
                {e.receipt_available && <Line>Đã đính kèm chứng từ.</Line>}
                {e.rejected_reason && <Line>{e.rejected_reason}</Line>}
                {fund.status === 'OPEN' && (
                  <>
                    {e.status === 'DRAFT' && (owner || e.created_by_user_id === userId) && (
                      <>
                        {btn('Sửa khoản chi', () =>
                          open(
                            'Sửa khoản chi',
                            `/expenses/${e.id}`,
                            'PATCH',
                            [
                              { ...titleField, value: e.title },
                              { ...amountField, value: e.amount },
                              { key: 'description', label: 'Mô tả', value: e.description ?? '' },
                              { key: 'category', label: 'Danh mục', value: e.category ?? '' },
                              receiptField,
                            ],
                            (v) => ({
                              title: required(v.title, 200),
                              amount: money(v.amount),
                              description: v.description || null,
                              category: v.category || null,
                              ...(v.receipt_object_key
                                ? { receipt_object_key: v.receipt_object_key }
                                : {}),
                              ...version(e),
                            }),
                          ),
                        )}
                        {btn('Gửi duyệt khoản chi', () =>
                          action('Gửi duyệt khoản chi', `/expenses/${e.id}/submit`, version(e)),
                        )}
                        {btn('Xóa khoản chi nháp', () =>
                          action(
                            'Xóa khoản chi nháp',
                            `/expenses/${e.id}`,
                            version(e),
                            false,
                            'DELETE',
                          ),
                        )}
                      </>
                    )}
                    {e.status === 'SUBMITTED' &&
                      e.created_by_user_id === userId &&
                      btn('Rút đề xuất', () =>
                        action('Rút đề xuất', `/expenses/${e.id}/withdraw`, version(e)),
                      )}
                    {e.status === 'SUBMITTED' && holder && (
                      <>
                        {btn('Xác nhận đã chi', () =>
                          open(
                            'Xác nhận đã chi',
                            `/expenses/${e.id}/confirm`,
                            'POST',
                            [
                              {
                                key: 'paid_at',
                                label: 'Thời điểm đã chi (ISO có múi giờ)',
                                value: new Date().toISOString(),
                              },
                              {
                                key: 'payment_method',
                                label: 'Phương thức chi',
                                value: 'CASH',
                                options: [
                                  { value: 'CASH', label: 'Tiền mặt' },
                                  { value: 'BANK_TRANSFER', label: 'Chuyển khoản' },
                                ],
                              },
                            ],
                            (v) => {
                              if (!Number.isFinite(Date.parse(v.paid_at)))
                                throw Error('Thời điểm không hợp lệ.');
                              return {
                                paid_at: v.paid_at,
                                payment_method: required(v.payment_method, 30),
                                ...version(e),
                              };
                            },
                            `Xác nhận đã chi ${moneyLabel(e.amount)} sẽ ghi bút toán chi. Kiểm tra số dư khả dụng trước khi xác nhận.`,
                          ),
                        )}
                        {btn('Từ chối khoản chi', () =>
                          action('Từ chối khoản chi', `/expenses/${e.id}/reject`, version(e), true),
                        )}
                      </>
                    )}
                    {e.status === 'CONFIRMED' &&
                      holder &&
                      btn('Đảo khoản chi', () =>
                        action('Đảo khoản chi', `/expenses/${e.id}/reverse`, version(e), true),
                      )}
                  </>
                )}
              </Card>
            ))}
          {tab === 'refunds' &&
            owner &&
            fund.status === 'OPEN' &&
            btn(
              'Tạo khoản hoàn',
              () =>
                open(
                  'Tạo khoản hoàn',
                  `/funds/${fund.id}/refunds`,
                  'POST',
                  [memberField, amountField, reasonField],
                  (v) => ({
                    member_user_id: required(v.member_user_id),
                    amount: money(v.amount),
                    reason: required(v.reason),
                    ...version(),
                  }),
                ),
              disabled || !members.data,
            )}
          {tab === 'refunds' &&
            (visiblePage?.items as FinanceCollections['refunds'][] | undefined)?.map((r) => (
              <Card
                key={r.id}
                title={`${moneyLabel(r.amount)} · ${r.member_user_id === userId ? 'Hoàn cho bạn' : r.member_user_id.slice(0, 8)}`}
              >
                <Line>
                  {statusLabel[r.status]} · {r.reason}
                </Line>
                {fund.status === 'OPEN' && (
                  <>
                    {r.status === 'PENDING' &&
                      holder &&
                      btn('Báo đã hoàn tiền', () =>
                        action('Báo đã hoàn tiền', `/refunds/${r.id}/report-paid`, version(r)),
                      )}
                    {r.status === 'HOLDER_REPORTED' && r.member_user_id === userId && (
                      <>
                        {btn('Xác nhận nhận hoàn tiền', () =>
                          action(
                            'Xác nhận nhận hoàn tiền',
                            `/refunds/${r.id}/confirm-received`,
                            version(r),
                          ),
                        )}
                        {!r.nonreceipt_confirmed_at &&
                          btn('Báo chưa nhận hoàn tiền', () =>
                            action(
                              'Báo chưa nhận hoàn tiền',
                              `/refunds/${r.id}/confirm-nonreceipt`,
                              version(r),
                            ),
                          )}
                      </>
                    )}
                    {owner &&
                      (r.status === 'PENDING' ||
                        (r.status === 'HOLDER_REPORTED' && r.nonreceipt_confirmed_at)) &&
                      btn('Hủy khoản hoàn', () =>
                        action('Hủy khoản hoàn', `/refunds/${r.id}/cancel`, version(r), true),
                      )}
                    {r.status === 'CONFIRMED' && (
                      <>
                        {holder &&
                          !r.reversal_requested_at &&
                          btn('Đề nghị đảo hoàn tiền', () =>
                            action(
                              'Đề nghị đảo hoàn tiền',
                              `/refunds/${r.id}/request-reversal`,
                              version(r),
                              true,
                            ),
                          )}
                        {r.member_user_id === userId &&
                          r.reversal_requested_at &&
                          !r.reversal_consented_at &&
                          btn('Đồng ý đảo hoàn tiền', () =>
                            action(
                              'Đồng ý đảo hoàn tiền',
                              `/refunds/${r.id}/consent-reversal`,
                              version(r),
                            ),
                          )}
                        {holder &&
                          r.reversal_consented_at &&
                          btn('Thực hiện đảo hoàn tiền', () =>
                            action(
                              'Thực hiện đảo hoàn tiền',
                              `/refunds/${r.id}/reverse`,
                              version(r),
                              true,
                              'POST',
                              'Nhập đúng lý do đã dùng lúc đề nghị đảo. Người nhận đã đồng ý; server kiểm tra lại trước khi ghi bút toán.',
                            ),
                          )}
                      </>
                    )}
                  </>
                )}
              </Card>
            ))}
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
            </>
          )}
          {tab === 'notes' &&
            (visiblePage?.items as FinanceCollections['notes'][] | undefined)?.map((n) => (
              <Card key={n.id} title={n.description}>
                <Line>{moneyLabel(n.amount)}</Line>
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
          {tab === 'transactions' &&
            (visiblePage?.items as FinanceCollections['transactions'][] | undefined)?.map((t) => (
              <Card
                key={t.id}
                title={`#${t.sequence} · ${t.direction === 'IN' ? 'Thu' : 'Chi'} ${moneyLabel(t.amount)}`}
              >
                <Line>
                  {t.transaction_type} · {t.created_at}
                </Line>
                <Line>Số dư sau bút toán: {moneyLabel(t.balance_after)}</Line>
                {t.reason && <Line>{t.reason}</Line>}
              </Card>
            ))}
          {tab === 'history' &&
            (visiblePage?.items as FinanceCollections['history'][] | undefined)?.map((h) => (
              <Card key={h.id} title={h.action}>
                <Line>
                  {h.occurred_at} · {h.entity_type}
                </Line>
                <Line>
                  Phiên bản {h.from_version ?? '—'} → {h.to_version ?? '—'}
                </Line>
                {h.reason && <Line>{h.reason}</Line>}
              </Card>
            ))}
          {tab === 'closures' && (
            <>
              <Notice>
                Chỉ chốt khi số dư bằng 0 và không còn khoản đóng, khoản chi, hoàn tiền hoặc thanh
                toán chờ xử lý. Chốt quỹ dùng bản chụp cố định. Mỗi thành viên cần đọc số dư, danh
                sách bút toán và xác nhận đúng bản chụp đó.
              </Notice>
              {owner &&
                fund.status === 'OPEN' &&
                btn(
                  'Đề nghị chốt quỹ',
                  () => action('Đề nghị chốt quỹ', `/funds/${fund.id}/closures`, version()),
                  disabled || fund.current_balance !== '0',
                )}
            </>
          )}
          {tab === 'closures' &&
            (visiblePage?.items as FinanceCollections['closures'][] | undefined)?.map((c) => (
              <Card key={c.id} title={`Chốt quỹ · ${statusLabel[c.status]}`}>
                <Line>Số dư bản chụp: {moneyLabel(c.snapshot.fund.current_balance)}</Line>
                <Line>
                  {c.confirmations.filter((v) => v.confirmed_at).length}/
                  {c.snapshot.required_user_ids.length} thành viên xác nhận ·{' '}
                  {c.snapshot.ledger.length} bút toán
                </Line>
                <Line>Mã bản chụp: {c.snapshot_hash}</Line>
                {c.snapshot.ledger.map((t) => (
                  <Line key={t.id}>
                    #{t.sequence} {t.direction} {moneyLabel(t.amount)} · Số dư{' '}
                    {moneyLabel(t.balance_after)}
                  </Line>
                ))}
                {c.status === 'PENDING_CONFIRMATIONS' && (
                  <>
                    {c.snapshot.required_user_ids.includes(userId) &&
                      !c.confirmations.some((v) => v.user_id === userId && v.confirmed_at) &&
                      btn('Tôi xác nhận bản chụp quỹ', () =>
                        action('Tôi xác nhận bản chụp quỹ', `/closures/${c.id}/confirm`, {
                          snapshot_hash: c.snapshot_hash,
                        }),
                      )}
                    {owner && (
                      <>
                        {btn('Hủy đề nghị chốt quỹ', () =>
                          action('Hủy đề nghị chốt quỹ', `/closures/${c.id}/cancel`, {}, true),
                        )}
                        {btn('Nhắc xác nhận chốt quỹ', () =>
                          action(
                            'Nhắc xác nhận chốt quỹ',
                            `/closures/${c.id}/remind`,
                            {},
                            false,
                            'POST',
                            'Server ghi nhận yêu cầu nhắc. Việc nhận thông báo phụ thuộc cấu hình worker; không tự bảo đảm đã gửi tới điện thoại.',
                          ),
                        )}
                      </>
                    )}
                  </>
                )}
              </Card>
            ))}
          {tab === 'payment-exceptions' && (
            <>
              {btn(
                'Tra cứu lần thanh toán',
                () =>
                  setForm({
                    title: 'Tra cứu lần thanh toán',
                    message:
                      'Nhập mã lần thanh toán đã được server trả về. Chỉ người thanh toán/người giữ quỹ được đọc.',
                    fields: [{ key: 'id', label: 'Mã lần thanh toán' }],
                    submit: async (v) => {
                      await read(() => api.finance.attempt(required(v.id)), setAttempt);
                      return true;
                    },
                  }),
                command.busy,
              )}
              {(visiblePage?.items as FinanceCollections['payment-exceptions'][] | undefined)?.map(
                (p) => (
                  <Card key={p.id} title={p.processing_status}>
                    <Line>
                      {p.review_reason ?? 'Chưa có lý do'} · {p.received_at}
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
                                {
                                  value: 'NO_FINANCIAL_EFFECT',
                                  label: 'Không ảnh hưởng tài chính',
                                },
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
                ),
              )}
            </>
          )}
          {tab !== 'setup' && visiblePage?.items.length === 0 && !page.loading && !page.error && (
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
      {instruction && (
        <Sheet
          visible
          title="Hướng dẫn chuyển khoản TEST"
          onClose={() => setInstruction(undefined)}
        >
          <Notice>{instruction.warning}</Notice>
          <Line>Số tiền: {moneyLabel(instruction.amount)}</Line>
          <Line>
            {instruction.bank_code} · {instruction.account_number} · {instruction.recipient_name}
          </Line>
          <Line>Nội dung: {instruction.reference}</Line>
          <Notice>
            Mở ảnh QR sẽ gửi thông tin người nhận, số tiền và nội dung chuyển khoản tới Casso
            (VietQR). Chỉ dùng tài khoản thử nghiệm: tài khoản ngân hàng thật vẫn có thể nhận tiền
            thật dù màn hình ghi TEST.
          </Notice>
          <Button
            label="Mở ảnh QR TEST trên trình duyệt"
            onPress={() => {
              void read(
                () => Linking.openURL(instructionQrUrl(instruction)),
                () => {},
              );
            }}
          />
          <Button
            label="Sao chép nội dung chuyển khoản"
            onPress={() => {
              void read(
                () => Clipboard.setStringAsync(instruction.reference),
                () => setReadError('Đã sao chép nội dung chuyển khoản.'),
              );
            }}
          />
          <Notice>
            Đọc hướng dẫn hoặc quét QR không xác nhận đã thanh toán. Sau chuyển khoản TEST, báo
            chuyển tại khoản đóng để người giữ quỹ kiểm tra.
          </Notice>
        </Sheet>
      )}
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
