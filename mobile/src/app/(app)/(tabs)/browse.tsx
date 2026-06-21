import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { browseCards, SessionExpiredError, type BrowseCard } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { htmlToText } from "@/lib/html";
import { PRIMARY, useColors } from "@/lib/ui";

/**
 * Browse: every card across the user's decks, searchable by front/back text.
 * Uses FlatList for efficient scrolling over large collections.
 */
export default function BrowseScreen() {
  const c = useColors();
  const router = useRouter();
  const { signOut } = useAuth();

  const [cards, setCards] = useState<BrowseCard[] | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      setCards(await browseCards());
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        await signOut();
        return;
      }
      setCards([]);
    }
  }, [signOut]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const list = (cards ?? []).map((card) => ({
      ...card,
      _front: htmlToText(card.front_html),
      _back: htmlToText(card.back_html),
    }));
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) => r._front.toLowerCase().includes(q) || r._back.toLowerCase().includes(q) || r.deck_title.toLowerCase().includes(q),
    );
  }, [cards, query]);

  if (cards === null) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={PRIMARY} />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <View style={styles.searchWrap}>
        <TextInput
          style={[styles.search, { color: c.text, backgroundColor: c.backgroundElement, borderColor: c.backgroundSelected }]}
          placeholder="Search all cards"
          placeholderTextColor={c.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={[styles.empty, { color: c.textSecondary }]}>
            {query ? "No cards match your search." : "No cards yet."}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/deck/[id]", params: { id: item.deck_id } })}
            style={({ pressed }) => [styles.card, { backgroundColor: c.backgroundElement, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.front, { color: c.text }]} numberOfLines={2}>
              {item._front || "(empty)"}
            </Text>
            {item._back ? (
              <Text style={[styles.back, { color: c.textSecondary }]} numberOfLines={2}>
                {item._back}
              </Text>
            ) : null}
            <Text style={[styles.deck, { color: PRIMARY }]}>{item.deck_title}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  search: { height: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, borderCurve: "continuous" },
  list: { padding: 16, gap: 10 },
  card: { padding: 14, borderRadius: 14, gap: 4, borderCurve: "continuous" },
  front: { fontSize: 15, fontWeight: "600" },
  back: { fontSize: 13, lineHeight: 18 },
  deck: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  empty: { textAlign: "center", paddingVertical: 48, fontSize: 14 },
});
