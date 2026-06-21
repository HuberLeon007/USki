import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Icon } from "@/components/icon";

import {
  createInvite,
  deleteDeck,
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
  const router = useRouter();
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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function shareDeck() {
    if (!deck) return;
    try {
      const invite = await createInvite(deck.id, "read");
      await Share.share({
        message: `Join my USki deck "${deck.title}". In USki open Shared and redeem this code: ${invite.code}`,
      });
    } catch (err) {
      if (err instanceof SessionExpiredError) await signOut();
    }
  }

  function confirmDeleteDeck() {
    if (!deck) return;
    Alert.alert("Delete deck", `"${deck.title}" and all its cards will be permanently deleted.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDeck(deck.id);
            router.back();
          } catch (err) {
            if (err instanceof SessionExpiredError) await signOut();
          }
        },
      },
    ]);
  }

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
      <Stack.Screen
        options={{
          title: deck.title,
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 18 }}>
              <Pressable
                accessibilityLabel="Add card"
                hitSlop={10}
                onPress={() => router.push({ pathname: "/card-editor", params: { deckId: deck.id } })}
              >
                <Icon name="add" size={26} color={PRIMARY} />
              </Pressable>
              <Pressable accessibilityLabel="Share deck" hitSlop={10} onPress={shareDeck}>
                <Icon name="share" size={22} color={c.text} />
              </Pressable>
              <Pressable accessibilityLabel="Delete deck" hitSlop={10} onPress={confirmDeleteDeck}>
                <Icon name="trash" size={22} color={STATE_COLORS.due} />
              </Pressable>
            </View>
          ),
        }}
      />
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
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/study/[id]", params: { id: deck.id } })}
              style={({ pressed }) => [styles.studyBtn, { backgroundColor: PRIMARY, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={styles.studyText}>Study now</Text>
            </Pressable>
            <Text style={[styles.cardsHead, { color: c.text }]}>{cards.length} cards</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { color: c.textSecondary }]}>This deck has no cards yet.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/card-editor",
                params: {
                  deckId: deck.id,
                  cardId: item.id,
                  front: htmlToText(item.front_html),
                  back: htmlToText(item.back_html),
                },
              })
            }
            style={({ pressed }) => [styles.card, { backgroundColor: c.backgroundElement, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.front, { color: c.text }]} numberOfLines={2}>
              {htmlToText(item.front_html) || "(empty)"}
            </Text>
            <View style={[styles.divider, { backgroundColor: c.backgroundSelected }]} />
            <Text style={[styles.back, { color: c.textSecondary }]} numberOfLines={3}>
              {htmlToText(item.back_html) || "(empty)"}
            </Text>
          </Pressable>
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
  studyBtn: { height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  studyText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  card: { padding: 14, borderRadius: 14, gap: 8, borderCurve: "continuous" },
  front: { fontSize: 15, fontWeight: "600" },
  divider: { height: 1 },
  back: { fontSize: 14, lineHeight: 19 },
  empty: { textAlign: "center", paddingVertical: 48, fontSize: 14 },
});
