import { Image } from "expo-image";

import { designIcons, type DesignIconName } from "./design-assets";

export function DesignIcon({
  name,
  size: customSize,
  tintColor,
}: {
  name: DesignIconName;
  size?: number;
  tintColor?: string;
}) {
  // Preserve the exported SVG's intrinsic geometry; field glyphs are 16.5px.
  const defaultSize = name === "mail" || name === "lock" || name === "edit" ? 16.5 : name === "plane" ? 16 : 22;
  const size = customSize ?? defaultSize;
  return (
    <Image
      source={designIcons[name]}
      style={{ width: size, height: size, ...(tintColor ? { tintColor } : {}) }}
      contentFit="contain"
      accessible={false}
    />
  );
}
