import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  changeUsername,
  disableTotp,
  getTotpStatus,
  listSessions,
  revokeSessionById,
  SessionExpiredError,
  setupTotp,
  verifyTotp,
  type SessionInfo,
  type TotpSetup,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ServerSettings } from "@/components/server-settings";
import { Icon } from "@/components/icon";
import { PRIMARY, useColors } from "@/lib/ui";

const SUPPORT_EMAIL = "support@uski.app";

function isValidUsername(v: string) {
  return v.length >= 3 && v.length <= 20 && /^[a-z0-9]+$/.test(v);
}

/** Account, security, support and privacy settings — mobile parity with web. */
export default function SettingsScreen() {
  const c = useColors();
  const router = useRouter();
  const { user, signOut, refresh } = useAuth();

  const [username, setUsername] = useState(user?.username ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);

  async function logout() {
    await signOut();
    router.replace("/welcome");
  }

  async function saveUsername() {
    const v = username.trim().toLowerCase();
    if (!isValidUsername(v)) { setNameMsg("3-20 lowercase letters or numbers."); return; }
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
      <Section title="Account" c={c}>
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
      </Section>

      <Section title="Security" c={c}>
        <TotpPanel c={c} onExpired={logout} />
        <View style={[styles.divider, { backgroundColor: c.backgroundSelected }]} />
        <Text style={[styles.label, { color: c.text }]}>Passkeys</Text>
        <Text style={[styles.value, { color: c.textSecondary }]}>
          Add or remove passkeys from the web app at uski. They sign you in here without a code.
        </Text>
        <View style={[styles.divider, { backgroundColor: c.backgroundSelected }]} />
        <SessionsPanel c={c} onExpired={logout} />
      </Section>

      <Section title="Appearance" c={c}>
        <Text style={[styles.value, { color: c.textSecondary }]}>Follows your device light / dark setting.</Text>
      </Section>

      <Section title="Assistant" c={c}>
        <Text style={[styles.value, { color: c.textSecondary }]}>
          Sero is your built-in study tutor. Open it from the Sero tab, or tap Sero while studying a card to ask about it.
        </Text>
      </Section>

      <Section title="Support" c={c}>
        <LinkRow label="Help & FAQ" onPress={() => Linking.openURL("https://uski.app/help")} c={c} />
        <LinkRow label="Contact support" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} c={c} />
      </Section>

      <Section title="Privacy" c={c}>
        <Text style={[styles.value, { color: c.textSecondary }]}>
          We store your decks, cards and account email to run the app. Your data is yours.
        </Text>
        <LinkRow label="Privacy policy" onPress={() => Linking.openURL("https://uski.app/privacy")} c={c} />
        <LinkRow label="Export my data" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Data%20export%20request`)} c={c} />
        <LinkRow
          label="Delete my account"
          danger
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Account%20deletion%20request`)}
          c={c}
        />
      </Section>

      <Section title="Server" c={c}>
        <Text style={[styles.value, { color: c.textSecondary }]}>
          Point the app at your backend (PC's LAN IP) when testing on the same WiFi.
        </Text>
        <ServerSettings />
      </Section>

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

type C = ReturnType<typeof useColors>;

/** App-based TOTP: enroll by opening the otpauth link in an authenticator app
 *  (or copying the key), confirm with a code, and disable with a code. */
function TotpPanel({ c, onExpired }: { c: C; onExpired: () => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [code, setCode] = useState("");
  const [disarm, setDisarm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTotpStatus().then((s) => setEnabled(s.enabled)).catch((e) => {
      if (e instanceof SessionExpiredError) onExpired();
      else setEnabled(false);
    });
  }, [onExpired]);

  const begin = useCallback(async () => {
    setBusy(true); setError(null);
    try { setSetup(await setupTotp()); }
    catch (e) { if (e instanceof SessionExpiredError) onExpired(); else setError("Could not start setup."); }
    finally { setBusy(false); }
  }, [onExpired]);

  const confirm = useCallback(async () => {
    if (code.length !== 6 || busy) return;
    setBusy(true); setError(null);
    try { const s = await verifyTotp(code); setEnabled(s.enabled); setSetup(null); setCode(""); }
    catch (e) { if (e instanceof SessionExpiredError) onExpired(); else setError("That code didn't match."); }
    finally { setBusy(false); }
  }, [code, busy, onExpired]);

  const turnOff = useCallback(async () => {
    if (code.length !== 6 || busy) return;
    setBusy(true); setError(null);
    try { const s = await disableTotp(code); setEnabled(s.enabled); setDisarm(false); setCode(""); }
    catch (e) { if (e instanceof SessionExpiredError) onExpired(); else setError("That code didn't match."); }
    finally { setBusy(false); }
  }, [code, busy, onExpired]);

  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.label, { color: c.text }]}>Two-factor authentication</Text>
      {enabled === null ? (
        <ActivityIndicator color={c.textSecondary} />
      ) : enabled ? (
        <View style={{ gap: 8 }}>
          <Text style={[styles.value, { color: c.textSecondary }]}>On - a code from your authenticator app is required at sign-in.</Text>
          {!disarm ? (
            <SmallButton label="Turn off" onPress={() => { setError(null); setDisarm(true); }} c={c} outline />
          ) : (
            <CodeConfirm c={c} code={code} setCode={setCode} busy={busy} onSubmit={turnOff} label="Turn off 2FA" danger
              onCancel={() => { setDisarm(false); setCode(""); setError(null); }} />
          )}
        </View>
      ) : setup ? (
        <View style={{ gap: 10 }}>
          <Text style={[styles.value, { color: c.textSecondary }]}>1. Add USki to your authenticator app:</Text>
          <SmallButton label="Open in authenticator app" onPress={() => Linking.openURL(setup.otpauth_uri)} c={c} />
          <Text style={[styles.value, { color: c.textSecondary }]}>Or enter this key manually:</Text>
          <Text selectable style={[styles.codeKey, { color: c.text, backgroundColor: c.background }]}>{setup.secret}</Text>
          <Text style={[styles.value, { color: c.textSecondary }]}>2. Enter the 6-digit code it shows:</Text>
          <CodeConfirm c={c} code={code} setCode={setCode} busy={busy} onSubmit={confirm} label="Verify and turn on"
            onCancel={() => { setSetup(null); setCode(""); setError(null); }} />
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Text style={[styles.value, { color: c.textSecondary }]}>Off - sign in with one step only.</Text>
          <SmallButton label="Set up" onPress={begin} c={c} busy={busy} />
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function CodeConfirm({ c, code, setCode, busy, onSubmit, onCancel, label, danger }: {
  c: C; code: string; setCode: (v: string) => void; busy: boolean;
  onSubmit: () => void; onCancel: () => void; label: string; danger?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <TextInput
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
        placeholder="123456"
        placeholderTextColor={c.textSecondary}
        keyboardType="number-pad"
        maxLength={6}
        style={[styles.codeInput, { color: c.text, backgroundColor: c.background, borderColor: c.backgroundSelected }]}
      />
      <SmallButton label={label} onPress={onSubmit} c={c} busy={busy} danger={danger} disabled={code.length !== 6} />
      <SmallButton label="Cancel" onPress={onCancel} c={c} ghost />
    </View>
  );
}

/** Devices & sessions list with per-device sign-out. */
function SessionsPanel({ c, onExpired }: { c: C; onExpired: () => void }) {
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    listSessions().then(setSessions).catch((e) => {
      if (e instanceof SessionExpiredError) onExpired();
      else setSessions([]);
    });
  }, [onExpired]);

  async function signOutOne(id: string) {
    setBusy(id);
    try {
      await revokeSessionById(id);
      setSessions((xs) => (xs ?? []).filter((x) => x.id !== id));
    } catch (e) {
      if (e instanceof SessionExpiredError) onExpired();
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.label, { color: c.text }]}>Devices & sessions</Text>
      {sessions === null ? (
        <ActivityIndicator color={c.textSecondary} />
      ) : sessions.length === 0 ? (
        <Text style={[styles.value, { color: c.textSecondary }]}>No active sessions.</Text>
      ) : (
        sessions.map((s) => {
          const loc = s.city && s.country ? `${s.city}, ${s.country}` : s.country || (s.ip ? "Unknown" : "Local network");
          return (
            <View key={s.id} style={[styles.sessionRow, { borderColor: c.backgroundSelected }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.label, { color: c.text }]} numberOfLines={1}>
                  {s.device ?? "Unknown device"}{s.current ? "  (this device)" : ""}
                </Text>
                <Text style={[styles.value, { color: c.textSecondary }]} numberOfLines={1}>
                  {loc}{s.ip ? ` · ${s.ip}` : ""}
                </Text>
              </View>
              {!s.current && (
                <Pressable onPress={() => signOutOne(s.id)} disabled={busy === s.id} hitSlop={8}>
                  <Text style={[styles.signOut, { opacity: busy === s.id ? 0.5 : 1 }]}>Sign out</Text>
                </Pressable>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

function Section({ title, c, children }: { title: string; c: C; children: React.ReactNode }) {
  return (
    <View style={[styles.section, { backgroundColor: c.backgroundElement }]}>
      <Text style={[styles.sectionTitle, { color: c.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, c }: { label: string; value: string; c: C }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: c.text }]} selectable numberOfLines={1}>{value}</Text>
    </View>
  );
}

function LinkRow({ label, onPress, c, danger }: { label: string; onPress: () => void; c: C; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.6 : 1 }]}>
      <Text style={[styles.label, { color: danger ? "#ef4444" : c.text }]}>{label}</Text>
      <Icon name="chevron" size={18} color={c.textSecondary} />
    </Pressable>
  );
}

function SmallButton({ label, onPress, c, busy, disabled, outline, ghost, danger }: {
  label: string; onPress: () => void; c: C; busy?: boolean; disabled?: boolean;
  outline?: boolean; ghost?: boolean; danger?: boolean;
}) {
  const bg = ghost ? "transparent" : outline ? "transparent" : danger ? "#ef4444" : PRIMARY;
  const fg = ghost || outline ? c.text : "#fff";
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [
        styles.smallBtn,
        outline ? { borderWidth: 1, borderColor: c.backgroundSelected } : null,
        { backgroundColor: bg, opacity: busy || disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.smallBtnText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  section: { borderRadius: 16, padding: 16, gap: 12, borderCurve: "continuous" },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  rowValue: { fontSize: 14, fontWeight: "500", flexShrink: 1, textAlign: "right" },
  label: { fontSize: 14, fontWeight: "500" },
  value: { fontSize: 13, lineHeight: 18 },
  error: { color: "#ef4444", fontSize: 13 },
  nameRow: { flexDirection: "row", gap: 8 },
  nameInput: { flex: 1, height: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 16, borderCurve: "continuous" },
  saveBtn: { paddingHorizontal: 18, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  saveText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  codeKey: { fontSize: 14, letterSpacing: 1, padding: 10, borderRadius: 10, borderCurve: "continuous", overflow: "hidden" },
  codeInput: { width: 110, height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 18, letterSpacing: 4, textAlign: "center", borderCurve: "continuous" },
  smallBtn: { height: 44, paddingHorizontal: 16, borderRadius: 10, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  smallBtnText: { fontSize: 14, fontWeight: "700" },
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 12, padding: 12, borderCurve: "continuous" },
  signOut: { color: "#ef4444", fontSize: 13, fontWeight: "700" },
  linkRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  logout: { height: 50, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  logoutText: { color: "#ef4444", fontSize: 15, fontWeight: "600" },
});
