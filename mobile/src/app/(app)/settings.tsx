import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { changeUsername, getTwoFactor, SessionExpiredError, setTwoFactor } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ServerSettings } from "@/components/server-settings";
import { PRIMARY, useColors } from "@/lib/ui";

function isValidUsername(v: string) {
  return v.length >= 3 && v.length <= 20 && /^[a-z0-9]+$/.test(v);
}

/** Account + security settings, mirroring the web Settings page (mobile subset). */
export default function SettingsScreen() {
  const c = useColors();
  const router = useRouter();
  const { user, signOut, refresh } = useAuth();

  const [twoFa, setTwoFa] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState(user?.username ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);

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

  async function saveUsername() {
    const v = username.trim().toLowerCase();
    if (!isValidUsername(v)) {
      setNameMsg("3-20 lowercase letters or numbers.");
      return;
    }
    if (v === user?.username) return;
    setSavingName(true);
    setNameMsg(null);
    try {
      await changeUsername(v);
      await refresh();
      setNameMsg("Username updated.");
    } catch (err) {
      if (err instanceof SessionExpiredError) await signOut();
      else setNameMsg("That username is taken or invalid.");
    } finally {
      setSavingName(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.content}>
      <View style={[styles.section, { backgroundColor: c.backgroundElement }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Account</Text>
        <Text style={[styles.label, { color: c.textSecondary }]}>Username</Text>
        <View style={styles.nameRow}>
          <TextInput
            style={[styles.nameInput, { color: c.text, backgroundColor: c.background, borderColor: c.backgroundSelected }]}
            value={username}
            onChangeText={(t) => { setUsername(t.toLowerCase().replace(/[^a-z0-9]/g, "")); setNameMsg(null); }}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
          />
          <Pressable
            onPress={saveUsername}
            disabled={savingName}
            style={({ pressed }) => [styles.saveBtn, { backgroundColor: PRIMARY, opacity: savingName ? 0.5 : pressed ? 0.85 : 1 }]}
          >
            {savingName ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
          </Pressable>
        </View>
        {nameMsg ? <Text style={[styles.value, { color: c.textSecondary }]}>{nameMsg}</Text> : null}
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

      <View style={[styles.section, { backgroundColor: c.backgroundElement }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Server</Text>
        <Text style={[styles.value, { color: c.textSecondary }]}>
          Point the app at your backend (PC's LAN IP) when testing on the same WiFi.
        </Text>
        <ServerSettings />
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
  nameRow: { flexDirection: "row", gap: 8 },
  nameInput: { flex: 1, height: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 16, borderCurve: "continuous" },
  saveBtn: { paddingHorizontal: 18, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  saveText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  value: { fontSize: 13, lineHeight: 18 },
  logout: { height: 50, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  logoutText: { color: "#ef4444", fontSize: 15, fontWeight: "600" },
});
