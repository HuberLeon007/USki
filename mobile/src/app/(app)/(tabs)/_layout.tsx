import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs, useRouter } from "expo-router";
import { Pressable } from "react-native";

import { PRIMARY, useColors } from "@/lib/ui";

/**
 * Bottom tab bar mirroring the web sidebar: Overview, Decks, Browse, Shared.
 * A gear in the header opens Settings (pushed over the tabs).
 */
export default function TabsLayout() {
  const c = useColors();
  const router = useRouter();

  const SettingsButton = () => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open settings"
      hitSlop={12}
      onPress={() => router.push("/settings")}
      style={{ paddingHorizontal: 8 }}
    >
      <Ionicons name="settings-outline" size={22} color={c.text} />
    </Pressable>
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: c.textSecondary,
        headerRight: () => <SettingsButton />,
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Overview",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="decks"
        options={{
          title: "Decks",
          tabBarIcon: ({ color, size }) => <Ionicons name="layers-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: "Browse",
          tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shared"
        options={{
          title: "Shared",
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sero"
        options={{
          title: "Sero",
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
