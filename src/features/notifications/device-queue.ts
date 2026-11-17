/** Serialize device registration/removal so a slow old account cannot finish after a new one. */
export function createDeviceQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const task = tail.then(work, work);
    tail = task.catch(() => {});
    return task;
  };
}
