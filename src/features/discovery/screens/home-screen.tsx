import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TripCard } from "@/features/trips/components/trip-card";
import { openTrip } from "@/features/trips/components/trip-navigation";
import { useApi } from "@/shared/api/use-api";
import { useResource } from "@/shared/hooks/use-resource";
import { colors, radii, shadows, typography } from "@/shared/theme/tokens";
import { AppHeader } from "@/shared/ui/app-header";
import { Button } from "@/shared/ui/button";
import { designAssets } from "@/shared/ui/design-assets";
import { ResourceFeedback, SectionLink } from "@/shared/ui/journal";
import { StatGrid, StatTile } from "@/shared/ui/pastel";
import { Screen } from "@/shared/ui/screen";

export default function HomeScreen() {
  const api = useApi();
  const resource = useResource(useCallback((signal: AbortSignal) => api.trips.list(undefined, undefined, signal), [api]));
  const items = resource.data?.items;
  const current = items?.find(trip => trip.lifecycle === "ONGOING") ?? items?.find(trip => trip.lifecycle === "UPCOMING");
  return <Screen header={<AppHeader />} tab="explore" refreshing={resource.loading && !!resource.data} onRefresh={() => { void resource.reload(); }}>
    <ResourceFeedback {...resource} hasData={!!resource.data} onRetry={() => { void resource.reload(); }} />
    {current && <>
      <View style={styles.sectionHead}>
        <Text accessibilityRole="header" style={[typography.headline, styles.flex]}>{current.lifecycle === "ONGOING" ? "Hành trình đang diễn ra" : "Chuyến đi sắp tới"}</Text>
        <Button label="Tất cả" variant="text" compact onPress={() => router.navigate("/(tabs)/trips")} />
      </View>
      <View>
        <TripCard trip={current} ticket />
        <Image source={designAssets.pastelMascot} style={styles.mascot} contentFit="contain" accessible={false} />
      </View>
      <StatGrid>
        <StatTile icon="bag" tone="butter" value="Hành lý" label="Cùng nhóm chuẩn bị" onPress={() => router.push({ pathname: "/trip/[id]/packing", params: { id: current.id } })} />
        <StatTile icon="wallet" tone="mint" value="Quỹ nhóm" label="Đóng góp và chi tiêu" onPress={() => router.push({ pathname: "/trip/[id]/fund", params: { id: current.id } })} />
      </StatGrid>
    </>}
    <Text accessibilityRole="header" style={typography.section}>Cảm hứng lên đường</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carousel} contentContainerStyle={styles.carouselContent}>
      {[{ title: "Biển xanh gọi tên", subtitle: "Sơn Trà · Đà Nẵng", source: designAssets.pastelCoast, idea: "Một ngày bên biển" },
        { title: "Phố cổ lên đèn", subtitle: "Hội An · Quảng Nam", source: designAssets.pastelBridge, idea: "Một ngày ở Hội An" }].map(item =>
        <Pressable cssInterop={false} key={item.title} accessibilityRole="button" accessibilityLabel={`Lên kế hoạch ${item.title}`}
          onPress={() => router.push({ pathname: "/create-trip", params: { idea: item.idea } })}
          style={({ pressed }) => [styles.inspiration, pressed && styles.pressed]}>
          <Image source={item.source} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
          <LinearGradient colors={["transparent", "rgba(31,42,68,0.9)"]} style={StyleSheet.absoluteFill} />
          <Text style={styles.photoTitle}>{item.title}</Text><Text style={styles.photoSubtitle}>{item.subtitle}</Text>
        </Pressable>)}
    </ScrollView>
    {resource.data && !current && <View style={styles.empty}>
      <Text accessibilityRole="header" style={typography.section}>Hành trình đẹp đang chờ</Text>
      <Text style={[typography.body, styles.muted]}>Chọn một điểm đến. Rủ những người bạn. Cùng Wolfari lên kế hoạch.</Text>
      <Button label="Tạo chuyến đi" icon="plus" onPress={() => router.push("/create-trip")} />
    </View>}
    {current && <SectionLink title="Lịch trình" subtitle="Từng điểm dừng, từng ngày" icon="calendar" onPress={() => openTrip(current.id, "itinerary")} />}
    <SectionLink title="Khám phá chuyến đi mẫu" subtitle="Thử Wolfari với dữ liệu minh họa." icon="compass" onPress={() => router.push("/demo-trip")} />
    <Button label="Xem các chuyến đi của tôi" variant="text" onPress={() => router.navigate("/(tabs)/trips")} />
  </Screen>;
}
const styles = StyleSheet.create({
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: -12 },
  flex: { flex: 1 },
  muted: { color: colors.muted },
  mascot: { position: "absolute", width: 86, height: 72, right: -8, top: -24, pointerEvents: "none" },
  carousel: { marginHorizontal: -24, flexGrow: 0 },
  carouselContent: { paddingHorizontal: 24, paddingBottom: 10, gap: 14 },
  inspiration: { width: 236, height: 150, borderRadius: radii.card, overflow: "hidden", justifyContent: "flex-end", padding: 16, gap: 2, ...shadows.glass },
  photoTitle: { ...typography.headline, color: colors.surface },
  photoSubtitle: { ...typography.footnote, color: colors.surface },
  empty: { backgroundColor: colors.surface, borderRadius: radii.cardLarge, padding: 20, gap: 12, ...shadows.card },
  pressed: { opacity: 0.75 },
});
