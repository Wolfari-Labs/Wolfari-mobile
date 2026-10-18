import { Stack } from "expo-router";
import { AuthGate } from "@/features/auth/session/auth-gate";

export default function TripLayout() { return <AuthGate><Stack screenOptions={{ headerShown: false }} /></AuthGate>; }
