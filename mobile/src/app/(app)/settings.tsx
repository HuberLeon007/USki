import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { getTwoFactor, SessionExpiredError, setTwoFactor } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PRIMARY, useColors } from "@/lib/ui";

/** Account + security settings, mirroring the web Settings page (mobile subset). */
export default function SettingsScreen() {
  const c = useColors();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [twoFa, setTwoFa] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getTwoFactor()
      .then((r) => setTwoFa(r.enabled))
      .catch(() => setTwoFa(false));
  }, []);

  async function toggleTwoFa(next: boolean) {
    setTwoFa(next);
    setSaving(true);
    try {
      const r = await setTwoFactor(next);
      setTwoFa(r.enabled);
    } catch (err) {
      setTwoFa(!next);
      if (err instanceof SessionExpiredError) await signOut();
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.content}>
      <View style={[styles.section, { backgroundColor: c.backgroundElement }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Account</Text>
        <Row label="Username" value={user?.username ? `@${user.username}#${user.discriminator ?? ""}` : "Not set"} c={c} />
        <Row label="Email" value={user?.email ?? "-"} c={c} />
      </View>

      <View style={[styles.section, { backgroundColor: c.backgroundElement }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Security</Text>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={[styles.label, { color: c.text }]}>Email two-factor</Text>
            <Text style={[styles.value, { color: c.textSecondary }]}>
              {twoFa === null ? "Loading..." : twoFa ? "On - a code is emailed at sign-in." : "Off - one-step sign-in."}
            </Text>
          </View>
          {twoFa === null ? (
            <ActivityIndicator />
          ) : (
            <Switch value={twoFa} onValueChange={toggleTwoFa} disabled={saving} trackColor={{ true: PRIMARY }} />
          )}
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: c.backgroundElement }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Appearance</Text>
        <Text style={[styles.value, { color: c.textSecondary }]}>
          Follows your device light / dark setting.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={logout}
        style={({ pressed }) => [styles.logout, { borderColor: c.backgroundSelected, opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value, c }: { label: string; value: string; c: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: c.text }]} selectable numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  section: { borderRadius: 16, padding: 16, gap: 12, borderCurve: "continuous" },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  rowValue: { fontSize: 14, fontWeight: "500", flexShrink: 1, textAlign: "right" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  switchText: { flex: 1, gap: 2 },
  label: { fontSize: 14, fontWeight: "500" },
  value: { fontSize: 13, lineHeight: 18 },
  logout: { height: 50, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  logoutText: { color: "#ef4444", fontSize: 15, fontWeight: "600" },
});
