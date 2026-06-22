import { Tabs, useRouter } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

import { Icon } from "@/components/icon";
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
      <Icon name="settings" size={22} color={c.text} />
    </Pressable>
  );

  const BellButton = () => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Notifications"
      hitSlop={12}
      onPress={() => router.push("/notifications")}
      style={{ paddingHorizontal: 12 }}
    >
      <Icon name="bell" size={22} color={c.text} />
    </Pressable>
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: c.textSecondary,
        headerLeft: () => <BellButton />,
        headerRight: () => <SettingsButton />,
        sceneStyle: { backgroundColor: c.background },
        // Themed header to match the web dark surface.
        headerStyle: { backgroundColor: c.background },
        headerShadowVisible: false,
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: "700" },
        // Cleaner, branded tab bar (the default felt bare).
        tabBarStyle: {
          backgroundColor: c.background,
          borderTopColor: c.backgroundSelected,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 64,
          paddingTop: 6,
          paddingBottom: 10,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarItemStyle: { paddingTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Overview",
          tabBarIcon: ({ color, size }) => <Icon name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="decks"
        options={{
          title: "Decks",
          tabBarIcon: ({ color, size }) => <Icon name="layers" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: "Browse",
          tabBarIcon: ({ color, size }) => <Icon name="search" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shared"
        options={{
          title: "Shared",
          tabBarIcon: ({ color, size }) => <Icon name="users" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sero"
        options={{
          title: "Sero",
          tabBarIcon: ({ color, size }) => <Icon name="sparkles" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
