import type { Observation } from './api';

const WEEK_MS = 7 * 86_400_000;

/** Prices seen in the last seven days, oldest first, from the source of the newest price only. */
export function weekSeries(items: Observation[], now = Date.now()): Observation[] {
  const sorted = [...items].sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));
  const provider = sorted.at(-1)?.provider;
  return sorted.filter((o) => o.provider === provider && Date.parse(o.observed_at) >= now - WEEK_MS);
}

/** Whole-percent change from the first to the last price; undefined without two prices. */
export function seriesChange(series: Observation[]): number | undefined {
  if (series.length < 2) return undefined;
  const first = Number(series[0].price);
  return Math.round(((Number(series[series.length - 1].price) - first) / first) * 100);
}

/** Points scaled into the plot box by time; the threshold always stays inside it. */
export function chartPoints(series: Observation[], threshold: string, width: number, height: number) {
  const prices = series.map((o) => Number(o.price));
  const limit = Number(threshold);
  const low = Math.min(...prices, limit), high = Math.max(...prices, limit);
  const y = (price: number) => (high === low ? height / 2 : ((high - price) / (high - low)) * height);
  const times = series.map((o) => Date.parse(o.observed_at));
  const span = times[times.length - 1] - times[0];
  return {
    points: series.map((_, i) => ({
      x: series.length === 1 ? width : span > 0 ? ((times[i] - times[0]) / span) * width : (i / (series.length - 1)) * width,
      y: y(prices[i]),
    })),
    thresholdY: y(limit),
  };
}
