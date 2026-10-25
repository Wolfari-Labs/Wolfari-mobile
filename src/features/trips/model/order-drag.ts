export type OrderFrame = { y: number; height: number };
export const ORDER_ROW_GAP = 10;
export const ORDER_LIST_PADDING = 3;
export const ORDER_HOLD_MS = 250;

/** Rebuild positions after every reorder; keyed rows may not emit a new layout. */
export function orderFrames(ids: string[], measured: ReadonlyMap<string, OrderFrame>) {
  const frames = new Map<string, OrderFrame>();
  let y = ORDER_LIST_PADDING;
  for (const id of ids) {
    const height = measured.get(id)?.height;
    if (!height || !Number.isFinite(height) || height <= 0 || frames.has(id)) return;
    frames.set(id, { y, height });
    y += height + ORDER_ROW_GAP;
  }
  return frames;
}

export function dragPosition(ids: string[], frames: ReadonlyMap<string, OrderFrame>, id: string, delta: number) {
  const origin = frames.get(id), first = frames.get(ids[0]), last = frames.get(ids[ids.length - 1]);
  if (!origin || !first || !last || !Number.isFinite(delta)) return;
  const translation = Math.max(first.y - origin.y, Math.min(last.y + last.height - origin.y - origin.height, delta));
  const center = origin.y + origin.height / 2 + delta;
  let index = ids.indexOf(id), distance = Infinity;
  ids.forEach((candidate, position) => {
    const frame = frames.get(candidate);
    if (frame && Math.abs(center - frame.y - frame.height / 2) < distance) {
      distance = Math.abs(center - frame.y - frame.height / 2);
      index = position;
    }
  });
  return { translation, index };
}

export function dragScrollOffset(offset: number, pointerY: number, viewportHeight: number, contentHeight: number) {
  if (![offset, pointerY, viewportHeight, contentHeight].every(Number.isFinite) || viewportHeight <= 0) return offset;
  const edge = Math.min(52, viewportHeight / 3);
  const speed = pointerY < edge ? -9 : pointerY > viewportHeight - edge ? 9 : 0;
  return Math.max(0, Math.min(Math.max(0, contentHeight - viewportHeight), offset + speed));
}
