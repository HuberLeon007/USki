import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { sendChatStream, type ChatApiMessage } from "@/lib/api";
import { Icon } from "@/components/icon";
import { PRIMARY, useColors } from "@/lib/ui";

interface StudySeroProps {
  visible: boolean;
  onClose: () => void;
  /** Plain-text front/back of the card currently under review. */
  front: string;
  back: string;
  /** Deck id forwarded to the backend so Sero has deck context. */
  deckId: string | null;
}

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "Explain this simply",
  "Give me an example",
  "Why is this the answer?",
  "Make a memory hook",
];

/**
 * In-study Sero: a bottom sheet that lets the learner ask the AI about the card
 * they are currently reviewing, without leaving the study loop. The current
 * card's front/back is sent as hidden context so answers are grounded, and the
 * reply streams in live over SSE (reusing the app's sendChatStream).
 */
export function StudySero({ visible, onClose, front, back, deckId }: StudySeroProps) {
  const c = useColors();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const context: ChatApiMessage = useMemo(
    () => ({
      role: "system",
      content:
        `The user is reviewing a flashcard. Help them understand it. ` +
        `Keep answers short and focused.\n\nCard front: "${front}"\nCard back: "${back}"`,
    }),
    [front, back],
  );

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || streaming) return;
      setInput("");
      const history = [...turns, { role: "user" as const, content: q }];
      setTurns([...history, { role: "assistant", content: "" }]);
      setStreaming(true);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

      const messages: ChatApiMessage[] = [
        context,
        ...history.map((t) => ({ role: t.role, content: t.content })),
      ];

      let acc = "";
      await sendChatStream(messages, deckId, {
        onDelta: (text) => {
          acc += text;
          setTurns((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: "assistant", content: acc };
            return copy;
          });
          scrollRef.current?.scrollToEnd({ animated: true });
        },
        onError: (msg) => {
          setTurns((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = {
              role: "assistant",
              content: acc || (msg ? `Sero error: ${msg}` : "Sero is unavailable right now."),
            };
            return copy;
          });
          setStreaming(false);
        },
        onDone: () => setStreaming(false),
      });
    },
    [turns, streaming, context, deckId],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropFill} onPress={onClose} accessibilityLabel="Close Sero" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[styles.sheet, { backgroundColor: c.background }]}
        >
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Icon name="sparkles" size={18} color={PRIMARY} />
              <Text style={[styles.title, { color: c.text }]}>Ask Sero about this card</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Icon name="x" size={22} color={c.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.thread}
            contentContainerStyle={styles.threadContent}
            keyboardShouldPersistTaps="handled"
          >
            {turns.length === 0 ? (
              <Text style={[styles.empty, { color: c.textSecondary }]}>
                Stuck on this card? Ask Sero to explain it, give an example, or quiz you.
              </Text>
            ) : (
              turns.map((t, i) => (
                <View
                  key={i}
                  style={[
                    styles.bubble,
                    t.role === "user"
                      ? { backgroundColor: PRIMARY, alignSelf: "flex-end" }
                      : { backgroundColor: c.backgroundElement, alignSelf: "flex-start" },
                  ]}
                >
                  {t.role === "assistant" && t.content === "" ? (
                    <ActivityIndicator color={c.textSecondary} />
                  ) : (
                    <Text style={[styles.bubbleText, { color: t.role === "user" ? "#fff" : c.text }]}>
                      {t.content}
                    </Text>
                  )}
                </View>
              ))
            )}

            {turns.length === 0 && (
              <View style={styles.chips}>
                {QUICK_PROMPTS.map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => ask(p)}
                    style={({ pressed }) => [
                      styles.chip,
                      { borderColor: c.backgroundSelected, opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: c.text }]}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={[styles.inputRow, { borderTopColor: c.backgroundSelected }]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask about this card…"
              placeholderTextColor={c.textSecondary}
              style={[styles.input, { color: c.text, backgroundColor: c.backgroundElement }]}
              onSubmitEditing={() => ask(input)}
              returnKeyType="send"
              editable={!streaming}
            />
            <Pressable
              onPress={() => ask(input)}
              disabled={streaming || !input.trim()}
              style={({ pressed }) => [
                styles.send,
                { backgroundColor: PRIMARY, opacity: streaming || !input.trim() ? 0.4 : pressed ? 0.85 : 1 },
              ]}
              accessibilityLabel="Send"
            >
              <Icon name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  backdropFill: { flex: 1 },
  sheet: {
    maxHeight: "82%",
    minHeight: "55%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderCurve: "continuous",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(127,127,127,0.4)",
    marginTop: 8,
    marginBottom: 8,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "700" },
  thread: { flex: 1 },
  threadContent: { gap: 10, paddingVertical: 8 },
  empty: { fontSize: 14, lineHeight: 20, paddingVertical: 8 },
  bubble: { maxWidth: "85%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, borderCurve: "continuous" },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: "600" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    borderCurve: "continuous",
  },
  send: { height: 44, width: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
});
