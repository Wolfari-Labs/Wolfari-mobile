import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radii, shadows, typography } from "@/shared/theme/tokens";
import { durationLabel } from "../model/place";
import { MAP_TONES } from "./trip-map.types";

/** One place as shown in lists: a search result, a saved group place or a route stop. */
export type PlaceItem = {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  /** Server-issued token for saving a search result exactly as found. */
  token?: string;
  icon?: string;
  categoryLabel?: string;
  durationMin?: number;
  activityType?: string;
  dressHint?: string;
  verified?: boolean;
  /** Where the data comes from, shown in small print. */
  source: string;
  attribution: { text: string; url: string }[];
};

export function PlaceCard({ place, tone, marker, selected, meta, onPress, children }: {
  place: PlaceItem;
  tone: "saved" | "result" | "stop";
  marker?: string;
  selected?: boolean;
  /** Extra line under the details, e.g. "Đã xếp lịch · 2 hoạt động". */
  meta?: string;
  onPress?: () => void;
  children?: ReactNode;
}) {
  const colorsFor = MAP_TONES[tone];
  const details = [place.categoryLabel, durationLabel(place.durationMin)].filter(Boolean).join(" · ");
  return (
    <View style={[styles.card, selected && styles.selected]}>
      <Pressable
        cssInterop={false}
        accessibilityRole="button"
        accessibilityLabel={`Xem ${place.name} trên bản đồ`}
        disabled={!onPress || place.latitude === null}
        onPress={onPress}
        style={({ pressed }) => [styles.head, pressed && { opacity: 0.7 }]}
      >
        <View style={[styles.marker, { backgroundColor: colorsFor.fill }, tone === "result" && styles.markerResult]}>
          <Text style={[styles.markerText, { color: colorsFor.text }]}>{marker ?? place.icon ?? "•"}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <View style={styles.titleRow}>
            <Text style={[typography.headline, { flexShrink: 1 }]}>{place.name}</Text>
            {place.verified && <Text style={styles.verified} accessibilityLabel="Tọa độ đã được kiểm tra">✓</Text>}
          </View>
          {!!details && <Text style={styles.details}>{details}</Text>}
          {!!place.address && <Text style={typography.footnote} numberOfLines={2}>{place.address}</Text>}
          {!!place.dressHint && <Text style={styles.hint}>👗 Nên mặc: {place.dressHint}</Text>}
          {!!meta && <Text style={styles.meta}>{meta}</Text>}
        </View>
      </Pressable>
      {children && <View style={styles.actions}>{children}</View>}
      <Text style={styles.source}>{place.source}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 14, borderRadius: radii.card, backgroundColor: colors.surface, borderWidth: 2, borderColor: "transparent", ...shadows.glass },
  selected: { borderColor: colors.sun },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  marker: { minWidth: 34, height: 34, paddingHorizontal: 6, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  markerResult: { backgroundColor: colors.fill },
  markerText: { fontSize: 14, fontFamily: fonts.bold },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  verified: { color: colors.pinGreen, fontSize: 13, fontFamily: fonts.bold },
  details: { color: colors.teal, fontSize: 13, fontFamily: fonts.bold },
  hint: { color: colors.violet, fontSize: 12, fontFamily: fonts.bold },
  meta: { color: colors.muted, fontSize: 12, fontFamily: fonts.bold },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  source: { color: colors.muted, fontSize: 11 },
});
