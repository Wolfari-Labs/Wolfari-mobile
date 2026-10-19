import SessionsScreen from "@/features/auth/screens/sessions-screen";
import { AuthGate } from "@/features/auth/session/auth-gate";
export default function SessionsRoute() { return <AuthGate><SessionsScreen /></AuthGate>; }
