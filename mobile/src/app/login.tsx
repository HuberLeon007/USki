import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError, sendOtp, verifyOtp } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ServerSettings } from "@/components/server-settings";
import { Colors } from "@/constants/theme";

type Step = "email" | "otp";

const PRIMARY = "#7c3aed"; // USki lila, matches the web primary.

/**
 * Passwordless email-OTP sign-in. Mirrors the web flow: enter an email, receive
 * a 6-digit code, verify it, then the AuthProvider takes over and the launch
 * dispatcher routes into the app.
 */
export default function LoginScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const c = Colors[scheme === "dark" ? "dark" : "light"];
  const { authenticated, signIn } = useAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showServer, setShowServer] = useState(false);

  if (authenticated) return <Redirect href="/" />;

  async function submitEmail() {
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendOtp(value);
      setEmail(value);
      setStep("otp");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitCode() {
    if (code.trim().length < 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await verifyOtp(email, code.trim());
      await signIn(res.access_token, res.refresh_token);
      router.replace("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError("Wrong code. Please try again.");
      else setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={[styles.brand, { color: PRIMARY }]}>USki</Text>
            <Text style={[styles.title, { color: c.text }]}>
              {step === "email" ? "Sign in" : "Check your email"}
            </Text>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              {step === "email"
                ? "We'll email you a one-time code. No password needed."
                : `Enter the 6-digit code we sent to ${email}.`}
            </Text>
          </View>

          {step === "email" ? (
            <TextInput
              style={[styles.input, { color: c.text, borderColor: c.backgroundSelected, backgroundColor: c.backgroundElement }]}
              placeholder="name@example.com"
              placeholderTextColor={c.textSecondary}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              inputMode="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              editable={!loading}
              onChangeText={(t) => {
                setEmail(t);
                setError(null);
              }}
              onSubmitEditing={submitEmail}
              returnKeyType="go"
            />
          ) : (
            <TextInput
              style={[styles.input, styles.code, { color: c.text, borderColor: c.backgroundSelected, backgroundColor: c.backgroundElement }]}
              placeholder="123456"
              placeholderTextColor={c.textSecondary}
              inputMode="numeric"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              maxLength={6}
              value={code}
              editable={!loading}
              autoFocus
              onChangeText={(t) => {
                setCode(t.replace(/\D/g, ""));
                setError(null);
              }}
              onSubmitEditing={submitCode}
              returnKeyType="go"
            />
          )}

          {error ? (
            <Text selectable style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={step === "email" ? submitEmail : submitCode}
            style={({ pressed }) => [styles.button, { backgroundColor: PRIMARY, opacity: loading ? 0.6 : pressed ? 0.85 : 1 }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{step === "email" ? "Continue" : "Verify and sign in"}</Text>
            )}
          </Pressable>

          {step === "otp" && (
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
              style={styles.linkButton}
            >
              <Text style={[styles.linkText, { color: c.textSecondary }]}>Use a different email</Text>
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => setShowServer((v) => !v)}
            style={styles.linkButton}
          >
            <Text style={[styles.linkText, { color: c.textSecondary }]}>
              {showServer ? "Hide connection settings" : "Can't connect? Connection settings"}
            </Text>
          </Pressable>
          {showServer ? <ServerSettings onSaved={() => setError(null)} /> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 16, maxWidth: 460, width: "100%", alignSelf: "center" },
  header: { gap: 6, marginBottom: 8 },
  brand: { fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
  title: { fontSize: 24, fontWeight: "700", marginTop: 8 },
  subtitle: { fontSize: 15, lineHeight: 21 },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    borderCurve: "continuous",
  },
  code: { fontSize: 24, letterSpacing: 8, textAlign: "center", fontVariant: ["tabular-nums"] },
  error: { color: "#ef4444", fontSize: 14 },
  button: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  linkButton: { alignItems: "center", paddingVertical: 8 },
  linkText: { fontSize: 14, fontWeight: "500" },
});
