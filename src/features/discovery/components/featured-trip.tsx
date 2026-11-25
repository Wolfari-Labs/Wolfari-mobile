import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect } from "react";
import Animated, { cancelAnimation, interpolate, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";

import { usePressMotion } from "@/shared/hooks/use-press-motion";
import { colors, fonts, gradients, springs } from "@/shared/theme/tokens";
import { coverFor } from "@/features/trips/components/trip-card";
import { TripCoverImage } from "@/features/trips/components/trip-cover";
import { openTrip } from "@/features/trips/components/trip-navigation";
import type { Trip } from "@/features/trips/types";
import { Image } from "expo-image";
import { designAssets } from "@/shared/ui/design-assets";
import { useEntrance } from "@/shared/ui/carto/motion";
import { dateKey, tripPeriod } from "@/features/trips/utils";

const SUB = "#6A7891";
const DAY = 86_400_000;

/** "12 – 14/10", "30/9 – 2/10", or "12/10" for a one-day trip. */
function shortRange(trip: Trip) {
  const first = dateKey(trip.start_at, trip.timezone).split("-").map(Number);
  const { days } = tripPeriod(trip);
  const last = new Date(Date.UTC(first[0], first[1] - 1, first[2]) + (days - 1) * DAY);
  const [d1, m1, d2, m2] = [first[2], first[1], last.getUTCDate(), last.getUTCMonth() + 1];
  if (days <= 1) return `${d1}/${m1}`;
  return m1 === m2 ? `${d1} – ${d2}/${m2}` : `${d1}/${m1} – ${d2}/${m2}`;
}

/** Where the trip stands today: a countdown before it starts, the day number while it runs. */
export function tripMoment(trip: Trip, now = new Date()) {
  const { days } = tripPeriod(trip);
  const today = Date.parse(dateKey(now.toISOString(), trip.timezone));
  const start = Date.parse(dateKey(trip.start_at, trip.timezone));
  const until = Math.round((start - today) / DAY);
  if (trip.lifecycle === "ONGOING") {
    const day = Math.min(days, Math.max(1, until * -1 + 1));
    return { pill: `Ngày ${day}/${days}`, dot: colors.pinGreen, progress: day / days, progressLabel: `${Math.round((100 * day) / days)}%` };
  }
  const pill = until <= 0 ? "Khởi hành hôm nay" : until === 1 ? "Ngày mai lên đường" : `Còn ${until} ngày`;
  return { pill, dot: colors.blue, progress: undefined, progressLabel: undefined };
}

/** The trip in focus on Khám phá (Figma D/Featured trip, without the mascot). */
export function FeaturedTrip({ trip }: { trip: Trip }) {
  const press = usePressMotion();
  const { days } = tripPeriod(trip);
  const moment = tripMoment(trip);
  const meta = `${shortRange(trip)} · ${days} ngày`;
  return <View>
    <PeekingWolfi />
    <Animated.View style={press.animatedStyle}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Mở chuyến đi ${trip.name}`} accessibilityHint={`${moment.pill}, ${meta}`}
      onPress={() => openTrip(trip.id)} onPressIn={press.onPressIn} onPressOut={press.onPressOut} style={styles.card}>
      <LinearGradient colors={[colors.surface, "#EEF4FF"]} style={[StyleSheet.absoluteFill, styles.round]} />
      <View style={styles.photo}>
        <TripCoverImage trip={trip} fallback={coverFor(trip)} style={StyleSheet.absoluteFill} label={trip.name} />
        <View style={styles.pill}><View style={[styles.dot, { backgroundColor: moment.dot }]} /><Text style={styles.pillText}>{moment.pill}</Text></View>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{trip.name}</Text>
        <Text style={styles.meta}>{meta}</Text>
        {moment.progress !== undefined && <View style={styles.progress}>
          <View style={styles.track}>
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.fill, { width: `${Math.max(6, 100 * moment.progress)}%` }]} />
          </View>
          <Text style={styles.percent}>{moment.progressLabel}</Text>
        </View>}
      </View>
    </Pressable>
    </Animated.View>
  </View>;
}

/**
 * Wolfi peeks over the card's top-right edge and waves (Figma D · M04 mascot, redrawn in the brand art).
 * He sits behind the card, so only his head and paw show above the rim.
 */
function PeekingWolfi() {
  const enter = useEntrance({ delay: 320, spring: springs.bouncy });
  // Two waves, then he rests: decoration on Khám phá settles instead of looping.
  const { reduceMotion } = useAccessibilityPreferences();
  const wave = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    const swing = withSequence(withTiming(1, { duration: 200 }), withTiming(-1, { duration: 300 }), withTiming(0, { duration: 200 }));
    wave.set(withDelay(500, withRepeat(swing, 2, false)));
    return () => cancelAnimation(wave);
  }, [reduceMotion, wave]);
  const style = useAnimatedStyle(() => {
    const e = enter.get();
    return {
      opacity: interpolate(e, [0, 0.2], [0, 1], "clamp"),
      transform: [{ translateY: interpolate(e, [0, 1], [40, 0]) }, { rotate: `${5 * wave.get()}deg` }],
    };
  });
  // The window ends exactly at the card's flat top edge, past the rounded corner, so the
  // cropped art reads as Wolfi standing behind the card and never draws inside it.
  return <View pointerEvents="none" style={styles.peekWindow}>
    <Animated.View style={[styles.peek, style]}>
      <Image source={designAssets.wolfiPeek} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} />
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  peekWindow: { position: "absolute", right: 40, top: -58, width: 70, height: 58, overflow: "hidden" },
  peek: { position: "absolute", left: 0, top: 2, width: 70, height: 66, transformOrigin: "50% 100%" },
  card: {
    borderRadius: 34, backgroundColor: colors.surface, paddingTop: 12, paddingHorizontal: 12, paddingBottom: 18, gap: 12,
    boxShadow: "0 12px 28px -4px rgba(92,122,199,0.18), inset 0 2px 3px rgba(255,255,255,0.9), inset 0 -4px 10px rgba(51,64,115,0.06)",
  },
  round: { borderRadius: 34 },
  photo: { height: 176, borderRadius: 26, overflow: "hidden", backgroundColor: colors.tealSoft },
  pill: { position: "absolute", left: 12, top: 12, flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 10, paddingRight: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 18, color: colors.ink },
  body: { gap: 6, paddingHorizontal: 6 },
  title: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28, color: colors.ink },
  meta: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: SUB },
  progress: { flexDirection: "row", alignItems: "center", gap: 10 },
  track: { flex: 1, height: 10, borderRadius: 999, backgroundColor: colors.line, overflow: "hidden" },
  fill: { height: 10, borderRadius: 5 },
  percent: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: colors.blue },
});
