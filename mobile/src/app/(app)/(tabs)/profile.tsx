import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import { useAuth } from "@/lib/auth";
import { PRIMARY, STATE_COLORS, useColors } from "@/lib/ui";

/**
 * Profile tab (rightmost) — the account hub. Mirrors the web's account/profile
 * entry point: shows who you are and links to Sero, Settings and Notifications.
 * Settings lives here now that the header gear is gone.
 */
export default function ProfileScreen() {
  const c = useColors();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const hasUsername = Boolean(user?.username);
  const handle = hasUsername ? `${user!.username}#${user!.discriminator}` : "Set up your handle";
  const initial = hasUsername ? user!.username!.charAt(0).toUpperCase() : "?";

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.content}>
      {/* Identity card */}
      <View style={[styles.card, { backgroundColor: c.backgroundElement, borderColor: c.backgroundSelected }]}>
        <View style={[styles.avatar, { backgroundColor: PRIMARY }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.handle, { color: c.text }]} numberOfLines={1}>{handle}</Text>
          {user?.email ? (
            <Text style={[styles.email, { color: c.textSecondary }]} numberOfLines={1}>{user.email}</Text>
          ) : null}
        </View>
      </View>

      {/* Hub rows */}
      <View style={styles.group}>
        <Row c={c} icon="sparkles" label="Sero assistant" hint="Ask about your cards" onPress={() => router.push("/sero")} />
        <Row c={c} icon="bell" label="Notifications" onPress={() => router.push("/notifications")} />
        <Row c={c} icon="settings" label="Settings" hint="Account, security, appearance" onPress={() => router.push("/settings")} />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => { void signOut(); }}
        style={({ pressed }) => [styles.logout, { borderColor: c.backgroundSelected, opacity: pressed ? 0.7 : 1 }]}
      >
        <Icon name="leave" size={18} color={STATE_COLORS.due} />
        <Text style={[styles.logoutText, { color: STATE_COLORS.due }]}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({
  c, icon, label, hint, onPress,
}: {
  c: ReturnType<typeof useColors>;
  icon: IconName;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: c.backgroundElement, borderColor: c.backgroundSelected, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: c.backgroundSelected }]}>
        <Icon name={icon} size={20} color={c.text} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowLabel, { color: c.text }]}>{label}</Text>
        {hint ? <Text style={[styles.rowHint, { color: c.textSecondary }]} numberOfLines={1}>{hint}</Text> : null}
      </View>
      <Icon name="chevron" size={20} color={c.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    borderCurve: "continuous",
  },
  avatar: { height: 52, width: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 22, fontWeight: "700" },
  handle: { fontSize: 17, fontWeight: "700" },
  email: { marginTop: 2, fontSize: 13 },
  group: { gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    borderCurve: "continuous",
  },
  rowIcon: { height: 38, width: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  rowLabel: { fontSize: 15, fontWeight: "600" },
  rowHint: { marginTop: 2, fontSize: 12 },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    borderCurve: "continuous",
  },
  logoutText: { fontSize: 15, fontWeight: "700" },
});
