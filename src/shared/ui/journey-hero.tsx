import type { ReactNode } from "react";
import { View } from "react-native";
import { PageIntro } from "./page-intro";

/** Shared opening color field; photo cards supply the next visual layer. */
export function JourneyHero({ eyebrow, title, subtitle, children, compact = false }: {
  eyebrow: string; title: string; subtitle: string; children?: ReactNode; compact?: boolean;
}) {
  return (
    <View testID="journey-hero">
      <PageIntro eyebrow={eyebrow} title={title} subtitle={subtitle} icon={compact ? "trip" : "compass"} summary={children} />
    </View>
  );
}
