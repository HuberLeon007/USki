import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/lib/auth";

/**
 * Guard for the signed-in area: anything under (app) requires a session. While
 * the launch check runs we show a spinner; if unauthenticated we bounce to
 * login. The tabs live in the (tabs) group; settings and deck detail are pushed
 * on top of the tab bar as regular stack screens.
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
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: "Settings", presentation: "modal" }} />
      <Stack.Screen name="deck/[id]" options={{ title: "Deck" }} />
      <Stack.Screen name="study/[id]" options={{ title: "Study", presentation: "fullScreenModal" }} />
    </Stack>
  );
}
