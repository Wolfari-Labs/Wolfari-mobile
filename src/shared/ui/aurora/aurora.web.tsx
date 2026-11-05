import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import { LinearGradient } from "expo-linear-gradient";
import { Component, lazy, Suspense, useSyncExternalStore, type PropsWithChildren } from "react";
import { colors } from "@/shared/theme/tokens";
import type { AuroraProps } from "./aurora.types";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

function AuroraFallback({ width, height }: AuroraProps) {
  return <LinearGradient testID="aurora-fallback" colors={[colors.ocean, colors.lagoon]} style={{ width, height }} />;
}

const LazyCanvas = lazy(async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let wasmUrl: string | undefined;
  try {
    // Fetch/validate before entering Emscripten. Its built-in fetch failure can
    // reject a second internal promise outside React's error boundary.
    const response = await fetch("/canvaskit.wasm", { signal: controller.signal });
    if (!response.ok) throw new Error("CanvasKit is unavailable");
    const binary = await response.arrayBuffer();
    if (!WebAssembly.validate(binary)) throw new Error("CanvasKit is invalid");
    // This CanvasKit build exposes locateFile, not the optional instantiateWasm
    // override. A local blob prevents its loader from making a second network request.
    wasmUrl = URL.createObjectURL(new Blob([binary], { type: "application/wasm" }));
    await LoadSkiaWeb({ locateFile: () => wasmUrl! });
    return await import("./aurora-canvas");
  } catch {
    // Keep the fallback for this session; never repeatedly download failed WASM.
    return { default: AuroraFallback };
  } finally {
    clearTimeout(timeout);
    if (wasmUrl) URL.revokeObjectURL(wasmUrl);
  }
});

// Decorations must never block navigation if WASM/WebGL is unavailable or offline.
class CanvasBoundary extends Component<PropsWithChildren<{ fallback: React.ReactNode }>, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function Aurora(props: AuroraProps) {
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const fallback = <AuroraFallback {...props} />;
  return mounted ? (
    <CanvasBoundary fallback={fallback}>
      <Suspense fallback={fallback}><LazyCanvas {...props} /></Suspense>
    </CanvasBoundary>
  ) : fallback;
}
