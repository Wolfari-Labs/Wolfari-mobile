import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/shared/theme/tokens';
import type { Observation } from '../api';
import { chartPoints } from '../series';

const HEIGHT = 96, PAD = 10, LINE = 3;

/** Figma D · M18 price line, drawn with plain views so it needs no graphics library. */
export function PriceChart({ series, threshold, label }: { series: Observation[]; threshold: string; label: string }) {
  const [width, setWidth] = useState(0);
  const plot = Math.max(0, width - PAD * 2);
  const { points, thresholdY } = chartPoints(series, threshold, plot, HEIGHT - PAD * 2);
  const segments = plot > 0 ? points.slice(1).map((to, i) => {
    const from = points[i], dx = to.x - from.x, dy = to.y - from.y;
    return { x: from.x, dx, length: Math.hypot(dx, dy), angle: Math.atan2(dy, dx), midX: (from.x + to.x) / 2, midY: (from.y + to.y) / 2 };
  }) : [];
  const last = points[points.length - 1];
  return <View accessible accessibilityRole="image" accessibilityLabel={label} style={styles.chart} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    {plot > 0 && <>
      {/* Tint under the line: one clipped, tilted panel per segment. */}
      {segments.map((s, i) => s.dx > 0 && <View key={`fill${i}`} style={[styles.clip, { left: PAD + s.x, width: s.dx }]}>
        <View style={[styles.fill, { width: s.length + HEIGHT * 2, left: s.dx / 2 - s.length / 2 - HEIGHT, top: PAD + s.midY, transformOrigin: '50% 0%', transform: [{ rotate: `${s.angle}rad` }] }]} />
      </View>)}
      <View style={[styles.threshold, { top: PAD + thresholdY }]} />
      {segments.map((s, i) => <View key={i} style={[styles.line, {
        width: s.length + LINE, left: PAD + s.midX - (s.length + LINE) / 2, top: PAD + s.midY - LINE / 2,
        backgroundColor: i < segments.length / 2 ? colors.gradientBlue : colors.gradientMint, transform: [{ rotate: `${s.angle}rad` }],
      }]} />)}
      <View style={[styles.dot, { left: PAD + last.x - 7, top: PAD + last.y - 7 }]} />
    </>}
  </View>;
}

const styles = StyleSheet.create({
  chart: { height: HEIGHT, overflow: 'hidden' },
  clip: { position: 'absolute', top: 0, bottom: 0, overflow: 'hidden' },
  fill: { position: 'absolute', height: HEIGHT * 3, backgroundColor: 'rgba(91,140,255,0.12)' },
  line: { position: 'absolute', height: LINE, borderRadius: LINE / 2 },
  threshold: { position: 'absolute', left: 0, right: 0, height: 0, borderWidth: 0.75, borderStyle: 'dashed', borderColor: '#FF6F59' },
  dot: { position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: colors.gradientMint, backgroundColor: colors.surface },
});
