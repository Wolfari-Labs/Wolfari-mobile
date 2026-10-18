import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "@/shared/ui/button";
import { designAssets } from "@/shared/ui/design-assets";

// P15 (612:8805): one shared 2s timeline; positions are Figma's sampled tracks.
const times = [0, 0.05, 0.1, 0.15, 0.175, 0.2, 0.225, 0.25, 0.3, 0.35, 0.4, 0.45, 1];
const x = [35, 23.11, 13.196, 5.466, 2.642, 0.728, 0, -0.888, -2.442, -3.711, -4.623, -5, -5];
const y = [28, 12.653, 0.716, -6.798, -8, 1.234, 9.786, 17.764, 31.973, 43.536, 51.707, 55, 55];
const pieces = [
  { left: 28, top: 34, wide: true, start: 0.855, end: 1.815 }, { left: 46, top: 51, wide: false, start: 0.436, end: -1.571 },
  { left: 62, top: 65, wide: true, start: 0.017, end: 0.977 }, { left: 73, top: 34, wide: false, start: 0.855, end: -1.152 },
  { left: 94, top: 51, wide: true, start: 0.436, end: 1.396 }, { left: 220, top: 66, wide: false, start: 0.017, end: -1.99 },
  { left: 235, top: 34, wide: true, start: 0.855, end: 1.815 }, { left: 254, top: 51, wide: false, start: 0.436, end: -1.571 },
  { left: 271, top: 65, wide: true, start: 0.017, end: 0.977 }, { left: 282, top: 34, wide: false, start: 0.855, end: -1.152 },
];
export function PackingCompletion({ visible, count, onClose }: { visible: boolean; count: number; onClose: () => void }) {
  const [timeline] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));
  const [lift] = useState(() => new Animated.Value(0));
  const [rotation] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (!visible || reduceMotion) { opacity.setValue(1); lift.setValue(0); return; }
    const ease = Easing.bezier(0, 0, 0.58, 1);
    const animation = Animated.loop(Animated.parallel([
      Animated.timing(timeline, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
      Animated.sequence([Animated.timing(opacity, { toValue: 1, duration: 180, easing: ease, useNativeDriver: true }), Animated.delay(1820)]),
      Animated.sequence([Animated.timing(lift, { toValue: 0, duration: 240, easing: ease, useNativeDriver: true }), Animated.delay(1760)]),
      Animated.sequence([Animated.timing(rotation, { toValue: 1, duration: 900, easing: ease, useNativeDriver: true }), Animated.delay(1100)]),
    ]));
    timeline.setValue(0); opacity.setValue(0); lift.setValue(14); rotation.setValue(0); animation.start();
    return () => animation.stop();
  }, [visible, reduceMotion, timeline, opacity, lift, rotation]);
  return <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}><View style={styles.overlay}><Pressable accessibilityRole="button" accessibilityLabel="Đóng thông báo hoàn tất" onPress={onClose} style={StyleSheet.absoluteFill} /><Animated.View accessibilityViewIsModal style={[styles.card, { opacity, transform: [{ translateY: lift }] }]}><Image source={designAssets.mascot} style={{ width: 108, height: 84 }} contentFit="contain" /><Text style={[typography.largeTitle, { color: colors.teal, textAlign: "center" }]}>{count} / {count} món</Text><Text style={typography.headline}>Sẵn sàng lên đường!</Text><Text style={[typography.body, { color: colors.muted, textAlign: "center" }]}>Cả nhóm đã chuẩn bị đủ hành lý.{"\n"}Giờ thì đếm ngược đến ngày đi thôi.</Text><Button label="Tuyệt, đi thôi!" onPress={onClose} style={{ alignSelf: "stretch" }} />{!reduceMotion && pieces.map((piece, index) => <Animated.View key={index} pointerEvents="none" style={{ position: "absolute", left: piece.left, top: piece.top, width: piece.wide ? 8 : 5, height: piece.wide ? 5 : 12, borderRadius: 2, backgroundColor: index % 3 === 1 ? "#FFBE16" : colors.teal, opacity: timeline.interpolate({ inputRange: [0, 0.06, 0.275, 0.45, 1], outputRange: [0, 1, 1, 0, 0] }), transform: [{ translateX: timeline.interpolate({ inputRange: times, outputRange: x.map(value => index >= 5 ? -value : value) }) }, { translateY: timeline.interpolate({ inputRange: times, outputRange: y }) }, { rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: [`${piece.start}rad`, `${piece.end}rad`] }) }] }} />)}</Animated.View></View></Modal>;
}
const styles = StyleSheet.create({ overlay: { flex: 1, backgroundColor: "rgba(6,69,139,0.18)", alignItems: "center", justifyContent: "center", padding: 24 }, card: { width: "100%", maxWidth: 354, padding: 24, borderRadius: 34, backgroundColor: "white", alignItems: "center", gap: 10, overflow: "hidden", boxShadow: "0 10px 22px -7px rgba(21,77,80,0.04)" } });
