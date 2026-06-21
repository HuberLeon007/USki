import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import { listNotifications, markNotificationsSeen, SessionExpiredError, type Notification } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PRIMARY, useColors } from "@/lib/ui";

/** Notifications list; marks everything seen on open (mirrors the web bell). */
export default function NotificationsScreen() {
  const c = useColors();
  const { signOut } = useAuth();
  const [items, setItems] = useState<Notification[] | null>(null);

  useEffect(() => {
    listNotifications()
      .then((list) => {
        setItems(list);
        const unseen = list.filter((n) => !n.seen).map((n) => n.id);
        if (unseen.length) markNotificationsSeen(unseen).catch(() => {});
      })
      .catch(async (err) => {
        if (err instanceof SessionExpiredError) await signOut();
        else setItems([]);
      });
  }, [signOut]);

  if (items === null) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={PRIMARY} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: c.background }}
      data={items}
      keyExtractor={(n) => n.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<Text style={[styles.empty, { color: c.textSecondary }]}>You're all caught up.</Text>}
      renderItem={({ item }) => (
        <View style={[styles.row, { backgroundColor: c.backgroundElement }]}>
          {!item.seen ? <View style={[styles.dot, { backgroundColor: PRIMARY }]} /> : <View style={styles.dotSpacer} />}
          <Text style={[styles.msg, { color: c.text }]}>{item.message}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 14, borderCurve: "continuous" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotSpacer: { width: 8 },
  msg: { flex: 1, fontSize: 14, lineHeight: 20 },
  empty: { textAlign: "center", paddingVertical: 48, fontSize: 14 },
});
