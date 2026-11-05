import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from "react-native-reanimated";

import { usePressMotion } from "@/shared/hooks/use-press-motion";
import { colors, springs, typography } from "@/shared/theme/tokens";
import { MapPin } from "./map-pin";
import { useAmbientLoop, useEntrance } from "./motion";
import { RouteTrail, type Point, type Segment } from "./route-trail";
import { Wolfi, type WolfiPose } from "./wolfi";

const mapArt = require("@/assets/carto/explore-map.svg");

export type MapStop = {
  key: string;
  title: string;
  caption?: string;
  onPress?: () => void;
};

const START: Point = { x: 0.12, y: 0.46 };
const SLOTS: { at: Point; route: Segment; color: string; labelSide: "left" | "right"; tilt: number }[] = [
  {
    at: { x: 0.74, y: 0.3 },
    route: [START, { x: 0.3, y: 0.2 }, { x: 0.55, y: 0.5 }, { x: 0.74, y: 0.3 }],
    color: colors.pinBlue,
    labelSide: "left",
    tilt: -3,
  },
  {
    at: { x: 0.62, y: 0.6 },
    route: [START, { x: 0.25, y: 0.72 }, { x: 0.45, y: 0.45 }, { x: 0.62, y: 0.6 }],
    color: colors.pinGreen,
    labelSide: "left",
    tilt: 2,
  },
  {
    at: { x: 0.5, y: 0.86 },
    route: [START, { x: 0.2, y: 0.76 }, { x: 0.32, y: 0.96 }, { x: 0.5, y: 0.86 }],
    color: colors.pinOrange,
    labelSide: "right",
    tilt: -2,
  },
];

/**
 * The map-first hero from direction E: an illustrated paper map where each
 * upcoming trip is a numbered pin, joined to "Bạn ở đây" by a route that draws
 * itself, with Wolfi reading the map. Labels are real, tappable buttons.
 */
export function ExploreMap({
  stops,
  height = 300,
  mascot = "map",
  greeting,
}: {
  stops: MapStop[];
  height?: number;
  mascot?: WolfiPose;
  greeting?: { eyebrow: string; title: string };
}) {
  const [width, setWidth] = useState(0);
  const visible = stops.slice(0, SLOTS.length);
  const compass = useEntrance({ delay: 120, spring: springs.gentle });
  const here = useAmbientLoop({ duration: 1500, pingPong: false });
  const compassStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(compass.get(), [0, 1], [-140, 0])}deg` }],
  }));
  const hereStyle = useAnimatedStyle(() => ({
    opacity: interpolate(here.get(), [0, 1], [0.55, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(here.get(), [0, 1], [1, 2.6]) }],
  }));

  return (
    <View style={[styles.frame, { height }]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <Image source={mapArt} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
      {width > 0 && (
        <RouteTrail
          width={width}
          height={height}
          segments={visible.map((_, index) => SLOTS[index].route)}
          duration={900 + visible.length * 300}
          delay={260}
        />
      )}

      <Animated.View pointerEvents="none" style={[styles.compass, compassStyle]}>
        <View style={styles.needleNorth} />
        <View style={styles.needleSouth} />
        <Text style={styles.north}>B</Text>
      </Animated.View>

      {width > 0 && (
        <View pointerEvents="none" style={[styles.here, { left: START.x * width - 9, top: START.y * height - 9 }]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.hereRing, hereStyle]} />
          <View style={styles.hereDot} />
        </View>
      )}
      {width > 0 && (
        <Text style={[styles.hereLabel, { left: START.x * width - 28, top: START.y * height + 12 }]}>Bạn ở đây</Text>
      )}

      {width > 0 && visible.map((stop, index) => {
        const slot = SLOTS[index];
        return (
          <View key={stop.key} style={[styles.stop, { left: slot.at.x * width - 15, top: slot.at.y * height - 15 }]}>
            <MapPin label={index + 1} color={slot.color} delay={520 + index * 260} pulse={index === 0} />
            <StopLabel stop={stop} side={slot.labelSide} tilt={slot.tilt} delay={700 + index * 260} />
          </View>
        );
      })}

      <Wolfi pose={mascot} size={92} delay={380} style={styles.mascot} />

      {greeting && (
        <View style={styles.greeting}>
          <Text style={typography.eyebrow}>{greeting.eyebrow}</Text>
          <Text accessibilityRole="header" style={styles.greetingTitle}>{greeting.title}</Text>
        </View>
      )}
    </View>
  );
}

function StopLabel({ stop, side, tilt, delay }: { stop: MapStop; side: "left" | "right"; tilt: number; delay: number }) {
  const pop = useEntrance({ delay, spring: springs.bouncy });
  const motion = usePressMotion(!stop.onPress, 0.97);
  const popStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pop.get(), [0, 0.3], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(pop.get(), [0, 1], [0.6, 1]) }, { rotate: `${tilt}deg` }],
  }));
  const content = (
    <>
      <Text numberOfLines={1} style={styles.tagTitle}>{stop.title}</Text>
      {!!stop.caption && <Text numberOfLines={1} style={styles.tagCaption}>{stop.caption}</Text>}
    </>
  );
  return (
    <Animated.View style={[styles.tagWrap, side === "left" ? styles.tagLeft : styles.tagRight, popStyle]}>
      <Animated.View style={motion.animatedStyle}>
        {stop.onPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Mở chuyến đi ${stop.title}${stop.caption ? `, ${stop.caption}` : ""}`}
            onPress={stop.onPress}
            onPressIn={motion.onPressIn}
            onPressOut={motion.onPressOut}
            hitSlop={6}
            style={styles.tag}
          >
            {content}
          </Pressable>
        ) : (
          <View style={styles.tag}>{content}</View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    borderRadius: 22,
    borderCurve: "continuous",
    borderWidth: 1.5,
    borderColor: colors.ink,
    overflow: "hidden",
    backgroundColor: colors.land,
    boxShadow: "0 5px 0 -1px rgba(23, 63, 99, 0.22)",
  },
  compass: { position: "absolute", right: 12, top: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.ink, alignItems: "center", justifyContent: "center" },
  needleNorth: { position: "absolute", top: 6, width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 13, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: colors.plane },
  needleSouth: { position: "absolute", bottom: 6, width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 13, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: colors.ink },
  north: { position: "absolute", top: -1, fontSize: 7, fontWeight: "800", color: colors.ink },
  here: { position: "absolute", width: 18, height: 18 },
  hereRing: { borderRadius: 9, backgroundColor: colors.sun },
  hereDot: { flex: 1, borderRadius: 9, backgroundColor: colors.sun, borderWidth: 1.5, borderColor: colors.ink },
  hereLabel: { position: "absolute", fontSize: 11, fontStyle: "italic", fontWeight: "700", color: colors.ink },
  stop: { position: "absolute", width: 30, height: 30, zIndex: 2 },
  tagWrap: { position: "absolute", top: -4 },
  tagLeft: { right: 36, alignItems: "flex-end" },
  tagRight: { left: 36, alignItems: "flex-start" },
  tag: {
    maxWidth: 150,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.ink,
    boxShadow: "0 3px 0 -1px rgba(23, 63, 99, 0.22)",
  },
  tagTitle: { fontSize: 13, lineHeight: 17, fontWeight: "800", color: colors.ink },
  tagCaption: { fontSize: 11, lineHeight: 14, color: colors.muted, fontStyle: "italic" },
  mascot: { position: "absolute", left: "1%", bottom: "1%" },
  greeting: {
    position: "absolute",
    top: 12,
    left: 12,
    maxWidth: "62%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.ink,
    boxShadow: "0 4px 0 -1px rgba(23, 63, 99, 0.22)",
  },
  greetingTitle: { fontSize: 22, lineHeight: 26, fontWeight: "800", color: colors.ink, letterSpacing: -0.4 },
});
