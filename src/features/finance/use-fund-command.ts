import { useState } from 'react';
import { operationCommitted } from '../../shared/operations/controller';
import { useTripOperation } from '../../shared/operations/use-trip-operation';
import type { WriteIntent } from './api';

// Both fund workspaces and membership changes share one durable receipt/lock.
// Price Watch keeps its own journal: its API has no operation lookup contract.
export function useFundCommand(tripId: string, onDone: () => Promise<unknown>) {
  const operation = useTripOperation(tripId);
  const [lastResult, setLastResult] = useState<unknown>();
  return {
    operation,
    blocked: operation.locked,
    busy: operation.busy,
    lastResult: operation.result ?? lastResult,
    async send(input: Pick<WriteIntent, 'path' | 'method' | 'body' | 'label'>) {
      if (input.method !== 'POST' && input.method !== 'PATCH' && input.method !== 'DELETE')
        throw new Error('Phương thức ghi quỹ không được hỗ trợ.');
      const sent = await operation.run({ kind: 'finance', title: input.label,
        path: input.path, method: input.method, body: input.body });
      if (!sent) return undefined;
      const snapshot = operation.getSnapshot();
      if (!operationCommitted(snapshot.pending)) return { done: false };
      setLastResult(snapshot.result);
      await onDone();
      await operation.acknowledge();
      return { done: true, result: snapshot.result };
    },
  };
}
