import { useState } from "react";
import { Text, View } from "react-native";

import { colors, typography } from "@/shared/theme/tokens";
import { Button } from "./button";

/**
 * Background explanation that stays out of the way: one short line that opens on demand
 * into a few short points. Keep errors and state the user must act on visible instead.
 */
export function Hint({ title, points }: { title: string; points: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 6, alignItems: "flex-start" }}>
      <Button
        compact
        variant="text"
        label={`ⓘ ${title}`}
        accessibilityLabel={`${open ? "Ẩn" : "Xem"} giải thích: ${title}`}
        onPress={() => setOpen(!open)}
      />
      {open && (
        <View style={{ gap: 6, paddingHorizontal: 12 }}>
          {points.map(point => (
            <View key={point} style={{ flexDirection: "row", gap: 8 }}>
              <Text style={[typography.footnote, { color: colors.tealPressed }]}>•</Text>
              <Text style={[typography.footnote, { flex: 1 }]}>{point}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
