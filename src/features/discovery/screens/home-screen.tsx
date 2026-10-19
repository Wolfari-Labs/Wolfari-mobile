import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { useSession } from "@/features/auth/session/session-provider";
import { TripCard } from "@/features/trips/components/trip-card";
import { openTrip } from "@/features/trips/components/trip-navigation";
import { useApi } from "@/shared/api/use-api";
import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { useResource } from "@/shared/hooks/use-resource";
import { colors, shadows, typography } from "@/shared/theme/tokens";
import { AppHeader } from "@/shared/ui/app-header";
import { Button } from "@/shared/ui/button";
import { designAssets } from "@/shared/ui/design-assets";
import {
  EmptyState,
  ResourceFeedback,
  SectionLink,
  ui,
} from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";

export default function HomeScreen() {
  const { profile } = useSession();
  const api = useApi();
  const resource = useResource(
    useCallback(
      (signal: AbortSignal) => api.trips.list(undefined, undefined, signal),
      [api],
    ),
  );
  const current =
    resource.data?.items.find((trip) => trip.lifecycle === "ONGOING") ??
    resource.data?.items.find((trip) => trip.lifecycle === "UPCOMING");
  return (
    <Screen
      header={<AppHeader />}
      tab="explore"
      refreshing={resource.loading && !!resource.data}
      onRefresh={() => {
        void resource.reload();
      }}
    >
      <View style={styles.greeting}>
        <View style={{ flex: 1 }}>
          <Text style={typography.footnote}>
            CHÀO{" "}
            {profile?.full_name.split(" ").at(-1)?.toLocaleUpperCase("vi-VN")},
          </Text>
          <Text
            accessibilityRole="header"
            style={[typography.largeTitle, { fontSize: 32, marginTop: 4 }]}
          >
            Đi đâu <Text style={{ color: colors.teal }}>tiếp</Text> nhỉ?
          </Text>
        </View>
        <Image
          source={designAssets.mascot}
          style={styles.mascot}
          contentFit="contain"
        />
      </View>
      <ResourceFeedback
        {...resource}
        hasData={!!resource.data}
        onRetry={() => {
          void resource.reload();
        }}
      />
      {current && (
        <>
          <TripCard trip={current} ticket />
          <View style={ui.group}>
            <SectionLink
              grouped
              title="Lịch trình"
              subtitle="Trải nghiệm mỗi ngày"
              icon="calendar"
              onPress={() => openTrip(current.id, "itinerary")}
            />
            <SectionLink
              grouped
              last
              title="Bạn đồng hành"
              subtitle="Cùng lên kế hoạch"
              icon="users"
              onPress={() =>
                router.push({
                  pathname: "/trip/[id]/members",
                  params: { id: current.id },
                })
              }
            />
          </View>
        </>
      )}
      {resource.data && !current && (
        <EmptyState
          title="Hẹn nhau một chuyến đi"
          message="Thêm hành trình đầu tiên, rồi cùng nhóm lên kế hoạch cho những ngày thật đẹp."
          action={
            <Button
              label="Tạo chuyến đi"
              onPress={() => router.push("/create-trip")}
            />
          }
        />
      )}
      <Text accessibilityRole="header" style={typography.section}>
        Cảm hứng lên đường
      </Text>
      <InspirationCard
        onPress={() =>
          router.push({
            pathname: "/create-trip",
            params: { idea: "Một ngày bên biển" },
          })
        }
      />
      <Button
        label="Xem các chuyến đi của tôi"
        variant="soft"
        onPress={() => router.navigate("/(tabs)/trips")}
      />
    </Screen>
  );
}

function InspirationCard({ onPress }: { onPress: () => void }) {
  const { reduceMotion } = useAccessibilityPreferences();
  const [scale] = useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      toValue: 0.98,
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
        accessibilityLabel="Lên kế hoạch một ngày bên biển"
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.inspiration}
      >
        <Image
          source={designAssets.coast}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        <LinearGradient
          colors={["transparent", "rgba(5,31,61,0.85)"]}
          style={StyleSheet.absoluteFill}
        />
        <Text style={[typography.title, { color: "white" }]}>
          Biển xanh gọi tên
        </Text>
        <Text style={[typography.footnote, { color: "rgba(255,255,255,0.88)" }]}>
          Một chút nắng, một ngày thật xanh
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  greeting: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  mascot: { width: 64, height: 64 },
  tools: { flexDirection: "row", gap: 16 },
  inspiration: {
    minHeight: 170,
    borderRadius: 24,
    overflow: "hidden",
    padding: 16,
    justifyContent: "flex-end",
    gap: 4,
    ...shadows.card,
  },
});
