import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { openTrip } from "@/features/trips/components/trip-navigation";
import { useApi } from "@/shared/api/use-api";
import { usePressMotion } from "@/shared/hooks/use-press-motion";
import { useResource } from "@/shared/hooks/use-resource";
import { colors, fonts } from "@/shared/theme/tokens";
import { AppHeader } from "@/shared/ui/app-header";
import { WolfiScene } from "@/shared/ui/brand/wolfi-scene";
import { designAssets } from "@/shared/ui/design-assets";
import { ResourceFeedback } from "@/shared/ui/journal";
import { Screen } from "@/shared/ui/screen";
import { ClayButton, SettingCard } from "@/shared/ui/setting-card";
import { FeaturedTrip } from "../components/featured-trip";

/** Inspiration cards open Create trip with the idea as the name. */
const ideas = [
  { title: "Biển xanh gọi tên", subtitle: "Sơn Trà · Đà Nẵng", source: designAssets.pastelCoast, idea: "Một ngày bên biển" },
  { title: "Phố cổ lên đèn", subtitle: "Hội An · Quảng Nam", source: designAssets.pastelBridge, idea: "Một ngày ở Hội An" },
  { title: "Sương sớm cao nguyên", subtitle: "Hồ Xuân Hương · Đà Lạt", source: designAssets.dalat, idea: "Cuối tuần ở Đà Lạt" },
];

/** Khám phá, after Figma D · M04 without the stat tiles. */
export default function HomeScreen() {
  const api = useApi();
  const resource = useResource(useCallback((signal: AbortSignal) => api.trips.list(undefined, undefined, signal), [api]));
  const items = resource.data?.items;
  const current = items?.find(trip => trip.lifecycle === "ONGOING") ?? items?.find(trip => trip.lifecycle === "UPCOMING");
  return <Screen header={<AppHeader brand />} tab="explore" refreshing={resource.loading && !!resource.data} onRefresh={() => { void resource.reload(); }}>
    <ResourceFeedback {...resource} hasData={!!resource.data} onRetry={() => { void resource.reload(); }} />

    {current && <View style={styles.block}>
      <SectionHead title={current.lifecycle === "ONGOING" ? "Hành trình đang diễn ra" : "Chuyến đi sắp tới"}
        link="Tất cả" mascot onLink={() => router.navigate("/(tabs)/trips")} />
      <FeaturedTrip trip={current} />
      <SettingCard icon="calendar" tone="blue" title={current.lifecycle === "ONGOING" ? "Lịch trình hôm nay" : "Lịch trình"}
        subtitle="Từng điểm dừng, từng ngày" onPress={() => openTrip(current.id, "itinerary")} />
    </View>}

    {resource.data && !current && <View style={styles.welcome}>
      <WolfiScene name="greet" />
      <Text accessibilityRole="header" style={styles.welcomeTitle}>Hành trình đẹp đang chờ</Text>
      <Text style={styles.welcomeCopy}>Chọn một điểm đến, rủ những người bạn và cùng Wolfari lên kế hoạch.</Text>
      <ClayButton label="Tạo chuyến đi" icon="arrowRight" onPress={() => router.push("/create-trip")} />
    </View>}

    <View style={styles.block}>
      <SectionHead title="Cảm hứng lên đường" link="Tạo mới" onLink={() => router.push("/create-trip")} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={250}
        style={styles.carousel} contentContainerStyle={styles.carouselContent}>
        {ideas.map(item => <Inspiration key={item.title} {...item} />)}
      </ScrollView>
    </View>

    <SettingCard icon="compass" tone="lilac" title="Khám phá chuyến đi mẫu" subtitle="Thử Wolfari với dữ liệu minh họa"
      onPress={() => router.push("/demo-trip")} />
  </Screen>;
}

function SectionHead({ title, link, onLink, mascot = false }: { title: string; link: string; onLink: () => void; mascot?: boolean }) {
  // Leave room on the right for Wolfi peeking over the featured card.
  return <View style={[styles.sectionHead, mascot && styles.mascotRoom]}>
    <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
    <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={`${link}: ${title}`} hitSlop={12} onPress={onLink}
      style={({ pressed }) => pressed && styles.pressed}>
      <Text style={styles.sectionLink}>{link}</Text>
    </Pressable>
  </View>;
}

function Inspiration({ title, subtitle, source, idea }: (typeof ideas)[number]) {
  const press = usePressMotion();
  return <Animated.View style={press.animatedStyle}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Lên kế hoạch ${title}`} accessibilityHint={subtitle}
      onPress={() => router.push({ pathname: "/create-trip", params: { idea } })} onPressIn={press.onPressIn} onPressOut={press.onPressOut}
      style={styles.inspiration}>
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
      <LinearGradient colors={["rgba(31,41,69,0)", "rgba(31,41,69,0.7)"]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
      <Text style={styles.photoTitle}>{title}</Text>
      <Text style={styles.photoSubtitle}>{subtitle}</Text>
    </Pressable>
  </Animated.View>;
}

const SUB = "#6A7891";
const styles = StyleSheet.create({
  block: { gap: 12 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 24 },
  mascotRoom: { paddingRight: 116 },
  sectionTitle: { flex: 1, fontFamily: fonts.heading, fontSize: 17, lineHeight: 22, color: colors.ink },
  sectionLink: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 18, color: colors.blue },
  pressed: { opacity: 0.6 },
  carousel: { marginHorizontal: -24, flexGrow: 0 },
  carouselContent: { paddingHorizontal: 24, paddingTop: 2, paddingBottom: 14, gap: 14 },
  inspiration: {
    width: 236, height: 150, borderRadius: 28, overflow: "hidden", justifyContent: "flex-end", padding: 16, paddingBottom: 12,
    boxShadow: "0 8px 20px -4px rgba(92,122,199,0.12)",
  },
  photoTitle: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 22, color: colors.surface },
  photoSubtitle: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 18, color: colors.surface },
  welcome: {
    gap: 12, padding: 12, paddingBottom: 18, borderRadius: 34, backgroundColor: colors.surface,
    boxShadow: "0 12px 28px -4px rgba(92,122,199,0.18), inset 0 2px 3px rgba(255,255,255,0.9), inset 0 -4px 10px rgba(51,64,115,0.06)",
  },
  welcomeTitle: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28, color: colors.ink, paddingHorizontal: 6 },
  welcomeCopy: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: SUB, paddingHorizontal: 6 },
});
