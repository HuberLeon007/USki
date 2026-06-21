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

import { listDecks, reviewStats, SessionExpiredError, type Deck, type ReviewStats } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PRIMARY, useColors } from "@/lib/ui";

interface Totals {
  new: number;
  learning: number;
  due: number;
  done: number;
}

/**
 * Overview: the day's review aggregate across every deck (new / review / due),
 * a progress bar of cards done, and the decks that still have cards waiting,
 * each with a Study shortcut. Mirrors the web dashboard Overview panel.
 */
export default function OverviewScreen() {
  const c = useColors();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [decks, setDecks] = useState<Deck[]>([]);
  const [stats, setStats] = useState<Record<string, ReviewStats>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await listDecks();
      setDecks(d);
      const entries = await Promise.all(
        d.map(async (deck) => [deck.id, await reviewStats(deck.id).catch(() => null)] as const),
      );
      const map: Record<string, ReviewStats> = {};
      for (const [id, s] of entries) if (s) map[id] = s;
      setStats(map);
    } catch (err) {
      if (err instanceof SessionExpiredError) await signOut();
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

  const totals: Totals = { new: 0, learning: 0, due: 0, done: 0 };
  for (const s of Object.values(stats)) {
    totals.new += s.new;
    totals.learning += s.learning;
    totals.due += s.due;
    totals.done += s.done;
  }
  const toGo = totals.new + totals.learning + totals.due;
  const startTotal = totals.done + toGo;
  const pct = startTotal > 0 ? Math.round((totals.done / startTotal) * 100) : 0;

  const dueDecks = decks.filter((d) => {
    const s = stats[d.id];
    return s && s.new + s.learning + s.due > 0;
  });

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
      <Text style={[styles.hello, { color: c.textSecondary }]}>
        {user?.username ? `Hi @${user.username}` : "Welcome back"}
      </Text>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>TODAY'S REVIEW</Text>
        <Text style={styles.heroTitle}>
          {toGo > 0 ? `${toGo} cards to review` : startTotal > 0 ? "All caught up for today." : "Nothing scheduled."}
        </Text>

        <View style={styles.statRow}>
          {([
            ["New", totals.new],
            ["Review", totals.learning],
            ["Due", totals.due],
          ] as const).map(([label, count]) => (
            <View key={label} style={styles.statBox}>
              <Text style={styles.statCount}>{count}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {totals.done} of {startTotal} done · {pct}%
        </Text>
      </View>

      <Text style={[styles.sectionTitle, { color: c.text }]}>Today's decks</Text>
      {dueDecks.length === 0 ? (
        <View style={[styles.empty, { borderColor: c.backgroundSelected }]}>
          <Text style={[styles.emptyBody, { color: c.textSecondary }]}>
            Nothing scheduled. Open the Decks tab to study anything.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {dueDecks.map((d) => {
            const s = stats[d.id];
            const count = s ? s.new + s.learning + s.due : 0;
            return (
              <View key={d.id} style={[styles.card, { backgroundColor: c.backgroundElement }]}>
                <Pressable style={styles.cardMain} onPress={() => router.push({ pathname: "/deck/[id]", params: { id: d.id } })}>
                  <View style={[styles.badge, { backgroundColor: d.color ?? PRIMARY }]}>
                    <Text style={styles.badgeText}>{d.title.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={1}>
                      {d.title}
                    </Text>
                    <Text style={[styles.cardSub, { color: c.textSecondary }]}>{count} waiting</Text>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: "/study/[id]", params: { id: d.id } })}
                  style={({ pressed }) => [styles.studyBtn, { backgroundColor: PRIMARY, opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text style={styles.studyText}>Study</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  hello: { fontSize: 14 },
  hero: {
    borderRadius: 20,
    padding: 20,
    gap: 14,
    borderCurve: "continuous",
    backgroundColor: PRIMARY,
    experimental_backgroundImage: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
  },
  heroLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, color: "rgba(255,255,255,0.8)" },
  heroTitle: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3, color: "#fff" },
  statRow: { flexDirection: "row", gap: 10 },
  statBox: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center", gap: 2, borderCurve: "continuous", backgroundColor: "rgba(255,255,255,0.16)" },
  statCount: { fontSize: 22, fontWeight: "800", fontVariant: ["tabular-nums"], color: "#fff" },
  statLabel: { fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.85)" },
  track: { height: 10, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.25)" },
  fill: { height: "100%", borderRadius: 999, backgroundColor: "#fff" },
  progressText: { fontSize: 12, fontVariant: ["tabular-nums"], color: "rgba(255,255,255,0.9)" },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
  empty: { borderWidth: 1, borderRadius: 16, padding: 20, borderCurve: "continuous" },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  list: { gap: 10 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, borderCurve: "continuous" },
  cardMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  badge: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  badgeText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardSub: { fontSize: 12, fontVariant: ["tabular-nums"] },
  studyBtn: { paddingHorizontal: 16, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  studyText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
