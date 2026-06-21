import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/lib/auth";

/**
 * Launch dispatcher: wait for the persisted session check, then route to the
 * authed area or the login screen.
 */
export default function Index() {
  const { loading, authenticated } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={authenticated ? "/(app)" : "/login"} />;
}
