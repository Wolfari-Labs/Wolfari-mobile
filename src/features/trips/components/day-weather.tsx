import { useCallback } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useResource } from "@/shared/hooks/use-resource";
import { colors, fonts, pastelTones } from "@/shared/theme/tokens";
import type { createTripsApi } from "../api/trips.api";
import { dayPoint, sourceLine, weatherMood, weatherSummary } from "../model/suggestions";
import type { Plan, Trip } from "../types";

type Api = { trips: ReturnType<typeof createTripsApi> };

const moods = {
  rain: { glyph: "🌧️", tone: pastelTones.blue.surface, hint: "Nhớ mang ô hoặc áo mưa." },
  sun: { glyph: "☀️", tone: pastelTones.butter.surface, hint: "Nắng gắt, nhớ kem chống nắng." },
  cool: { glyph: "🧥", tone: pastelTones.lilac.surface, hint: "Trời se lạnh, mang thêm áo ấm." },
  mild: { glyph: "⛅", tone: pastelTones.mint.surface, hint: "Thời tiết dễ chịu." },
} as const;

/** FR-TI01: one forecast line for the selected itinerary day; quiet when there is nothing to show. */
export function DayWeather({ api, trip, plan, day }: { api: Api; trip: Trip; plan: Plan; day: string }) {
  const point = dayPoint(plan, day, trip.timezone);
  const key = point ? `${point.latitude},${point.longitude},${day}` : "";
  const weather = useResource(useCallback(async (signal: AbortSignal) => {
    if (!point) return null;
    return api.trips.weather(point, day, signal);
    // The key carries the point and day; the object identity of `point` changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, key]));

  if (!point) return null;
  if (weather.loading && !weather.data)
    return <View style={[styles.card, { backgroundColor: colors.fill }]} accessibilityLabel="Đang tải thời tiết">
      <ActivityIndicator size="small" color={colors.blue} />
      <Text style={styles.muted}>Đang xem thời tiết…</Text>
    </View>;
  if (weather.error)
    return <View style={[styles.card, { backgroundColor: colors.fill }]}>
      <Text style={styles.glyph}>🌤️</Text>
      <Text style={styles.muted}>Chưa lấy được thời tiết lúc này.</Text>
    </View>;
  const result = weather.data;
  if (!result) return null;
  if (!result.data)
    return <View style={[styles.card, { backgroundColor: colors.fill }]}>
      <Text style={styles.glyph}>🗓️</Text>
      <Text style={styles.muted}>Dự báo có trước tối đa 16 ngày. Quay lại gần ngày đi nhé.</Text>
    </View>;
  const mood = moods[weatherMood(result.data)];
  const summary = weatherSummary(result.data);
  const source = sourceLine(result.meta, trip.timezone);
  return <View accessible accessibilityLabel={`Thời tiết: ${summary}. ${mood.hint} Nguồn ${source}`}
    style={[styles.card, { backgroundColor: mood.tone }]}>
    <Text style={styles.glyph}>{mood.glyph}</Text>
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={styles.summary}>{summary}</Text>
      <Text style={styles.hint}>{mood.hint}</Text>
      <Text style={[styles.source, (result.meta.stale || result.meta.is_mock) && { color: colors.orange }]}>
        {result.meta.is_mock ? source : `Thời tiết: ${source}`}
      </Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, borderCurve: "continuous" },
  glyph: { fontSize: 26, lineHeight: 32 },
  summary: { fontFamily: fonts.heading, fontSize: 15, lineHeight: 20, color: colors.ink },
  hint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.ink },
  source: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 15, color: colors.muted },
  muted: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
});
