import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Icon } from "@/components/icon";
import {
  leaveSharedDeck,
  listSharedDecks,
  outgoingShares,
  redeemInvite,
  SessionExpiredError,
  type Deck,
  type OutgoingShare,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PRIMARY, useColors } from "@/lib/ui";

/** Shared: decks shared with you (incoming) and grants you've made (outgoing). */
export default function SharedScreen() {
  const c = useColors();
  const router = useRouter();
  const { signOut } = useAuth();

  const [incoming, setIncoming] = useState<Deck[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [inc, out] = await Promise.all([listSharedDecks(), outgoingShares()]);
      setIncoming(inc);
      setOutgoing(out);
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

  async function redeem() {
    const value = code.trim();
    if (!value || redeeming) return;
    setRedeeming(true);
    setRedeemMsg(null);
    try {
      await redeemInvite(value);
      setCode("");
      setRedeemMsg("Deck added to your shared decks.");
      await load();
    } catch (err) {
      if (err instanceof SessionExpiredError) await signOut();
      else setRedeemMsg("That invite code is invalid or already used.");
    } finally {
      setRedeeming(false);
    }
  }

  function confirmLeave(deck: Deck) {
    Alert.alert("Remove shared deck", `Remove "${deck.title}" from your shared decks? You'd need a new invite to get it back.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await leaveSharedDeck(deck.id);
            setIncoming((xs) => xs.filter((x) => x.id !== deck.id));
          } catch (err) {
            if (err instanceof SessionExpiredError) await signOut();
          }
        },
      },
    ]);
  }

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
      <View style={[styles.redeem, { backgroundColor: c.backgroundElement }]}>
        <Text style={[styles.redeemLabel, { color: c.text }]}>Have an invite code?</Text>
        <View style={styles.redeemRow}>
          <TextInput
            style={[styles.redeemInput, { color: c.text, backgroundColor: c.background, borderColor: c.backgroundSelected }]}
            placeholder="Paste code"
            placeholderTextColor={c.textSecondary}
            value={code}
            onChangeText={(t) => { setCode(t); setRedeemMsg(null); }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            onPress={redeem}
            disabled={redeeming || !code.trim()}
            style={({ pressed }) => [styles.redeemBtn, { backgroundColor: PRIMARY, opacity: redeeming || !code.trim() ? 0.4 : pressed ? 0.85 : 1 }]}
          >
            {redeeming ? <ActivityIndicator color="#fff" /> : <Text style={styles.redeemBtnText}>Redeem</Text>}
          </Pressable>
        </View>
        {redeemMsg ? <Text style={[styles.redeemMsg, { color: c.textSecondary }]}>{redeemMsg}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Shared with you</Text>
        {incoming.length === 0 ? (
          <View style={[styles.empty, { borderColor: c.backgroundSelected }]}>
            <Text style={[styles.emptyBody, { color: c.textSecondary }]}>No decks shared with you yet.</Text>
          </View>
        ) : (
          incoming.map((d) => (
            <Pressable
              key={d.id}
              onPress={() => router.push({ pathname: "/deck/[id]", params: { id: d.id } })}
              onLongPress={() => confirmLeave(d)}
              style={({ pressed }) => [styles.card, { backgroundColor: c.backgroundElement, opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[styles.badge, { backgroundColor: d.color ?? PRIMARY }]}>
                <Text style={styles.badgeText}>{d.title.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={1}>
                {d.title}
              </Text>
              <Pressable accessibilityLabel="Remove shared deck" hitSlop={10} onPress={() => confirmLeave(d)}>
                <Icon name="leave" size={20} color={c.textSecondary} />
              </Pressable>
            </Pressable>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>You shared</Text>
        {outgoing.length === 0 ? (
          <View style={[styles.empty, { borderColor: c.backgroundSelected }]}>
            <Text style={[styles.emptyBody, { color: c.textSecondary }]}>You haven't shared any decks.</Text>
          </View>
        ) : (
          outgoing.map((o) => (
            <View key={`${o.deck_id}-${o.grantee_id}`} style={[styles.card, { backgroundColor: c.backgroundElement }]}>
              <View style={styles.outBody}>
                <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={1}>
                  {o.deck_title}
                </Text>
                <Text style={[styles.cardSub, { color: c.textSecondary }]}>
                  {o.grantee ?? "someone"} · {o.permission}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  redeem: { borderRadius: 16, padding: 16, gap: 10, borderCurve: "continuous" },
  redeemLabel: { fontSize: 14, fontWeight: "700" },
  redeemRow: { flexDirection: "row", gap: 8 },
  redeemInput: { flex: 1, height: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 15, borderCurve: "continuous" },
  redeemBtn: { paddingHorizontal: 18, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  redeemBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  redeemMsg: { fontSize: 13 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, borderCurve: "continuous" },
  outBody: { flex: 1, gap: 2 },
  badge: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  badgeText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  cardTitle: { fontSize: 15, fontWeight: "600", flex: 1 },
  cardSub: { fontSize: 12 },
  empty: { borderWidth: 1, borderRadius: 16, padding: 20, borderCurve: "continuous" },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: "center" },
});
