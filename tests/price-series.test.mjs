import assert from "node:assert/strict";
import test from "node:test";
import { chartPoints, seriesChange, weekSeries } from "../src/features/price-watch/series.ts";

const now = Date.parse("2026-11-25T00:00:00Z");
const row = (days, price, provider = "A") => ({ id: `${days}`, price: String(price), provider, observed_at: new Date(now - days * 86_400_000).toISOString() });

test("the week keeps the newest source's last seven days, oldest first", () => {
  const series = weekSeries([row(0, 90), row(1, 95, "B"), row(6, 100), row(8, 50)], now);
  assert.deepEqual(series.map(item => item.price), ["100", "90"]);
  assert.equal(seriesChange(series), -10);
  assert.equal(seriesChange(series.slice(1)), undefined);
});
test("chart points follow time, and the threshold stays inside the plot", () => {
  const series = weekSeries([row(0, 90), row(1, 80), row(4, 100)], now);
  const { points, thresholdY } = chartPoints(series, "60", 100, 80);
  assert.deepEqual(points.map(p => Math.round(p.x)), [0, 75, 100]);
  assert.equal(thresholdY, 80);
  assert.equal(points[0].y, 0);
  assert.equal(chartPoints([row(0, 60)], "60", 100, 80).points[0].y, 40);
});
