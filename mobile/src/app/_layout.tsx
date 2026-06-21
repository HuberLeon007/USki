import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import { AuthProvider } from "@/lib/auth";

const PRIMARY = "#7c3aed";

/** Brand-tinted navigation themes so headers, tab bars and backgrounds all
 *  match the app palette instead of the framework defaults. */
const lightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: PRIMARY,
    background: Colors.light.background,
    card: Colors.light.background,
    text: Colors.light.text,
    border: Colors.light.backgroundSelected,
    notification: PRIMARY,
  },
};

const darkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: PRIMARY,
    background: Colors.dark.background,
    card: Colors.dark.background,
    text: Colors.dark.text,
    border: Colors.dark.backgroundSelected,
    notification: PRIMARY,
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={isDark ? darkTheme : lightTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="(app)" />
          </Stack>
          <StatusBar style={isDark ? "light" : "dark"} />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
