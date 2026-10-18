import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, typography } from "@/shared/theme/tokens";
import { designAssets } from "@/shared/ui/design-assets";
import { DesignIcon } from "@/shared/ui/design-icon";
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Mở chuyến đi ${trip.name}`}
      onPress={() => openTrip(trip.id)}
      style={({ pressed }) => [
        styles.card,
        ticket && styles.ticket,
        pressed && { opacity: 0.8 },
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
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {ticket ? "✈  " : "•  "}
          {lifecycleLabels[trip.lifecycle]}
        </Text>
      </View>
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
          <View style={styles.arrow}>
            <DesignIcon name="chevron" size={18} />
          </View>
        )}
      </View>
      {ticket && (
        <View style={styles.continue}>
          <Text style={[typography.body, { color: colors.teal }]}>
            Tiếp tục lên kế hoạch
          </Text>
          <DesignIcon name="chevron" size={18} />
        </View>
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    minHeight: 254,
    borderRadius: 24,
    overflow: "hidden",
    justifyContent: "flex-end",
    backgroundColor: colors.tealSoft,
  },
  ticket: { minHeight: 0, backgroundColor: colors.surface },
  ticketImage: { height: 144, width: "100%" },
  badge: {
    position: "absolute",
    top: 14,
    right: 14,
    backgroundColor: "rgba(255,255,255,0.94)",
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
    backgroundColor: colors.surface,
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
