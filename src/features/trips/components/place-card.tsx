import { Image } from "expo-image";
import { openURL } from "expo-linking";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radii, shadows, typography } from "@/shared/theme/tokens";
import { durationLabel } from "../model/place";
import { MAP_TONES } from "./trip-map.types";

import type { PlaceItem } from "../model/place-item";

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
  const colorsFor = MAP_TONES[tone === "stop" && marker === "1" ? "start" : tone];
  const details = [place.categoryLabel, durationLabel(place.durationMin)].filter(Boolean).join(" · ");
  return (
    <View style={[styles.card, selected && styles.selected]}>
      <Pressable
        cssInterop={false}
        accessibilityRole="button"
        accessibilityLabel={`Xem chi tiết ${place.name}`}
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [styles.head, pressed && { opacity: 0.7 }]}
      >
        {place.photo ? (
          <View style={styles.thumbBox}>
            <Image
              source={{ uri: place.photo.uri }}
              contentFit="cover"
              transition={150}
              recyclingKey={place.id}
              accessibilityLabel={`Ảnh ${place.name}`}
              alt={`Ảnh ${place.name}`}
              style={styles.thumb}
            />
            {marker && <View style={[styles.thumbMarker, { backgroundColor: colorsFor.fill }]}><Text style={[styles.markerSmall, { color: colorsFor.text }]}>{marker}</Text></View>}
          </View>
        ) : (
          <View style={[styles.marker, { backgroundColor: colorsFor.fill }, tone === "result" && styles.markerResult]}>
            <Text style={[styles.markerText, { color: colorsFor.text }]}>{marker ?? place.icon ?? "•"}</Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <View style={styles.titleRow}>
            <Text style={[typography.headline, { flexShrink: 1 }]} numberOfLines={2}>{place.name}</Text>
            {place.verified && <Text style={styles.verified} accessibilityLabel="Tọa độ đã được kiểm tra">✓</Text>}
          </View>
          {!!details && <Text style={styles.details}>{details}</Text>}
          {tone !== "stop" && !!place.address && <Text style={typography.footnote} numberOfLines={2}>{place.address}</Text>}
          {!!place.dressHint && <Text style={styles.hint}>👗 Nên mặc: {place.dressHint}</Text>}
          {!!meta && <Text style={[styles.meta, meta.startsWith("✓") && { color: colors.pinGreen }]}>{meta}</Text>}
        </View>
      </Pressable>
      {place.photo && (
        <Pressable
          cssInterop={false}
          accessibilityRole="link"
          accessibilityLabel={`Nguồn ảnh: ${place.photo.attribution}`}
          onPress={() => { void openURL(place.photo!.sourceUrl).catch(() => {}); }}
          style={({ pressed }) => [styles.credit, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.creditText} numberOfLines={1}>ⓘ {place.photo.attribution}</Text>
        </Pressable>
      )}
      {children && tone !== "stop" && <View style={styles.actions}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 14, borderRadius: radii.card, backgroundColor: colors.surface, borderWidth: 2, borderColor: "transparent", ...shadows.glass },
  selected: { borderColor: colors.sun, backgroundColor: "#FFFCF2" },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  thumbBox: { width: 84, height: 84 },
  thumb: { width: 84, height: 84, borderRadius: 16, backgroundColor: colors.fill },
  thumbMarker: { position: "absolute", top: -6, left: -6, minWidth: 24, height: 24, paddingHorizontal: 5, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface },
  markerSmall: { fontSize: 11, fontFamily: fonts.bold },
  marker: { minWidth: 34, height: 34, paddingHorizontal: 6, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  markerResult: { backgroundColor: colors.fill },
  markerText: { fontSize: 14, fontFamily: fonts.bold },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  verified: { color: colors.pinGreen, fontSize: 13, fontFamily: fonts.bold },
  details: { color: colors.teal, fontSize: 13, fontFamily: fonts.bold },
  hint: { color: colors.violet, fontSize: 12, fontFamily: fonts.bold },
  meta: { color: colors.muted, fontSize: 12, fontFamily: fonts.bold },
  credit: { marginTop: -4 },
  creditText: { color: colors.muted, fontSize: 11 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
