import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  getDeck,
  listCards,
  reviewStats,
  SessionExpiredError,
  type Card,
  type Deck,
  type ReviewStats,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { htmlToText } from "@/lib/html";
import { STATE_COLORS, PRIMARY, useColors } from "@/lib/ui";

/**
 * Deck detail: title, today's review breakdown, and the deck's cards (front /
 * back text previews). The study loop is wired in the next iteration; the
 * ?study param is reserved for it.
 */
export default function DeckDetailScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { signOut } = useAuth();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [cards, setCards] = useState<Card[] | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [d, s, cs] = await Promise.all([
        getDeck(id),
        reviewStats(id).catch(() => null),
        listCards(id),
      ]);
      setDeck(d);
      setStats(s);
      setCards(cs);
    } catch (err) {
      if (err instanceof SessionExpiredError) await signOut();
      else setCards([]);
    }
  }, [id, signOut]);

  useEffect(() => {
    load();
  }, [load]);

  if (!deck || cards === null) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ title: "Deck" }} />
        <ActivityIndicator color={PRIMARY} />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ title: deck.title }} />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={cards}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            {deck.description ? (
              <Text style={[styles.desc, { color: c.textSecondary }]}>{deck.description}</Text>
            ) : null}
            {stats ? (
              <View style={styles.statRow}>
                {([
                  ["New", stats.new, STATE_COLORS.new],
                  ["Learning", stats.learning, STATE_COLORS.learning],
                  ["Due", stats.due, STATE_COLORS.due],
                ] as const).map(([label, count, color]) => (
                  <View key={label} style={[styles.statBox, { backgroundColor: c.backgroundElement }]}>
                    <Text style={[styles.statCount, { color }]}>{count}</Text>
                    <Text style={[styles.statLabel, { color: c.textSecondary }]}>{label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Text style={[styles.cardsHead, { color: c.text }]}>{cards.length} cards</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { color: c.textSecondary }]}>This deck has no cards yet.</Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: c.backgroundElement }]}>
            <Text style={[styles.front, { color: c.text }]} numberOfLines={2}>
              {htmlToText(item.front_html) || "(empty)"}
            </Text>
            <View style={[styles.divider, { backgroundColor: c.backgroundSelected }]} />
            <Text style={[styles.back, { color: c.textSecondary }]} numberOfLines={3}>
              {htmlToText(item.back_html) || "(empty)"}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 10 },
  header: { gap: 14, marginBottom: 6 },
  desc: { fontSize: 14, lineHeight: 20 },
  statRow: { flexDirection: "row", gap: 10 },
  statBox: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center", gap: 2, borderCurve: "continuous" },
  statCount: { fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 12 },
  cardsHead: { fontSize: 16, fontWeight: "700" },
  card: { padding: 14, borderRadius: 14, gap: 8, borderCurve: "continuous" },
  front: { fontSize: 15, fontWeight: "600" },
  divider: { height: 1 },
  back: { fontSize: 14, lineHeight: 19 },
  empty: { textAlign: "center", paddingVertical: 48, fontSize: 14 },
});
