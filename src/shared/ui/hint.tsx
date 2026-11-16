import { useState, type ReactNode } from "react";
import { View } from "react-native";

import { Button } from "./button";
import { Notice } from "./journal";

/**
 * Background explanation that stays out of the way: one short line that opens on demand.
 * Use for "how this works" text; keep errors and state the user must act on in a Notice.
 */
export function Hint({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 8, alignItems: "flex-start" }}>
      <Button
        compact
        variant="text"
        label={`${open ? "Ẩn" : "ⓘ"} ${title}`}
        accessibilityLabel={`${open ? "Ẩn" : "Xem"} giải thích: ${title}`}
        onPress={() => setOpen(!open)}
      />
      {open && <Notice>{children}</Notice>}
    </View>
  );
}
