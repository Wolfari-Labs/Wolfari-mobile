import { Canvas, Circle, Group, LinearGradient, Path, RadialGradient, Rect, vec } from "@shopify/react-native-skia";
import { useEffect } from "react";
import { cancelAnimation, Easing, useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";

import { colors } from "@/shared/theme/tokens";
import type { AuroraProps } from "./aurora.types";

/** One small, decorative canvas. A finite drift, not an always-running shader loop. */
export default function AuroraCanvas({ width, height, active }: AuroraProps) {
  const progress = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(progress);
    if (active) {
      progress.value = 0;
      progress.value = withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) });
    }
    return () => cancelAnimation(progress);
  }, [active, progress]);
  const orbX = useDerivedValue(() => width * 0.88 - progress.value * 12);
  const orbY = useDerivedValue(() => height * 0.28 + progress.value * 8);
  const orbCenter = useDerivedValue(() => vec(orbX.value - 15, orbY.value - 18));
  const radius = Math.min(width * 0.30, 114);
  const arc = `M ${width * 0.44} ${height + 16} C ${width * 0.52} ${height * 0.28}, ${width * 1.08} ${height * 0.92}, ${width * 1.04} ${-24}`;
  return (
    <Canvas style={{ width, height }} testID="aurora-canvas" pointerEvents="none" accessible={false}>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={[colors.ocean, colors.lagoon, "#187F86"]} />
      </Rect>
      <Circle cx={orbX} cy={orbY} r={radius * 1.7}>
        <RadialGradient c={orbCenter} r={radius * 1.7} colors={["#7EDECE60", "#7EDECE00"]} />
      </Circle>
      <Circle cx={orbX} cy={orbY} r={radius}>
        <RadialGradient c={orbCenter} r={radius * 1.65} colors={["#D9FFF384", "#74CFC73B", "#1B7A8720"]} positions={[0, 0.52, 1]} />
      </Circle>
      <Circle cx={orbX} cy={orbY} r={radius} style="stroke" strokeWidth={1} color="#DEFFF36B" />
      <Circle cx={orbX} cy={orbY} r={radius * 0.82} style="stroke" strokeWidth={0.6} color="#DEFFF32E" />
      <Group>
        <Path path={arc} style="stroke" strokeWidth={22} color="#9DE8DC0D" />
        <Path path={arc} style="stroke" strokeWidth={1.2} color="#C5FFF57A" />
        <Circle cx={width * 0.70} cy={height * 0.76} r={3} color="#DBFFF7" />
        <Circle cx={width * 0.70} cy={height * 0.76} r={8} style="stroke" strokeWidth={1} color="#DBFFF74D" />
        <Circle cx={width * 0.70} cy={height * 0.13} r={2} color="#DBFFF7A8" />
        <Circle cx={width * 0.96} cy={height * 0.63} r={1.5} color="#DBFFF7A8" />
      </Group>
    </Canvas>
  );
}
