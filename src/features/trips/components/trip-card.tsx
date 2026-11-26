import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { usePressMotion } from "@/shared/hooks/use-press-motion";
import { colors, fonts, gradients, radii, shadows, typography } from "@/shared/theme/tokens";
import { designAssets } from "@/shared/ui/design-assets";
import { DesignIcon } from "@/shared/ui/design-icon";
import type { Lifecycle, Trip } from "../types";
import { dateKey, lifecycleLabels, tripPeriod } from "../utils";
import { TripCoverImage } from "./trip-cover";
import { openTrip } from "./trip-navigation";

export function coverFor(trip: Pick<Trip, "name">) {
  const name = trip.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
  return /da lat/.test(name) ? designAssets.dalat : /da nang/.test(name) ? designAssets.pastelDestination : /hoi an/.test(name) ? designAssets.pastelBridge : designAssets.pastelCoast;
}

const statusColors: Record<Lifecycle, string> = {
  ONGOING: colors.pinGreen, UPCOMING: colors.teal, COMPLETED: colors.pinTeal, ARCHIVED: colors.muted,
};


export function TripCard({ trip, interactive = true, layout = "featured" }: {
  trip: Trip; interactive?: boolean; layout?: "row" | "featured" | "spotlight";
}) {
  const press = usePressMotion(!interactive);
  const period = tripPeriod(trip);
  const content = layout === "row" ? <>
    <TripCoverImage trip={trip} fallback={coverFor(trip)} style={styles.thumb} label={trip.name} />
    <View style={styles.copy}>
      <Text style={styles.rowTitle} numberOfLines={2}>{trip.name}</Text>
      <Text style={styles.rowDates}>{period.label}</Text>
    </View>
    <View style={styles.rowArrow}><DesignIcon name="chevron" size={16} tintColor={colors.ink} /></View>
  </> : layout === "spotlight" ? <Spotlight trip={trip} /> : <>
    <View style={styles.cover}>
      <TripCoverImage trip={trip} fallback={coverFor(trip)} style={StyleSheet.absoluteFill} label={trip.name} />
      {interactive && <LinearGradient pointerEvents="none" colors={["rgba(12,27,43,0)", "rgba(12,27,43,0.35)", "rgba(12,27,43,0.9)"]}
        locations={[0.15, 0.55, 1]} style={StyleSheet.absoluteFill} />}
      <View style={styles.badge}>
        <View style={[styles.dot, { backgroundColor: trip.lifecycle === "ONGOING" ? colors.pinGreen : colors.blue }]} />
        <Text style={styles.badgeText}>{lifecycleLabels[trip.lifecycle]}</Text>
      </View>
      {interactive && <View style={styles.featuredDetails}>
        <Text style={styles.featuredTitle} numberOfLines={2}>{trip.name}</Text>
        <View style={styles.featuredArrow}><DesignIcon name="chevron" size={16} tintColor={colors.surface} /></View>
      </View>}
    </View>
    <View style={styles.period}>
      <View style={styles.periodDate}>
        <DesignIcon name="calendar" size={16} tintColor={colors.pinTeal} />
        <Text selectable={!interactive} style={styles.periodText}>{period.label}</Text>
      </View>
      <View style={styles.duration}><Text style={styles.durationText}>{period.days} ngày</Text></View>
    </View>
  </>;
  if (!interactive) return <View style={styles.card}>{content}</View>;
  return <Animated.View style={press.animatedStyle}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Mở chuyến đi ${trip.name}`}
      accessibilityHint={`${lifecycleLabels[trip.lifecycle]}, ${period.label}, ${period.days} ngày`}
      onPress={() => openTrip(trip.id)} onPressIn={press.onPressIn} onPressOut={press.onPressOut}
      style={layout === "row" ? styles.row : styles.card}>{content}</Pressable>
  </Animated.View>;
}
function Spotlight({ trip }: { trip: Trip }) {
  const period = tripPeriod(trip);
  const today = dateKey(new Date().toISOString(), trip.timezone);
  const elapsed = Math.floor((Date.parse(today) - Date.parse(dateKey(trip.start_at, trip.timezone))) / 86400000) + 1;
  const day = trip.lifecycle === "ONGOING" ? Math.min(period.days, Math.max(1, elapsed)) : 0;
  return <View style={styles.spotlight}>
    <View style={styles.spotlightPhoto}><TripCoverImage trip={trip} fallback={coverFor(trip)} style={StyleSheet.absoluteFill} label={trip.name} />
      <View style={styles.badge}><View style={[styles.dot, { backgroundColor: statusColors[trip.lifecycle] }]} /><Text style={styles.badgeText}>{trip.lifecycle === "ONGOING" ? "Đang diễn ra" : lifecycleLabels[trip.lifecycle]}</Text></View>
    </View>
    <Image source={designAssets.tripWave} contentFit="contain" accessible={false} style={styles.mascot} />
    <View style={styles.spotlightBody}><Text style={typography.section}>{trip.name}</Text><Text style={styles.rowDates}>{period.label}</Text>
      <View style={styles.progressRow}><View style={styles.track}><LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 8, width: `${100 * day / period.days}%`, borderRadius: 4 }} /></View>
        <Text style={styles.dayLabel}>{day ? `Ngày ${day}/${period.days}` : `${period.days} ngày`}</Text></View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  spotlight: { gap: 10, padding: 12, borderRadius: 32, backgroundColor: colors.surface },
  spotlightPhoto: { height: 176, borderRadius: 24, overflow: "hidden" },
  spotlightBody: { gap: 5, paddingHorizontal: 6, paddingBottom: 6 },
  mascot: { position: "absolute", right: -8, top: -27, width: 96, height: 80 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 5 },
  track: { flex: 1, borderRadius: 5, backgroundColor: colors.line, overflow: "hidden" },
  dayLabel: { ...typography.footnote, fontFamily: fonts.bold, color: colors.blue },
  rowArrow: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.mint },
  card: { borderRadius: radii.cardLarge, backgroundColor: colors.surface, ...shadows.card },
  cover: { minHeight: 172, paddingTop: 56, justifyContent: "flex-end", borderTopLeftRadius: radii.cardLarge, borderTopRightRadius: radii.cardLarge, overflow: "hidden", backgroundColor: colors.tealSoft },
  badge: {
    position: "absolute",
    top: 14,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    boxShadow: `0 2px 8px ${colors.inkShadow}`,
  },
  badgeText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 12, lineHeight: 16 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  featuredDetails: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
  featuredTitle: { ...typography.title, flex: 1, minWidth: 0, fontSize: 26, lineHeight: 32, color: colors.surface },
  featuredArrow: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.65)", alignItems: "center", justifyContent: "center" },
  period: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", minHeight: 52, paddingHorizontal: 18, paddingVertical: 11, columnGap: 10, rowGap: 6 },
  periodDate: { flexDirection: "row", flexShrink: 1, alignItems: "center", gap: 8 },
  periodText: { ...typography.footnote, fontFamily: fonts.bold, color: colors.ink, flexShrink: 1 },
  duration: { borderRadius: radii.pill, backgroundColor: colors.mint, paddingVertical: 3, paddingHorizontal: 9 },
  durationText: { fontFamily: fonts.bold, color: colors.pinGreen, fontSize: 12, lineHeight: 17 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 88, gap: 14, padding: 10, paddingRight: 14, backgroundColor: colors.surface, borderRadius: 26, ...shadows.glass },
  thumb: { width: 68, height: 68, borderRadius: 20 },
  calendar: { minWidth: 56, minHeight: 62, padding: 4, borderRadius: 14, backgroundColor: colors.ice, justifyContent: "center", alignItems: "center" },
  month: { fontFamily: fonts.bold, color: colors.pinTeal, fontSize: 10, lineHeight: 14, letterSpacing: 0.6 },
  day: { fontFamily: fonts.heading, color: colors.ocean, fontSize: 25, lineHeight: 30, fontVariant: ["tabular-nums"] },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { ...typography.headline, fontFamily: fonts.heading },
  rowDates: { ...typography.footnote, fontSize: 12 },
  rowStatus: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 15 },
});
