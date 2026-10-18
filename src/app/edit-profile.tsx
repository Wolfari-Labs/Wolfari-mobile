import EditProfileScreen from "@/features/auth/screens/edit-profile-screen";
import { AuthGate } from "@/features/auth/session/auth-gate";
export default function EditProfileRoute() { return <AuthGate><EditProfileScreen /></AuthGate>; }
