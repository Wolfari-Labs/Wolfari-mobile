import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";

import { colors } from "@/shared/theme/tokens";
import { useEntrance } from "./motion";

export type Point = { x: number; y: number };
/** One cubic Bézier segment in normalized (0–1) coordinates: start, control 1, control 2, end. */
export type Segment = [Point, Point, Point, Point];

function bezier(s: Segment, t: number): Point {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return {
    x: a * s[0].x + b * s[1].x + c * s[2].x + d * s[3].x,
    y: a * s[0].y + b * s[1].y + c * s[2].y + d * s[3].y,
  };
}

/** Evenly spaced dots (in pixels) along a chain of Bézier segments. */
export function sampleRoute(segments: Segment[], width: number, height: number, spacing: number) {
  const dense: Point[] = [];
  for (const segment of segments) {
    for (let i = 0; i <= 60; i++) {
      const p = bezier(segment, i / 60);
      dense.push({ x: p.x * width, y: p.y * height });
    }
  }
  const dots: Point[] = [];
  let carry = 0;
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1], b = dense[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    let travelled = spacing - carry;
    while (travelled <= length) {
      const t = travelled / length;
      dots.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      travelled += spacing;
    }
    carry = (carry + length) % spacing;
  }
  if (dense.length && !dots.length) dots.push(dense[0]);
  return dots;
}

function TrailDot({ point, index, count, progress, size, color }: {
  point: Point; index: number; count: number; progress: SharedValue<number>; size: number; color: string;
}) {
  const style = useAnimatedStyle(() => {
    const local = interpolate(progress.get() * count - index, [0, 1], [0, 1], Extrapolation.CLAMP);
    return { opacity: local, transform: [{ scale: 0.3 + local * 0.7 }] };
  });
  return (
    <Animated.View
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color, left: point.x - size / 2, top: point.y - size / 2 },
        style,
      ]}
    />
  );
}

/**
 * A dashed travel route that "draws itself" dot by dot — the teal trail from
 * the Wolfari paper-plane logo. Purely decorative and hidden from assistive tech.
 */
export function RouteTrail({
  segments,
  width,
  height,
  color = colors.route,
  dot = 4,
  spacing = 11,
  duration = 1100,
  delay = 0,
}: {
  segments: Segment[];
  width: number;
  height: number;
  color?: string;
  dot?: number;
  spacing?: number;
  duration?: number;
  delay?: number;
}) {
  const points = useMemo(
    () => (width > 0 && height > 0 ? sampleRoute(segments, width, height, spacing) : []),
    [segments, width, height, spacing],
  );
  const progress = useEntrance({ delay, duration });
  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill]}>
      {points.map((point, index) => (
        <TrailDot key={index} point={point} index={index} count={points.length} progress={progress} size={dot} color={color} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { position: "absolute" },
});
