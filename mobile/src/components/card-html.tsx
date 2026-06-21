import { Image } from "expo-image";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";

import { htmlToText, resolveAssetUrl } from "@/lib/html";

interface Segment {
  type: "text" | "image";
  value: string;
}

/** Split card HTML into ordered text / image segments. */
function parse(html: string): Segment[] {
  const segments: Segment[] = [];
  const re = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const before = htmlToText(html.slice(last, m.index));
    if (before) segments.push({ type: "text", value: before });
    segments.push({ type: "image", value: resolveAssetUrl(m[1]) });
    last = re.lastIndex;
  }
  const tail = htmlToText(html.slice(last));
  if (tail) segments.push({ type: "text", value: tail });
  return segments;
}

/**
 * Renders a card's stored HTML on native: inline images (via expo-image, with
 * dev-host rewriting) interleaved with plain text. Formatting beyond images is
 * flattened to text, which covers the common flashcard case without a heavy
 * HTML engine.
 */
export function CardHtml({
  html,
  textStyle,
  imageHeight = 220,
}: {
  html: string;
  textStyle?: StyleProp<TextStyle>;
  imageHeight?: number;
}) {
  const segments = parse(html);
  if (segments.length === 0) {
    return <Text style={[styles.fallback, textStyle]}>(empty)</Text>;
  }
  return (
    <View style={styles.container}>
      {segments.map((s, i) =>
        s.type === "text" ? (
          <Text key={i} selectable style={textStyle}>
            {s.value}
          </Text>
        ) : (
          <Image
            key={i}
            source={{ uri: s.value }}
            style={[styles.image, { height: imageHeight }]}
            contentFit="contain"
            transition={120}
          />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  image: { width: "100%", borderRadius: 10, backgroundColor: "transparent" },
  fallback: { opacity: 0.6 },
});
