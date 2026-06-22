import { Redirect, useRouter } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/lib/auth";
import { Colors } from "@/constants/theme";

const PRIMARY = "#7c3aed";
const logo = require("../../assets/images/logo.png");

/**
 * First-run welcome screen. Shown before the sign-in form so opening the app
 * feels inviting instead of dropping straight into a login prompt. The brand
 * logo animates in, then a single primary call to action leads to sign-in.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const c = Colors[scheme === "dark" ? "dark" : "light"];
  const { authenticated } = useAuth();

  if (authenticated) return <Redirect href="/" />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
      <View style={styles.content}>
        <Animated.View
          entering={FadeIn.duration(600).springify()}
          style={styles.logoWrap}
        >
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </Animated.View>

        <Animated.Text entering={FadeInDown.delay(250).duration(500)} style={[styles.title, { color: c.text }]}>
          Learn smarter with USki
        </Animated.Text>
        <Animated.Text
          entering={FadeInDown.delay(400).duration(500)}
          style={[styles.subtitle, { color: c.textSecondary }]}
        >
          Spaced-repetition flashcards with a built-in AI tutor that helps you while you study.
        </Animated.Text>
      </View>

      <Animated.View entering={FadeInDown.delay(600).duration(500)} style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/login")}
          style={({ pressed }) => [styles.cta, { backgroundColor: PRIMARY, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.ctaText}>Get started</Text>
        </Pressable>
        <Text style={[styles.fine, { color: c.textSecondary }]}>
          No password needed. We email you a one-time code.
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 14 },
  logoWrap: { marginBottom: 12 },
  logo: { width: 132, height: 132 },
  title: { fontSize: 28, fontWeight: "800", textAlign: "center", letterSpacing: -0.5 },
  subtitle: { fontSize: 16, lineHeight: 23, textAlign: "center", maxWidth: 360 },
  footer: { paddingHorizontal: 24, paddingBottom: 16, gap: 12 },
  cta: {
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
  },
  ctaText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  fine: { fontSize: 13, textAlign: "center" },
});
