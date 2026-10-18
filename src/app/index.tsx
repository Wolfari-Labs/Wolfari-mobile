import { Redirect } from "expo-router";
import GuestScreen from "@/features/discovery/screens/guest-screen";
import { useSession } from "@/features/auth/session/session-provider";

export default function IndexRoute() {
  const { status } = useSession();
  return status === "authenticated" ? <Redirect href="/(tabs)" /> : <GuestScreen />;
}
