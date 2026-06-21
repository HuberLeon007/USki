import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createDeck, SessionExpiredError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PRIMARY, useColors } from "@/lib/ui";

/** Modal to create a new deck (title + optional description). */
export default function NewDeckScreen() {
  const c = useColors();
  const router = useRouter();
  const { signOut } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!title.trim()) {
      setError("Give your deck a title.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const deck = await createDeck({ title: title.trim(), description: description.trim() || undefined });
      router.replace({ pathname: "/deck/[id]", params: { id: deck.id } });
    } catch (err) {
      if (err instanceof SessionExpiredError) await signOut();
      else setError("Could not create the deck. Try again.");
      setSaving(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.label, { color: c.textSecondary }]}>Title</Text>
      <TextInput
        style={[styles.input, { color: c.text, backgroundColor: c.backgroundElement, borderColor: c.backgroundSelected }]}
        placeholder="e.g. Biology Grade 10"
        placeholderTextColor={c.textSecondary}
        value={title}
        onChangeText={(t) => { setTitle(t); setError(null); }}
        autoFocus
        returnKeyType="next"
      />

      <Text style={[styles.label, { color: c.textSecondary }]}>Description (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline, { color: c.text, backgroundColor: c.backgroundElement, borderColor: c.backgroundSelected }]}
        placeholder="What's this deck about?"
        placeholderTextColor={c.textSecondary}
        value={description}
        onChangeText={setDescription}
        multiline
      />

      {error ? <Text style={styles.error} selectable>{error}</Text> : null}

      <Pressable
        onPress={create}
        disabled={saving}
        style={({ pressed }) => [styles.button, { backgroundColor: PRIMARY, opacity: saving ? 0.6 : pressed ? 0.85 : 1 }]}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create deck</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  label: { fontSize: 13, fontWeight: "600", marginTop: 6 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, borderCurve: "continuous" },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  error: { color: "#ef4444", fontSize: 14 },
  button: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 10, borderCurve: "continuous" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
