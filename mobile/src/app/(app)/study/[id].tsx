import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  cardIntervals,
  dueCards,
  rateCard,
  SessionExpiredError,
  type Card,
  type IntervalPreview,
  type ReviewRating,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { htmlToText } from "@/lib/html";
import { PRIMARY, STATE_COLORS, useColors } from "@/lib/ui";

const GRADES: { rating: ReviewRating; label: string; color: string }[] = [
  { rating: "again", label: "Again", color: STATE_COLORS.due },
  { rating: "hard", label: "Hard", color: STATE_COLORS.learning },
  { rating: "good", label: "Good", color: STATE_COLORS.new },
  { rating: "easy", label: "Easy", color: STATE_COLORS.done },
];

/**
 * Study loop: walk the deck's due queue, reveal the answer, then grade with the
 * four SRS ratings (interval preview shown per button). Each grade posts to the
 * backend scheduler and advances. Mirrors the web review flow.
 */
export default function StudyScreen() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { signOut } = useAuth();

  const [queue, setQueue] = useState<Card[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [intervals, setIntervals] = useState<IntervalPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  useEffect(() => {
    if (!id) return;
    dueCards(id)
      .then(setQueue)
      .catch(async (err) => {
        if (err instanceof SessionExpiredError) await signOut();
        else setQueue([]);
      });
  }, [id, signOut]);

  const current = queue?.[index] ?? null;

  const reveal = useCallback(async () => {
    setRevealed(true);
    if (id && current) {
      cardIntervals(id, current.id).then(setIntervals).catch(() => setIntervals(null));
    }
  }, [id, current]);

  const grade = useCallback(
    async (rating: ReviewRating) => {
      if (!id || !current || busy) return;
      setBusy(true);
      try {
        await rateCard(id, current.id, rating);
        setReviewed((n) => n + 1);
        setIndex((i) => i + 1);
        setRevealed(false);
        setIntervals(null);
      } catch (err) {
        if (err instanceof SessionExpiredError) await signOut();
      } finally {
        setBusy(false);
      }
    },
    [id, current, busy, signOut],
  );

  if (queue === null) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ title: "Study" }} />
        <ActivityIndicator color={PRIMARY} />
      </View>
    );
  }

  // Finished: either nothing was due, or we've graded the whole queue.
  if (!current) {
    const nothing = queue.length === 0;
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ title: "Done" }} />
        <Text style={styles.doneEmoji}>{nothing ? "🎉" : "✅"}</Text>
        <Text style={[styles.doneTitle, { color: c.text }]}>
          {nothing ? "Nothing due right now" : "Session complete"}
        </Text>
        <Text style={[styles.doneSub, { color: c.textSecondary }]}>
          {nothing ? "Come back later for your next batch." : `You reviewed ${reviewed} ${reviewed === 1 ? "card" : "cards"}.`}
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.doneBtn, { backgroundColor: PRIMARY, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.doneBtnText}>Back to deck</Text>
        </Pressable>
      </View>
    );
  }

  const total = queue.length;
  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ title: `${index + 1} / ${total}` }} />

      <View style={[styles.progress, { backgroundColor: c.backgroundSelected }]}>
        <View style={[styles.progressFill, { width: `${(index / total) * 100}%`, backgroundColor: PRIMARY }]} />
      </View>

      <ScrollView contentContainerStyle={styles.cardScroll}>
        <View style={[styles.cardFace, { backgroundColor: c.backgroundElement }]}>
          <Text style={[styles.faceLabel, { color: c.textSecondary }]}>QUESTION</Text>
          <Text style={[styles.faceText, { color: c.text }]} selectable>
            {htmlToText(current.front_html) || "(empty)"}
          </Text>
        </View>

        {revealed && (
          <View style={[styles.cardFace, { backgroundColor: c.backgroundElement }]}>
            <Text style={[styles.faceLabel, { color: c.textSecondary }]}>ANSWER</Text>
            <Text style={[styles.faceText, { color: c.text }]} selectable>
              {htmlToText(current.back_html) || "(empty)"}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.controls}>
        {!revealed ? (
          <Pressable
            onPress={reveal}
            style={({ pressed }) => [styles.showBtn, { backgroundColor: PRIMARY, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.showText}>Show answer</Text>
          </Pressable>
        ) : (
          <View style={styles.gradeRow}>
            {GRADES.map((g) => (
              <Pressable
                key={g.rating}
                disabled={busy}
                onPress={() => grade(g.rating)}
                style={({ pressed }) => [styles.gradeBtn, { backgroundColor: g.color, opacity: busy ? 0.5 : pressed ? 0.85 : 1 }]}
              >
                <Text style={styles.gradeLabel}>{g.label}</Text>
                {intervals ? <Text style={styles.gradeInterval}>{intervals[g.rating]}</Text> : null}
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  progress: { height: 4, width: "100%" },
  progressFill: { height: "100%" },
  cardScroll: { padding: 16, gap: 12 },
  cardFace: { borderRadius: 18, padding: 20, gap: 8, borderCurve: "continuous" },
  faceLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  faceText: { fontSize: 20, lineHeight: 28, fontWeight: "500" },
  controls: { padding: 16, gap: 10 },
  showBtn: { height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  showText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  gradeRow: { flexDirection: "row", gap: 8 },
  gradeBtn: { flex: 1, height: 60, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 2, borderCurve: "continuous" },
  gradeLabel: { color: "#fff", fontSize: 14, fontWeight: "700" },
  gradeInterval: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontVariant: ["tabular-nums"] },
  doneEmoji: { fontSize: 48 },
  doneTitle: { fontSize: 22, fontWeight: "800" },
  doneSub: { fontSize: 15, textAlign: "center" },
  doneBtn: { marginTop: 12, height: 50, paddingHorizontal: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  doneBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
