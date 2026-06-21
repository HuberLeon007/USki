import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { getServerUrl, pingServer, setServerUrl } from "@/lib/api";
import { PRIMARY, STATE_COLORS, useColors } from "@/lib/ui";

/**
 * Lets the user point the app at their backend (PC LAN IP) and verify it's
 * reachable. Needed so a built APK works on the same WiFi even when the PC's IP
 * changes - no rebuild required.
 */
export function ServerSettings({ onSaved }: { onSaved?: () => void }) {
  const c = useColors();
  const [url, setUrl] = useState(getServerUrl());
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "fail">("idle");

  async function test() {
    setTesting(true);
    setStatus("idle");
    const ok = await pingServer(url);
    setStatus(ok ? "ok" : "fail");
    setTesting(false);
  }

  async function save() {
    await setServerUrl(url);
    setUrl(getServerUrl());
    onSaved?.();
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: c.textSecondary }]}>Backend address</Text>
      <TextInput
        style={[styles.input, { color: c.text, backgroundColor: c.backgroundElement, borderColor: c.backgroundSelected }]}
        value={url}
        onChangeText={(t) => { setUrl(t); setStatus("idle"); }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="http://192.168.1.42:8000"
        placeholderTextColor={c.textSecondary}
      />
      <View style={styles.row}>
        <Pressable
          onPress={test}
          disabled={testing}
          style={({ pressed }) => [styles.testBtn, { borderColor: c.backgroundSelected, opacity: testing ? 0.6 : pressed ? 0.7 : 1 }]}
        >
          {testing ? <ActivityIndicator color={c.text} /> : <Text style={[styles.testText, { color: c.text }]}>Test</Text>}
        </Pressable>
        <Pressable
          onPress={save}
          style={({ pressed }) => [styles.saveBtn, { backgroundColor: PRIMARY, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      </View>
      {status !== "idle" ? (
        <Text style={{ fontSize: 13, color: status === "ok" ? STATE_COLORS.done : STATE_COLORS.due }}>
          {status === "ok" ? "Connected - backend is reachable." : "Could not reach the backend. Check the IP and that you're on the same WiFi."}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 13, fontWeight: "600" },
  input: { height: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 15, borderCurve: "continuous" },
  row: { flexDirection: "row", gap: 8 },
  testBtn: { flex: 1, height: 44, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  testText: { fontSize: 14, fontWeight: "600" },
  saveBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  saveText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
