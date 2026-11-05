import { useEffect, useMemo, useState } from 'react';
import { randomUUID } from '../../shared/operations/operation-id';
import { useApi } from '../../shared/api/use-api';
import { createCommandJournal } from './command';
import { journalStorage } from './journal-storage';
import type { WriteIntent } from './api';
import { ApiError } from '../../shared/api/api-client';
import { errorMessage } from '../../shared/api/errors';
const journals = new Map<string, ReturnType<typeof createCommandJournal>>();

export function useFinanceCommand(
  userId: string,
  tripId: string,
  kind: 'finance' | 'watch',
  onDone: () => Promise<unknown>,
) {
  const api = useApi();
  const journal = useMemo(() => {
    const scope = `wolfari.command.${kind}.${userId}.${tripId}`;
    if (!journals.has(scope)) journals.set(scope, createCommandJournal(journalStorage, scope));
    return journals.get(scope)!;
  }, [kind, userId, tripId]);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState<string>();
  const [, render] = useState(0);
  const [lastResult, setLastResult] = useState<unknown>();
  useEffect(() => {
    let current = true;
    void journal.restore().then(
      () => {
        if (current) {
          setReady(true);
          render((n) => n + 1);
        }
      },
      (e) => {
        if (current) setMessage(e.message);
      },
    );
    return () => {
      current = false;
    };
  }, [journal]);
  const run = async (action: () => Promise<{ done: boolean; result?: unknown }>) => {
    setBusy(true);
    setMessage(undefined);
    try {
      const result = await action();
      if (result.done) {
        setLastResult(result.result);
        setMessage('Server đã ghi nhận. Đang tải lại dữ liệu để đối chiếu.');
        await onDone();
      } else
        setMessage(
          'Yêu cầu đang xử lý; chưa xác nhận thay đổi. Kiểm tra trạng thái hoặc gửi lại yêu cầu đã lưu.',
        );
      return result;
    } catch (e) {
      setMessage(
        e instanceof ApiError && e.status === 409
          ? 'Dữ liệu hoặc trạng thái đã đổi. Tải lại để đối chiếu; không tự ghi đè phiên bản mới. Nếu mất phản hồi, giữ nguyên yêu cầu đã lưu.'
          : errorMessage(e),
      );
      return undefined;
    } finally {
      setBusy(false);
      render((n) => n + 1);
    }
  };
  return {
    ready,
    busy: busy || journal.busy,
    message,
    lastResult,
    pending: journal.pending,
    blocked: !ready || busy || journal.busy || !!journal.pending,
    send: (input: Pick<WriteIntent, 'path' | 'method' | 'body' | 'label'>) =>
      run(() =>
        journal.send(
          {
            ...input,
            key: randomUUID(),
            kind,
            createdAt: new Date().toISOString(),
            attempted: false,
          },
          api.finance.write,
        ),
      ),
    retry: () => run(() => journal.send(undefined, api.finance.write)),
    check: () =>
      run(async () => {
        await journal.check(api.finance.operation, true);
        return journal.send(undefined, api.finance.write);
      }),
    acknowledgeWatch: async () => {
      try {
        await journal.acknowledgeWatch();
        setMessage(
          'Đã đóng yêu cầu sau đối chiếu của bạn. Đây không phải xác nhận tự động rằng thao tác trước đã thành công.',
        );
        render((n) => n + 1);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Không thể đóng yêu cầu.');
      }
    },
  };
}
