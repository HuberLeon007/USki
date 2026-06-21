import { useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Icon } from "@/components/icon";
import { sendChatStream, type ChatApiMessage } from "@/lib/api";
import { PRIMARY, useColors } from "@/lib/ui";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SYSTEM: ChatApiMessage = {
  role: "system",
  content:
    "You are Sero, the friendly study assistant for USki. Help the user learn: explain concepts, " +
    "draft flashcards, and quiz them. Keep replies concise and in plain text. Never use em or en dashes.",
};

const rid = () => Math.random().toString(36).slice(2);

/**
 * Sero AI chat. Streams replies token-by-token over SSE, shows a live status
 * line ("Reading through ...") while the assistant works, and keeps the
 * conversation in memory for the session.
 */
export default function SeroScreen() {
  const c = useColors();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const listRef = useRef<FlatList<Msg>>(null);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    const userMsg: Msg = { id: rid(), role: "user", content: text };
    const aId = rid();
    const history = [...messages, userMsg];
    setMessages([...history, { id: aId, role: "assistant", content: "" }]);
    setDraft("");
    setSending(true);
    setStatus(null);

    const apiMessages: ChatApiMessage[] = [
      SYSTEM,
      ...history.map((m) => ({ role: m.role, content: m.content }) as ChatApiMessage),
    ];
    let acc = "";
    const fail = "Sero is unavailable right now. Make sure the AI service is running and try again.";
    const setAssistant = (content: string) =>
      setMessages((ms) => ms.map((m) => (m.id === aId ? { ...m, content } : m)));

    await sendChatStream(apiMessages, null, {
      onStatus: setStatus,
      onDelta: (d) => {
        acc += d;
        setAssistant(acc);
      },
      onDone: () => {
        setSending(false);
        setStatus(null);
        if (!acc) setAssistant(fail);
      },
      onError: () => {
        setSending(false);
        setStatus(null);
        if (!acc) setAssistant(fail);
      },
    });
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: c.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.intro}>
            <Icon name="sparkles" size={40} color={PRIMARY} />
            <Text style={[styles.introTitle, { color: c.text }]}>Hi, I'm Sero</Text>
            <Text style={[styles.introBody, { color: c.textSecondary }]}>
              Ask me to explain a topic, make flashcards, or quiz you on your decks.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.role === "user"
                ? { backgroundColor: PRIMARY, alignSelf: "flex-end" }
                : { backgroundColor: c.backgroundElement, alignSelf: "flex-start" },
            ]}
          >
            <Text
              selectable
              style={[styles.bubbleText, { color: item.role === "user" ? "#fff" : c.text }]}
            >
              {item.content || (sending ? "..." : "")}
            </Text>
          </View>
        )}
      />

      {status ? <Text style={[styles.status, { color: c.textSecondary }]}>{status}</Text> : null}

      <View style={[styles.inputBar, { borderTopColor: c.backgroundSelected, backgroundColor: c.background }]}>
        <TextInput
          style={[styles.input, { color: c.text, backgroundColor: c.backgroundElement }]}
          placeholder="Message Sero"
          placeholderTextColor={c.textSecondary}
          value={draft}
          onChangeText={setDraft}
          multiline
          editable={!sending}
        />
        <Pressable
          accessibilityLabel="Send"
          onPress={send}
          disabled={sending || !draft.trim()}
          style={({ pressed }) => [
            styles.sendBtn,
            { backgroundColor: PRIMARY, opacity: sending || !draft.trim() ? 0.4 : pressed ? 0.85 : 1 },
          ]}
        >
          <Icon name="send" size={22} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  intro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 80 },
  introTitle: { fontSize: 20, fontWeight: "800" },
  introBody: { fontSize: 14, lineHeight: 20, textAlign: "center", paddingHorizontal: 24 },
  bubble: { maxWidth: "85%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderCurve: "continuous" },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  status: { fontSize: 12, fontStyle: "italic", paddingHorizontal: 16, paddingBottom: 4 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, maxHeight: 120, minHeight: 44, borderRadius: 18, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 11, fontSize: 15, borderCurve: "continuous" },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
