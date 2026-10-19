import { Text, View } from "react-native";

import { typography } from "@/shared/theme/tokens";
import { DesignIcon } from "@/shared/ui/design-icon";
import { ui } from "@/shared/ui/journal";

type MapPoint = { id: string; name: string; latitude: number; longitude: number };
export function TripMap({ points }: { points: MapPoint[]; onSelect: (id: string) => void }) {
  if (!points.length) return null;
  return <View style={ui.card}><DesignIcon name="map" size={32} /><Text style={typography.headline}>{points.length} điểm dừng đang chờ</Text><Text style={typography.footnote}>Mở Wolfari trong Expo Go để xem bản đồ tương tác. Trên trình duyệt, chọn địa điểm bên dưới để mở bản đồ.</Text></View>;
}
