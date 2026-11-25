import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { useAccessibilityPreferences } from "@/shared/hooks/use-accessibility-preferences";
import { colors, fonts, springs } from "@/shared/theme/tokens";
import { designAssets, type DesignIconName } from "../design-assets";
import { DesignIcon } from "../design-icon";

/**
 * Wolfi scenes for empty states and small moments (Claude Design board "Wolfi theo tình huống").
 * Each scene is one expression, one prop and one main motion; loops are kept for waiting states.
 * Drawn on a 300 × 200 stage that stays centred while the pastel panel stretches.
 * Under Reduce Motion every piece simply sits in its final place.
 */
export type WolfiSceneName =
  | "saveOk" | "saveFail" | "sync" | "greet" | "reminder" | "notFound"
  | "noMemories" | "inviteSent" | "groupReady" | "waiting" | "quiet" | "tripDone";

const W = 300;
const H = 200;
const NIGHT = ["#2B3550", "#4A5A8C"] as const;
const backgrounds: Record<WolfiSceneName, readonly [string, string]> = {
  saveOk: [colors.mintCanvas, colors.mintCanvas],
  saveFail: [colors.errorSurface, colors.errorSurface],
  sync: [colors.ice, colors.ice],
  greet: [colors.butter, colors.peach],
  reminder: [colors.lilac, colors.lilac],
  notFound: [colors.ice, colors.ice],
  noMemories: [colors.peach, colors.peach],
  inviteSent: [colors.tealSoft, colors.tealSoft],
  groupReady: [colors.mintCanvas, colors.mintCanvas],
  waiting: [colors.butter, colors.butter],
  quiet: NIGHT,
  tripDone: [colors.mintCanvas, colors.ice],
};

export function WolfiScene({ name, label, style }: {
  name: WolfiSceneName;
  /** Pass a label only when the scene carries meaning the text around it does not. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { reduceMotion } = useAccessibilityPreferences();
  const still = !!reduceMotion;
  return (
    <View accessible={!!label} accessibilityRole={label ? "image" : undefined} accessibilityLabel={label}
      importantForAccessibility={label ? "yes" : "no-hide-descendants"} style={[styles.panel, style]}>
      <LinearGradient colors={backgrounds[name]} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.stage}>{scenes[name](still)}</View>
    </View>
  );
}

/* ---------- motion helpers ---------- */

/** 0 → 1 once, after `delay`. */
function useOnce(still: boolean, delay = 0, spring = springs.bouncy): SharedValue<number> {
  const v = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) { v.set(1); return; }
    v.set(0);
    v.set(withDelay(delay, withSpring(1, spring)));
    return () => cancelAnimation(v);
  }, [still, delay, spring, v]);
  return v;
}

/** 0 → 1 → 0 forever (or `times` times), easing in and out. */
function useLoop(still: boolean, duration: number, delay = 0, times = -1): SharedValue<number> {
  const v = useSharedValue(0);
  useEffect(() => {
    if (still) { v.set(0); return; }
    const half = withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.sin) });
    v.set(withDelay(delay, withRepeat(withSequence(half, withTiming(0, { duration: duration / 2, easing: Easing.inOut(Easing.sin) })), times)));
    return () => cancelAnimation(v);
  }, [still, duration, delay, times, v]);
  return v;
}

/** 0 → 1 linearly, repeating (for spins and travelling things). */
function useCycle(still: boolean, duration: number, delay = 0, times = -1, settle = 0): SharedValue<number> {
  const v = useSharedValue(settle);
  useEffect(() => {
    if (still) { v.set(settle); return; }
    v.set(0);
    v.set(withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), times, false)));
    return () => cancelAnimation(v);
  }, [still, duration, delay, times, settle, v]);
  return v;
}

/* ---------- pieces ---------- */

type Pose = "bust" | "happy" | "wink" | "surprised" | "sad" | "sleep";
const busts: Record<Pose, number> = {
  bust: designAssets.wolfiBust, happy: designAssets.wolfiHappy, wink: designAssets.wolfiWink,
  surprised: designAssets.wolfiSurprised, sad: designAssets.wolfiSad, sleep: designAssets.wolfiSleep,
};

/** Wolfi's bust rises into the bottom of the stage. `sway` and `breathe` loop afterwards. */
function Bust({ pose, still, loop, left = 88 }: { pose: Pose; still: boolean; loop?: "sway" | "breathe"; left?: number }) {
  const enter = useOnce(still, 120);
  const l = useLoop(still || !loop, loop === "sway" ? 2600 : 3200, 900);
  const style = useAnimatedStyle(() => {
    const e = enter.get();
    return {
      opacity: interpolate(e, [0, 0.25], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(e, [0, 1], [40, 0]) },
        { rotate: `${loop === "sway" ? -4 * l.get() : 0}deg` },
        { scaleY: loop === "breathe" ? 1 + 0.025 * l.get() : 1 },
      ],
    };
  });
  return <Animated.View style={[{ position: "absolute", left, bottom: -8, width: 124, height: 166, transformOrigin: "50% 100%" }, style]}>
    <Image source={busts[pose]} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} />
  </Animated.View>;
}

function Body({ source, still, style }: { source: number; still: boolean; style: ViewStyle }) {
  const enter = useOnce(still, 120);
  const a = useAnimatedStyle(() => ({
    opacity: interpolate(enter.get(), [0, 0.25], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(enter.get(), [0, 1], [36, 0]) }],
  }));
  return <Animated.View style={[{ position: "absolute" }, style, a]}>
    <Image source={source} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} />
  </Animated.View>;
}

/** Anything that stamps in: scale from 0 with a small turn. */
function Pop({ still, delay, at, children }: { still: boolean; delay: number; at: ViewStyle; children: ReactNode }) {
  const p = useOnce(still, delay, springs.stamp);
  const a = useAnimatedStyle(() => ({
    opacity: interpolate(p.get(), [0, 0.2], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: p.get() }, { rotate: `${interpolate(p.get(), [0, 1], [-25, 0])}deg` }],
  }));
  return <Animated.View style={[{ position: "absolute" }, at, a]}>{children}</Animated.View>;
}

function Star({ still, delay, x, y, size }: { still: boolean; delay: number; x: number; y: number; size: number }) {
  return <Pop still={still} delay={delay} at={{ left: x, top: y }}>
    <Image source={designAssets.compassStar} style={{ width: size, height: size }} contentFit="contain" accessible={false} />
  </Pop>;
}

function Bubble({ size = 56, children }: { size?: number; children: ReactNode }) {
  return <View style={[styles.bubble, { width: size, height: size, borderRadius: size / 2 }]}>{children}</View>;
}

function Glyph({ name, size = 32, tint }: { name: DesignIconName; size?: number; tint?: string }) {
  return <DesignIcon name={name} size={size} tintColor={tint} />;
}

/* ---------- scenes ---------- */

function SaveOk({ still }: { still: boolean }) {
  return <>
    <Bust pose="happy" still={still} />
    <Pop still={still} delay={600} at={{ right: 30, top: 24 }}><Bubble><Glyph name="saveOk" /></Bubble></Pop>
    <Star still={still} delay={800} x={46} y={40} size={16} />
    <Star still={still} delay={900} x={70} y={92} size={10} />
    <Star still={still} delay={1000} x={222} y={112} size={12} />
  </>;
}

function SaveFail({ still }: { still: boolean }) {
  const shake = useLoop(still, 420, 700, 1);
  const s = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(shake.get(), [0, 0.5, 1], [0, -6, 6]) }] }));
  return <>
    <Bust pose="sad" still={still} loop="sway" />
    <Pop still={still} delay={500} at={{ right: 28, top: 26 }}><Animated.View style={s}><Bubble><Glyph name="uploadFail" /></Bubble></Animated.View></Pop>
  </>;
}

function Sync({ still }: { still: boolean }) {
  const spin = useCycle(still, 2400);
  const s = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get() * 360}deg` }] }));
  return <>
    <Animated.View style={[styles.syncRing, s]}>
      <View style={styles.syncArc} />
      <Image source={designAssets.compassStar} style={styles.syncStar} contentFit="contain" accessible={false} />
    </Animated.View>
    <Bust pose="bust" still={still} loop="breathe" />
  </>;
}

function Greet({ still }: { still: boolean }) {
  const rise = useOnce(still, 100, springs.gentle);
  const sun = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(rise.get(), [0, 1], [70, 0]) }] }));
  return <>
    <Animated.View style={[styles.sun, sun]}><View style={styles.sunCore} /></Animated.View>
    <View style={[styles.hill, { left: -60, bottom: -70, width: 260, backgroundColor: colors.mint }]} />
    <View style={[styles.hill, { right: -80, bottom: -90, width: 300, backgroundColor: "#BDEEDF" }]} />
    <Body source={designAssets.wolfiWave} still={still} style={{ left: 104, bottom: -10, width: 138, height: 176 }} />
  </>;
}

function Reminder({ still }: { still: boolean }) {
  const ring = useLoop(still, 1600, 500);
  const ripple = useCycle(still, 1600, 500, 2, 1);
  const bell = useAnimatedStyle(() => ({ transform: [{ rotate: `${Math.sin(ring.get() * Math.PI * 4) * 14 * (1 - ring.get() * 0.5)}deg` }] }));
  const wave = useAnimatedStyle(() => ({ opacity: 0.8 * (1 - ripple.get()), transform: [{ scale: 0.6 + 0.9 * ripple.get() }] }));
  return <>
    <Bust pose="surprised" still={still} />
    <Animated.View style={[styles.ripple, wave]} />
    <View style={{ position: "absolute", right: 34, top: 30 }}><Bubble size={70}><Animated.View style={[{ transformOrigin: "50% 10%" }, bell]}><Glyph name="bell" size={42} /></Animated.View></Bubble></View>
  </>;
}

function NotFound({ still }: { still: boolean }) {
  const sweep = useLoop(still, 2600, 300);
  const s = useAnimatedStyle(() => ({ transform: [{ translateX: -56 * sweep.get() }, { translateY: 6 * sweep.get() }] }));
  return <>
    <Body source={designAssets.wolfiMap} still={still} style={{ left: 44, bottom: 6, width: 212, height: 150 }} />
    <Animated.View style={[{ position: "absolute", left: 206, top: 126 }, s]}><Glyph name="search" size={44} tint={colors.ink} /></Animated.View>
    <Pop still={still} delay={700} at={{ right: 26, top: 22 }}><Bubble size={46}><Text style={styles.question}>?</Text></Bubble></Pop>
  </>;
}

function Polaroid({ still, delay, x, y, r, tone }: { still: boolean; delay: number; x: number; y: number; r: number; tone: string }) {
  const d = useOnce(still, delay, springs.snappy);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(d.get(), [0, 1], [-150, 0]) }, { rotate: `${r * d.get()}deg` }] }));
  return <Animated.View style={[styles.polaroid, { left: x, top: y }, a]}><View style={[styles.photo, { backgroundColor: tone }]} /></Animated.View>;
}

function NoMemories({ still }: { still: boolean }) {
  return <>
    <Polaroid still={still} delay={300} x={26} y={40} r={-12} tone={colors.tealSoft} />
    <Polaroid still={still} delay={450} x={214} y={30} r={10} tone={colors.mint} />
    <Polaroid still={still} delay={600} x={232} y={110} r={-6} tone={colors.butter} />
    <Bust pose="wink" still={still} />
  </>;
}

/** A point on the cubic Bézier p0..p3 at t, as a worklet so planes and routes can follow it. */
function bezier(t: number, p: readonly (readonly [number, number])[]) {
  "worklet";
  const u = 1 - t;
  const x = u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0];
  const y = u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1];
  return [x, y] as const;
}
const PLANE_PATH = [[150, 150], [190, 110], [210, 60], [276, 22]] as const;

function Plane({ still, delay }: { still: boolean; delay: number }) {
  const t = useCycle(still, 2200, delay, 3, 1);
  const a = useAnimatedStyle(() => {
    const [x, y] = bezier(t.get(), PLANE_PATH);
    return { opacity: still ? 1 : interpolate(t.get(), [0, 0.12, 0.85, 1], [0, 1, 1, 0]), transform: [{ translateX: x - 12 }, { translateY: y - 12 }] };
  });
  return <Animated.View style={[{ position: "absolute", left: 0, top: 0 }, a]}><Glyph name="locate" size={24} tint={colors.ink} /></Animated.View>;
}

function InviteSent({ still }: { still: boolean }) {
  return <>
    {Array.from({ length: 12 }, (_, i) => {
      const [x, y] = bezier((i + 1) / 13, PLANE_PATH);
      return <View key={i} style={[styles.trail, { left: x - 2, top: y - 2 }]} />;
    })}
    <Body source={designAssets.wolfiWave} still={still} style={{ left: 30, bottom: -10, width: 138, height: 176 }} />
    <Plane still={still} delay={300} />
    <Plane still={still} delay={1000} />
  </>;
}

function Avatar({ still, delay, x, y, letter, tone }: { still: boolean; delay: number; x: number; y: number; letter: string; tone: string }) {
  return <Pop still={still} delay={delay} at={{ left: x, top: y }}>
    <View style={[styles.avatar, { backgroundColor: tone }]}><Text style={styles.avatarText}>{letter}</Text>
      <View style={styles.avatarCheck}><Glyph name="check" size={14} tint={colors.pinGreen} /></View></View>
  </Pop>;
}

function GroupReady({ still }: { still: boolean }) {
  return <>
    <Avatar still={still} delay={400} x={24} y={34} letter="M" tone={colors.tealSoft} />
    <Avatar still={still} delay={600} x={22} y={118} letter="A" tone={colors.peach} />
    <Avatar still={still} delay={800} x={212} y={30} letter="T" tone={colors.butter} />
    <Avatar still={still} delay={1000} x={232} y={104} letter="H" tone={colors.lilac} />
    <Bust pose="happy" still={still} />
    <Star still={still} delay={1300} x={140} y={14} size={18} />
  </>;
}

function Dot({ still, delay }: { still: boolean; delay: number }) {
  const b = useLoop(still, 1200, delay);
  const a = useAnimatedStyle(() => ({ opacity: 0.4 + 0.6 * b.get(), transform: [{ translateY: -5 * b.get() }] }));
  return <Animated.View style={[styles.typingDot, a]} />;
}

function Waiting({ still }: { still: boolean }) {
  const spin = useCycle(still, 2400);
  const hand = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get() * 360}deg` }] }));
  return <>
    <Bust pose="bust" still={still} loop="breathe" />
    <View style={styles.clock}><Animated.View style={[styles.clockHandWrap, hand]}><View style={styles.clockHand} /></Animated.View><View style={styles.clockPin} /></View>
    <Pop still={still} delay={500} at={{ left: 24, top: 34 }}><View style={styles.typing}><Dot still={still} delay={0} /><Dot still={still} delay={150} /><Dot still={still} delay={300} /></View></Pop>
  </>;
}

function Twinkle({ still, x, y, size, delay }: { still: boolean; x: number; y: number; size: number; delay: number }) {
  const t = useLoop(still, 1800, delay);
  const a = useAnimatedStyle(() => ({ opacity: still ? 0.8 : 0.25 + 0.75 * t.get(), transform: [{ scale: 0.7 + 0.3 * t.get() }] }));
  return <Animated.View style={[{ position: "absolute", left: x, top: y, width: size, height: size }, a]}>
    <Image source={designAssets.compassStar} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} />
  </Animated.View>;
}

function Zed({ still, size, delay }: { still: boolean; size: number; delay: number }) {
  const z = useCycle(still, 2600, delay);
  const a = useAnimatedStyle(() => ({
    opacity: still ? (size === 18 ? 1 : 0) : interpolate(z.get(), [0, 0.2, 1], [0, 1, 0]),
    transform: [{ translateX: 26 * z.get() }, { translateY: -44 * z.get() }, { scale: 0.6 + 0.6 * z.get() }],
  }));
  return <Animated.Text style={[styles.zed, { fontSize: size }, a]}>Z</Animated.Text>;
}

function Quiet({ still }: { still: boolean }) {
  return <>
    <View style={styles.moon}><View style={styles.moonCut} /></View>
    <Twinkle still={still} x={110} y={30} size={10} delay={0} />
    <Twinkle still={still} x={250} y={50} size={12} delay={600} />
    <Twinkle still={still} x={220} y={20} size={8} delay={1200} />
    <Twinkle still={still} x={60} y={110} size={8} delay={900} />
    <Bust pose="sleep" still={still} loop="breathe" />
    <Zed still={still} size={18} delay={0} />
    <Zed still={still} size={14} delay={900} />
    <Zed still={still} size={22} delay={1800} />
  </>;
}

const ROUTE = [[28, 168], [70, 110], [150, 200], [262, 54]] as const;
function RouteDot({ still, i, n }: { still: boolean; i: number; n: number }) {
  const d = useOnce(still, 200 + i * 90, springs.snappy);
  const [x, y] = bezier(i / (n - 1), ROUTE);
  const a = useAnimatedStyle(() => ({ opacity: d.get(), transform: [{ scale: d.get() }] }));
  return <Animated.View style={[styles.routeDot, { left: x - 3, top: y - 3 }, a]} />;
}

function TripDone({ still }: { still: boolean }) {
  const n = 18;
  return <>
    {Array.from({ length: n }, (_, i) => <RouteDot key={i} still={still} i={i} n={n} />)}
    <Pop still={still} delay={200 + n * 90} at={{ left: 246, top: 20 }}><Glyph name="pin" size={34} /></Pop>
    <Body source={designAssets.wolfiMap} still={still} style={{ left: 40, bottom: 4, width: 182, height: 128 }} />
    <Star still={still} delay={2000} x={200} y={26} size={14} />
    <Star still={still} delay={2150} x={150} y={60} size={10} />
  </>;
}

const scenes: Record<WolfiSceneName, (still: boolean) => ReactNode> = {
  saveOk: (s) => <SaveOk still={s} />,
  saveFail: (s) => <SaveFail still={s} />,
  sync: (s) => <Sync still={s} />,
  greet: (s) => <Greet still={s} />,
  reminder: (s) => <Reminder still={s} />,
  notFound: (s) => <NotFound still={s} />,
  noMemories: (s) => <NoMemories still={s} />,
  inviteSent: (s) => <InviteSent still={s} />,
  groupReady: (s) => <GroupReady still={s} />,
  waiting: (s) => <Waiting still={s} />,
  quiet: (s) => <Quiet still={s} />,
  tripDone: (s) => <TripDone still={s} />,
};

const shadow = { boxShadow: "0 8px 20px -8px rgba(31,42,68,0.35)" } as const;
const styles = StyleSheet.create({
  panel: { alignSelf: "stretch", height: H, borderRadius: 26, overflow: "hidden", alignItems: "center" },
  stage: { width: W, height: H },
  bubble: { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", ...shadow },
  question: { fontFamily: fonts.heading, fontSize: 24, color: colors.teal },
  syncRing: { position: "absolute", left: 50, top: 18, width: 200, height: 200 },
  syncArc: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, borderRadius: 100, borderWidth: 5, borderColor: colors.gradientBlue, borderStyle: "dashed" },
  syncStar: { position: "absolute", left: 92, top: -8, width: 16, height: 16 },
  sun: { position: "absolute", left: 26, top: 34, width: 108, height: 108, borderRadius: 54, backgroundColor: "rgba(255,217,160,0.35)", alignItems: "center", justifyContent: "center" },
  sunCore: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#FFD9A0" },
  hill: { position: "absolute", height: 140, borderRadius: 150 },
  ripple: { position: "absolute", right: 34, top: 30, width: 70, height: 70, borderRadius: 35, borderWidth: 3, borderColor: colors.violet },
  polaroid: { position: "absolute", width: 54, height: 62, borderRadius: 6, backgroundColor: colors.surface, padding: 5, ...shadow },
  photo: { height: 40, borderRadius: 3 },
  trail: { position: "absolute", width: 4, height: 4, borderRadius: 2, backgroundColor: colors.gradientBlue },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.surface },
  avatarText: { fontFamily: fonts.heading, fontSize: 16, color: colors.ink },
  avatarCheck: { position: "absolute", right: -6, bottom: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  clock: { position: "absolute", right: 30, top: 28, width: 60, height: 60, borderRadius: 30, borderWidth: 4, borderColor: colors.ink, backgroundColor: colors.surface },
  clockHandWrap: { position: "absolute", left: 24, top: 4, width: 4, height: 44, alignItems: "center" },
  clockHand: { width: 4, height: 20, borderRadius: 2, backgroundColor: colors.amber },
  clockPin: { position: "absolute", left: 23, top: 23, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ink },
  typing: { flexDirection: "row", alignItems: "center", gap: 4, height: 38, paddingHorizontal: 12, borderRadius: 19, backgroundColor: colors.surface, ...shadow },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.muted },
  moon: { position: "absolute", left: 28, top: 24, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.butter, overflow: "hidden" },
  moonCut: { position: "absolute", left: 16, top: -8, width: 46, height: 46, borderRadius: 23, backgroundColor: NIGHT[0] },
  zed: { position: "absolute", left: 200, top: 40, fontFamily: fonts.heading, color: colors.tealSoft },
  routeDot: { position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: colors.route },
});
