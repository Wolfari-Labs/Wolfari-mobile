import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { StyleSheet, View, type ViewInstance } from "react-native";

import { fitRegion, type MapRegion } from "../model/place";
import { MAP_TONES, type TripMapProps } from "./trip-map.types";

export type { MapPoint, MapRoute } from "./trip-map.types";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

function pinHtml(label: string, fill: string, text: string, size: number, selected: boolean) {
  const style = [
    `min-width:${size}px`, `height:${size}px`, "padding:0 6px", "box-sizing:border-box",
    `border-radius:${size / 2}px`, "display:flex", "align-items:center", "justify-content:center",
    `background:${fill}`, `color:${text}`, `border:2px solid ${selected ? "#F6C445" : "#FFFFFF"}`,
    "box-shadow:0 2px 6px rgba(0,0,0,.3)", "font:800 12px/1 system-ui,sans-serif",
  ].join(";");
  return `<div style="${style}">${escapeHtml(label)}</div>`;
}

/** Browser map: Leaflet + OpenStreetMap tiles, with the same props as the native map. */
export function TripMap({ points, selectedId, onSelect, route, onUserMove, fitKey, height = 300 }: TripMapProps) {
  const host = useRef<ViewInstance>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const framing = useRef(false);
  // Until the user pans, keep the frame on the points (also after late size changes).
  const userMoved = useRef(false);
  const handlers = useRef({ onSelect, onUserMove });
  const latest = useRef({ points, route });
  useEffect(() => {
    handlers.current = { onSelect, onUserMove };
    latest.current = { points, route };
  });

  /** Run map changes made by the app itself; their move events are not the user's. */
  const quietly = useRef((change: () => void) => {
    framing.current = true;
    try {
      change();
    } finally {
      // Non-animated Leaflet changes fire their events synchronously.
      setTimeout(() => {
        framing.current = false;
      }, 0);
    }
  });
  /** Frame the current points (and route) in the map's present size. */
  const frame = useRef(() => {
    const instance = map.current;
    const { points: current, route: line } = latest.current;
    const coords = [...current, ...(line?.geometry ?? [])];
    const size = instance?.getSize();
    if (!instance || !coords.length || !size?.x || !size.y) return;
    quietly.current(() => {
      if (coords.length === 1) instance.setView([coords[0].latitude, coords[0].longitude], 15, { animate: false });
      else instance.fitBounds(L.latLngBounds(coords.map((p) => [p.latitude, p.longitude] as [number, number])), { padding: [28, 28], maxZoom: 16, animate: false });
    });
  });

  useEffect(() => {
    const element = host.current as unknown as HTMLElement | null;
    if (!element) return;
    const start = fitRegion([]);
    const instance = L.map(element, { zoomControl: true, attributionControl: true }).setView([start.latitude, start.longitude], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(instance);
    layer.current = L.layerGroup().addTo(instance);
    instance.on("moveend", () => {
      if (framing.current) return;
      userMoved.current = true;
      const bounds = instance.getBounds(),
        center = bounds.getCenter();
      const region: MapRegion = {
        latitude: center.lat,
        longitude: center.lng,
        latitudeDelta: bounds.getNorth() - bounds.getSouth(),
        longitudeDelta: bounds.getEast() - bounds.getWest(),
      };
      handlers.current.onUserMove?.(region);
    });
    map.current = instance;
    // Leaflet measures its box once; re-measure whenever the layout changes it.
    const refresh = () => {
      quietly.current(() => instance.invalidateSize({ animate: false }));
      if (!userMoved.current) frame.current();
    };
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(refresh);
    observer?.observe(element);
    const resize = setTimeout(refresh, 50);
    return () => {
      clearTimeout(resize);
      observer?.disconnect();
      instance.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  useEffect(() => {
    const group = layer.current;
    if (!group) return;
    group.clearLayers();
    if (route && route.geometry.length > 1) {
      L.polyline(route.geometry.map((p) => [p.latitude, p.longitude] as [number, number]), {
        color: "#245CB8",
        weight: 4,
        opacity: 0.9,
        dashArray: route.estimated ? "10 8" : undefined,
      }).addTo(group);
    }
    for (const point of points) {
      const tone = MAP_TONES[point.tone ?? "saved"],
        selected = point.id === selectedId,
        size = selected ? 34 : 28;
      L.marker([point.latitude, point.longitude], {
        title: point.name,
        alt: point.name,
        keyboard: true,
        zIndexOffset: selected ? 1000 : 0,
        icon: L.divIcon({ html: pinHtml(point.label ?? "•", tone.fill, tone.text, size, selected), className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] }),
      })
        .on("click", () => handlers.current.onSelect(point.id))
        .addTo(group);
    }
  }, [points, route, selectedId]);

  useEffect(() => {
    userMoved.current = false;
    frame.current();
  }, [fitKey]);

  return <View ref={host} style={[styles.container, { height }]} accessibilityLabel="Bản đồ các địa điểm của hành trình" />;
}

const styles = StyleSheet.create({
  container: { overflow: "hidden", borderRadius: 24, backgroundColor: "#E5F3FA", zIndex: 0 },
});
