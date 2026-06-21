import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/lib/auth";

/**
 * Guard for the signed-in area: anything under (app) requires a session. While
 * the launch check runs we show a spinner; if unauthenticated we bounce to login.
 */
export default function AppLayout() {
  const { loading, authenticated } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!authenticated) return <Redirect href="/login" />;

  return (
    <Stack screenOptions={{ headerLargeTitle: true }}>
      <Stack.Screen name="index" options={{ title: "Your decks" }} />
    </Stack>
  );
}
