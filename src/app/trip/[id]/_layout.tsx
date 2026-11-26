import { Stack, useLocalSearchParams } from "expo-router";
import { AuthGate } from "@/features/auth/session/auth-gate";

import { useSession } from "@/features/auth/session/session-provider";
import { PlaceSelectionProvider } from "@/features/trips/components/place-selection";

export default function TripLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  return <AuthGate><PlaceSelectionProvider key={`${profile?.id}:${id}`}><Stack screenOptions={{ headerShown: false }} /></PlaceSelectionProvider></AuthGate>;
}
