import { memo, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, type MapStyleElement } from "react-native-maps";

import { fitRegion } from "../model/place";
import { MAP_TONES, type MapPoint, type TripMapProps } from "./trip-map.types";

export type { MapPoint, MapRoute } from "./trip-map.types";

const paperStyle: MapStyleElement[] = [
  { elementType: "geometry", stylers: [{ color: "#F2EBDD" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#ADCCD1" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#D8E6CD" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#FFFAEB" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#61594C" }] },
];

/**
 * Custom marker views are bitmaps on the native map: each one re-renders only while
 * `tracksViewChanges` is on. Markers are memoised and stop tracking shortly after they
 * draw, so panning or typing never redraws dozens of pins. A selection change remounts
 * just that pin (its key changes) to draw the highlighted state.
 */
const Pin = memo(function Pin({ point, selected, onSelect }: { point: MapPoint; selected: boolean; onSelect: (id: string) => void }) {
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTracking(false), 500);
    return () => clearTimeout(timer);
  }, []);
  const tone = MAP_TONES[point.tone === "stop" && point.label === "1" ? "start" : point.tone ?? "saved"];
  return (
    <Marker
      identifier={point.id}
      coordinate={point}
      title={point.name}
      onPress={() => onSelect(point.id)}
      tracksViewChanges={tracking}
      zIndex={selected ? 10 : point.tone === "stop" ? 5 : 1}
    >
      <View style={[styles.pin, { backgroundColor: tone.fill }, selected && styles.pinSelected]}>
        <Text style={[styles.pinText, { color: tone.text }]}>{point.label ?? "•"}</Text>
      </View>
    </Marker>
  );
});

export function TripMap({ points, selectedId, onSelect, route, mapType = "standard", onUserMove, fitKey, height = 300 }: TripMapProps) {
  const map = useRef<MapView>(null);
  const framing = useRef(false);
  const latest = useRef({ points, route, onSelect });
  useEffect(() => {
    latest.current = { points, route, onSelect };
  });
  // One stable handler keeps the memoised pins from re-rendering on every parent render.
  const [select] = useState(() => (id: string) => latest.current.onSelect(id));
  useEffect(() => {
    const { points: current, route: line } = latest.current;
    const frame = [...current, ...(line?.geometry ?? [])];
    if (!frame.length) return;
    framing.current = true;
    map.current?.animateToRegion(fitRegion(frame), 350);
  }, [fitKey]);
  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={map}
        mapType={mapType === "paper" ? (Platform.OS === "ios" ? "mutedStandard" : "standard") : mapType}
        customMapStyle={mapType === "paper" && Platform.OS === "android" ? paperStyle : undefined}
        style={StyleSheet.absoluteFill}
        initialRegion={fitRegion([...points, ...(route?.geometry ?? [])])}
        accessibilityLabel="Bản đồ các địa điểm của hành trình"
        toolbarEnabled={false}
        showsPointsOfInterests={false}
        onRegionChangeComplete={(region, details) => {
          // Ignore the move caused by fitting the map ourselves.
          if (framing.current || details?.isGesture === false) {
            framing.current = false;
            return;
          }
          onUserMove?.(region);
        }}
      >
        {route && route.geometry.length > 1 && (
          <Polyline
            coordinates={route.geometry}
            strokeWidth={5}
            strokeColor={route.estimated ? "#5B8CFF" : "#245CB8"}
            lineDashPattern={route.estimated ? [10, 8] : undefined}
            lineCap="round"
            lineJoin="round"
          />
        )}
        {points.map((point) => {
          const selected = point.id === selectedId;
          return <Pin key={selected ? `${point.id}:selected` : point.id} point={point} selected={selected} onSelect={select} />;
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: "hidden", backgroundColor: "#E5F3FA" },
  pin: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
  },
  pinSelected: { transform: [{ scale: 1.25 }], borderColor: "#F6C445" },
  pinText: { fontSize: 12, fontWeight: "800" },
});
