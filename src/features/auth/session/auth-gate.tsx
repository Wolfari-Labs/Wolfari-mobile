import { Redirect } from "expo-router";
import type { PropsWithChildren } from "react";

import { Screen } from "@/shared/ui/screen";
import { Button } from "@/shared/ui/button";
import { ResourceFeedback } from "@/shared/ui/journal";
import { useSession } from "./session-provider";

export function AuthGate({ children }: PropsWithChildren) {
  const { status, error, restore, signOut } = useSession();
  if (status === "guest") return <Redirect href="/sign-in" />;
  if (status !== "authenticated") return <Screen title="Wolfari"><ResourceFeedback loading={status === "loading"} error={error ?? undefined} hasData={false} onRetry={() => { void restore(); }} />{status === "unavailable" && <Button label="Đăng nhập lại" variant="soft" onPress={() => { void signOut(); }} />}</Screen>;
  return children;
}
