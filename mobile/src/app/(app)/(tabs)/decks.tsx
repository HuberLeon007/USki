import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { listDecks, listGroups, SessionExpiredError, type Deck, type DeckGroup } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PRIMARY, useColors } from "@/lib/ui";

/** All decks, grouped by folder (mirrors the web Decks view). Tap to open. */
export default function DecksScreen() {
  const c = useColors();
  const router = useRouter();
  const { signOut } = useAuth();

  const [decks, setDecks] = useState<Deck[]>([]);
  const [groups, setGroups] = useState<DeckGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [d, g] = await Promise.all([listDecks(), listGroups()]);
      setDecks(d);
      setGroups(g);
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        await signOut();
        return;
      }
      setError("Could not load your decks. Pull to retry.");
    } finally {
      setLoading(false);
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

  const ungrouped = decks.filter((d) => !d.group_id);

  const DeckRow = ({ d }: { d: Deck }) => (
    <Pressable
      onPress={() => router.push({ pathname: "/deck/[id]", params: { id: d.id } })}
      style={({ pressed }) => [styles.card, { backgroundColor: c.backgroundElement, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.badge, { backgroundColor: d.color ?? PRIMARY }]}>
        <Text style={styles.badgeText}>{d.title.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={1}>
          {d.title}
        </Text>
        {d.description ? (
          <Text style={[styles.cardDesc, { color: c.textSecondary }]} numberOfLines={1}>
            {d.description}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
    </Pressable>
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={PRIMARY} />
      </View>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {groups.map((g) => {
        const inGroup = decks.filter((d) => d.group_id === g.id);
        return (
          <View key={g.id} style={styles.section}>
            <View style={styles.sectionHead}>
              <Ionicons name="folder-outline" size={16} color={c.textSecondary} />
              <Text style={[styles.sectionTitle, { color: c.text }]}>{g.name}</Text>
              <Text style={[styles.count, { color: c.textSecondary }]}>{inGroup.length}</Text>
            </View>
            {inGroup.length === 0 ? (
              <Text style={[styles.emptyBody, { color: c.textSecondary }]}>Empty folder.</Text>
            ) : (
              inGroup.map((d) => <DeckRow key={d.id} d={d} />)
            )}
          </View>
        );
      })}

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Ionicons name="layers-outline" size={16} color={c.textSecondary} />
          <Text style={[styles.sectionTitle, { color: c.text }]}>{groups.length ? "Ungrouped" : "All decks"}</Text>
          <Text style={[styles.count, { color: c.textSecondary }]}>{ungrouped.length}</Text>
        </View>
        {ungrouped.length === 0 ? (
          <View style={[styles.empty, { borderColor: c.backgroundSelected }]}>
            <Text style={[styles.emptyBody, { color: c.textSecondary }]}>
              No decks yet. Create one on the web app and pull to refresh.
            </Text>
          </View>
        ) : (
          ungrouped.map((d) => <DeckRow key={d.id} d={d} />)
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  error: { color: "#ef4444", fontSize: 14, textAlign: "center" },
  section: { gap: 8 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700", flex: 1 },
  count: { fontSize: 13, fontVariant: ["tabular-nums"] },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, borderCurve: "continuous" },
  badge: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  badgeText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardDesc: { fontSize: 12 },
  empty: { borderWidth: 1, borderRadius: 16, padding: 20, borderCurve: "continuous" },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: "center" },
});
