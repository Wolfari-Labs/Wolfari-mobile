import { useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { accountToken } from "./account-validation";

// Opening an email link only prepares the form. A user must confirm explicitly.
// Keep the one-time token in component memory instead of navigation history.
export function useAccountLink() {
  const navigation = useNavigation<{ setParams: (params: { token: undefined }) => void }>();
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const incoming = typeof token === "string" ? accountToken(token) ?? "" : "";
  const [state, setState] = useState({ source: token, input: incoming });
  if (token && token !== state.source) setState({ source: token, input: incoming });
  useEffect(() => {
    if (!token) return;
    navigation.setParams({ token: undefined });
  }, [navigation, token]);
  return [state.input, (input: string) => setState(current => ({ ...current, input }))] as const;
}
