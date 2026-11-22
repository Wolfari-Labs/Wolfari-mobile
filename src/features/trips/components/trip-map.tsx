import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import { fitRegion } from "../model/place";
import { MAP_TONES, type TripMapProps } from "./trip-map.types";

export type { MapPoint, MapRoute } from "./trip-map.types";

export function TripMap({ points, selectedId, onSelect, route, mapType = "standard", onUserMove, fitKey, height = 300 }: TripMapProps) {
  const map = useRef<MapView>(null);
  const framing = useRef(false);
  const latest = useRef({ points, route });
  useEffect(() => {
    latest.current = { points, route };
  });
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
        mapType={mapType}
        style={StyleSheet.absoluteFill}
        initialRegion={fitRegion([...points, ...(route?.geometry ?? [])])}
        accessibilityLabel="Bản đồ các địa điểm của hành trình"
        toolbarEnabled={false}
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
            strokeWidth={4}
            strokeColor="#245CB8"
            lineDashPattern={route.estimated ? [10, 8] : undefined}
          />
        )}
        {points.map((point) => {
          const tone = MAP_TONES[point.tone ?? "saved"],
            selected = point.id === selectedId;
          return (
            <Marker
              key={point.id}
              identifier={point.id}
              coordinate={point}
              title={point.name}
              onPress={() => onSelect(point.id)}
              tracksViewChanges={selected}
            >
              <View style={[styles.pin, { backgroundColor: tone.fill }, selected && styles.pinSelected]}>
                <Text style={[styles.pinText, { color: tone.text }]}>{point.label ?? "•"}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: "hidden", borderRadius: 24, backgroundColor: "#E5F3FA" },
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
