import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";

import { createCard, deleteCard, SessionExpiredError, updateCard } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { textToHtml } from "@/lib/html";
import { saveDraft, loadDraft, clearDraft } from "@/lib/draft-store";
import { PRIMARY, STATE_COLORS, useColors } from "@/lib/ui";

/**
 * Create or edit a single card. Editing is detected by a `cardId` param; the
 * current front/back text are passed in as params to prefill without a refetch.
 */
export default function CardEditorScreen() {
  const c = useColors();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const params = useLocalSearchParams<{ deckId: string; cardId?: string; front?: string; back?: string }>();
  const editing = !!params.cardId;

  const [front, setFront] = useState(params.front ?? "");
  const [back, setBack] = useState(params.back ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uid = user?.id ?? "anon";
  const draftId = `card_${params.deckId}_${params.cardId ?? "new"}`;

  // Restore an unsaved draft (survives a crash / app kill mid-edit).
  useEffect(() => {
    let alive = true;
    loadDraft<{ front?: string; back?: string }>(uid, draftId).then((d) => {
      if (!alive || !d) return;
      if (d.front != null) setFront(d.front);
      if (d.back != null) setBack(d.back);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, draftId]);

  // Debounced encrypted autosave while editing.
  useEffect(() => {
    if (!front.trim() && !back.trim()) return;
    const t = setTimeout(() => { void saveDraft(uid, draftId, { front, back }); }, 600);
    return () => clearTimeout(t);
  }, [front, back, uid, draftId]);

  const finishAndClear = useCallback(() => {
    void clearDraft(uid, draftId);
    router.back();
  }, [uid, draftId, router]);

  async function save() {
    if (!front.trim()) {
      setError("The front of the card can't be empty.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = { front_html: textToHtml(front.trim()), back_html: textToHtml(back.trim()) };
    try {
      if (editing) await updateCard(params.deckId, params.cardId!, payload);
      else await createCard(params.deckId, payload);
      finishAndClear();
    } catch (err) {
      if (err instanceof SessionExpiredError) await signOut();
      else setError("Could not save the card. Try again.");
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert("Delete card", "This permanently removes the card.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCard(params.deckId, params.cardId!);
            finishAndClear();
          } catch (err) {
            if (err instanceof SessionExpiredError) await signOut();
            else setError("Could not delete the card.");
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: editing ? "Edit card" : "New card" }} />

      <Text style={[styles.label, { color: c.textSecondary }]}>Front</Text>
      <TextInput
        style={[styles.input, { color: c.text, backgroundColor: c.backgroundElement, borderColor: c.backgroundSelected }]}
        placeholder="Question / prompt"
        placeholderTextColor={c.textSecondary}
        value={front}
        onChangeText={(t) => { setFront(t); setError(null); }}
        multiline
        autoFocus={!editing}
      />

      <Text style={[styles.label, { color: c.textSecondary }]}>Back</Text>
      <TextInput
        style={[styles.input, { color: c.text, backgroundColor: c.backgroundElement, borderColor: c.backgroundSelected }]}
        placeholder="Answer"
        placeholderTextColor={c.textSecondary}
        value={back}
        onChangeText={setBack}
        multiline
      />

      {error ? <Text style={styles.error} selectable>{error}</Text> : null}

      <Pressable
        onPress={save}
        disabled={saving}
        style={({ pressed }) => [styles.button, { backgroundColor: PRIMARY, opacity: saving ? 0.6 : pressed ? 0.85 : 1 }]}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{editing ? "Save changes" : "Add card"}</Text>}
      </Pressable>

      {editing ? (
        <Pressable onPress={confirmDelete} style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <Text style={[styles.deleteText, { color: STATE_COLORS.due }]}>Delete card</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  label: { fontSize: 13, fontWeight: "600", marginTop: 6 },
  input: { minHeight: 110, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, textAlignVertical: "top", borderCurve: "continuous" },
  error: { color: "#ef4444", fontSize: 14 },
  button: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 10, borderCurve: "continuous" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  deleteBtn: { height: 48, alignItems: "center", justifyContent: "center" },
  deleteText: { fontSize: 15, fontWeight: "600" },
});
