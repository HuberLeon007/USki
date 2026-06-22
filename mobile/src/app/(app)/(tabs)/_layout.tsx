import { Tabs, useRouter } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

import { Icon } from "@/components/icon";
import { PRIMARY, useColors } from "@/lib/ui";

/**
 * Bottom tab bar mirroring the web sidebar order: Overview, Decks, Browse,
 * Shared, Profile. Notifications live as a bell in the top-right header (the
 * gear is gone — Settings is reached from the Profile tab). Sero stays a route
 * but is not a tab; it's opened from Profile / the assistant entry.
 */
export default function TabsLayout() {
  const c = useColors();
  const router = useRouter();

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
        // Notifications bell moved to the top-right; no gear here anymore.
        headerRight: () => <BellButton />,
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
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Icon name="user" size={size} color={color} />,
        }}
      />
      {/* Sero stays a navigable route but is not shown as a tab (opened from Profile). */}
      <Tabs.Screen name="sero" options={{ href: null, title: "Sero" }} />
    </Tabs>
  );
}
