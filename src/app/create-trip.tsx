import CreateTripScreen from "@/features/trips/screens/create-trip-screen";
import { AuthGate } from "@/features/auth/session/auth-gate";

export default function CreateTripRoute() { return <AuthGate><CreateTripScreen /></AuthGate>; }
