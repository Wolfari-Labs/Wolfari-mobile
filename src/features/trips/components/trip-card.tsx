import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, shadows, typography } from "@/shared/theme/tokens";
import { designAssets } from "@/shared/ui/design-assets";
import { DesignIcon } from "@/shared/ui/design-icon";
import { GlassSurface } from "@/shared/ui/glass-surface";
import type { Trip } from "../types";
import { lifecycleLabels, tripDates } from "../utils";
import { openTrip } from "./trip-navigation";

export function coverFor(trip: Pick<Trip, "name">) {
  const name = trip.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
  return /da lat/.test(name)
    ? designAssets.dalat
    : /da nang/.test(name)
      ? designAssets.tripCover
      : designAssets.coast;
}

export function TripCard({
  trip,
  ticket = false,
}: {
  trip: Trip;
  ticket?: boolean;
}) {
  const { reduceMotion } = useAccessibilityPreferences();
  const [scale] = useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      toValue: 0.982,
      damping: 16,
      stiffness: 350,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      toValue: 1,
      damping: 12,
      stiffness: 240,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mở chuyến đi ${trip.name}`}
        onPress={() => openTrip(trip.id)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.card,
          ticket && styles.ticket,
        ]}
      >
        <Image
          source={coverFor(trip)}
          style={ticket ? styles.ticketImage : StyleSheet.absoluteFill}
          contentFit="cover"
        />
        {!ticket && (
          <LinearGradient
            colors={["transparent", "rgba(5,31,61,0.12)", "rgba(5,31,61,0.88)"]}
            style={StyleSheet.absoluteFill}
          />
        )}
        <GlassSurface variant="subtle" style={styles.badge}>
          <Text style={styles.badgeText}>
            {ticket ? "✈  " : "•  "}
            {lifecycleLabels[trip.lifecycle]}
          </Text>
        </GlassSurface>
        <View style={[styles.details, ticket && styles.ticketDetails]}>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                ticket ? typography.headline : typography.title,
                !ticket && { color: colors.surface },
              ]}
              numberOfLines={2}
            >
              {trip.name}
            </Text>
            <Text
              style={[
                typography.footnote,
                { marginTop: 4 },
                !ticket && { color: "#FFFFFFDD" },
              ]}
            >
              {tripDates(trip)}
            </Text>
          </View>
          {!ticket && (
            <GlassSurface variant="subtle" style={styles.arrow}>
              <DesignIcon name="chevron" size={18} tintColor={colors.teal} />
            </GlassSurface>
          )}
        </View>
        {ticket && (
          <View style={styles.continue}>
            <Text style={[typography.body, { color: colors.teal, fontWeight: "500" }]}>
              Tiếp tục lên kế hoạch
            </Text>
            <DesignIcon name="chevron" size={18} tintColor={colors.teal} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 254,
    borderRadius: 24,
    overflow: "hidden",
    justifyContent: "flex-end",
    backgroundColor: colors.tealSoft,
    ...shadows.card,
  },
  ticket: {
    minHeight: 0,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  ticketImage: { height: 144, width: "100%" },
  badge: {
    position: "absolute",
    top: 14,
    right: 14,
    borderRadius: 99,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  badgeText: { fontSize: 12, color: colors.teal, fontWeight: "600" },
  details: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  ticketDetails: { paddingBottom: 8 },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 99,
    alignItems: "center",
    justifyContent: "center",
  },
  continue: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
