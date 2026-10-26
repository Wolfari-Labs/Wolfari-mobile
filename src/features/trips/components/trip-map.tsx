import { StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

export type MapPoint = { id: string; name: string; latitude: number; longitude: number };
export function TripMap({ points, onSelect, mapType = "standard" }: { points: MapPoint[]; onSelect: (id: string) => void; mapType?: "standard" | "satellite" }) {
  if (!points.length) return null;
  const latitudes = points.map(p => p.latitude), longitudes = points.map(p => p.longitude);
  const minLat = Math.min(...latitudes), maxLat = Math.max(...latitudes), minLon = Math.min(...longitudes), maxLon = Math.max(...longitudes);
  return <View style={styles.container}><MapView mapType={mapType} key={points.map(p => p.id).join(",")} style={StyleSheet.absoluteFill} initialRegion={{ latitude: (minLat + maxLat) / 2, longitude: (minLon + maxLon) / 2, latitudeDelta: Math.max(0.035, (maxLat - minLat) * 1.5), longitudeDelta: Math.max(0.035, (maxLon - minLon) * 1.5) }} accessibilityLabel="Bản đồ các địa điểm của hành trình">{points.map(point => <Marker key={point.id} identifier={point.id} coordinate={point} title={point.name} onPress={() => onSelect(point.id)} />)}</MapView></View>;
}
const styles = StyleSheet.create({ container: { height: 320, overflow: "hidden", borderRadius: 24 } });
