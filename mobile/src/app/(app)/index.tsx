import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";

import { listDecks, SessionExpiredError, type Deck } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Colors } from "@/constants/theme";

const PRIMARY = "#7c3aed";

/**
 * Signed-in home: the user's decks pulled live from the backend, with
 * pull-to-refresh, an empty state, and a sign-out control. This proves the full
 * mobile path end to end (SecureStore token -> authed fetch -> render).
 */
export default function DecksScreen() {
  const scheme = useColorScheme();
  const c = Colors[scheme === "dark" ? "dark" : "light"];
  const { user, signOut } = useAuth();

  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDecks(await listDecks());
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        await signOut();
        return;
      }
      setError("Could not load your decks. Pull to retry.");
      setDecks([]);
    }
  }, [signOut]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
    >
      <Text style={[styles.greeting, { color: c.textSecondary }]} selectable>
        Signed in as {user?.username ? `@${user.username}` : user?.email}
      </Text>

      {decks === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : error ? (
        <Text style={styles.error} selectable>
          {error}
        </Text>
      ) : decks.length === 0 ? (
        <View style={[styles.empty, { borderColor: c.backgroundSelected }]}>
          <Text style={[styles.emptyTitle, { color: c.text }]}>No decks yet</Text>
          <Text style={[styles.emptyBody, { color: c.textSecondary }]}>
            Create decks on the web app, they'll show up here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {decks.map((d) => (
            <View key={d.id} style={[styles.card, { backgroundColor: c.backgroundElement }]}>
              <View style={[styles.badge, { backgroundColor: d.color ?? PRIMARY }]}>
                <Text style={styles.badgeText}>{d.title.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={1}>
                  {d.title}
                </Text>
                {d.description ? (
                  <Text style={[styles.cardDesc, { color: c.textSecondary }]} numberOfLines={2}>
                    {d.description}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={signOut}
        style={({ pressed }) => [styles.signOut, { borderColor: c.backgroundSelected, opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  greeting: { fontSize: 13 },
  center: { paddingVertical: 48, alignItems: "center" },
  error: { color: "#ef4444", fontSize: 14, paddingVertical: 24, textAlign: "center" },
  empty: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: "center", gap: 6, borderCurve: "continuous" },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  list: { gap: 10 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 16, borderCurve: "continuous" },
  badge: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  badgeText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  signOut: { marginTop: 8, height: 48, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  signOutText: { color: "#ef4444", fontSize: 15, fontWeight: "600" },
});
