import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initStorage } from "@/lib/storage";
import { useThemeStore } from "@/lib/tabState";
import { ThemeProvider, DarkTheme as NavDarkTheme, DefaultTheme as NavDefaultTheme } from "@react-navigation/native";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { setBackgroundColorAsync } from "expo-system-ui";

function RootLayoutContent() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { theme } = useThemeStore();
  const isStellar = theme === "stellar";

  // Initialize storage once
  useEffect(() => {
    initStorage()
      .then(() => useThemeStore.getState().loadTheme())
      .catch(console.error);
  }, []);

  // Monitor auth status and redirect
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(tabs)" || segments[0] === "upload" || segments[0] === "chat" || segments[0] === "diary";

    if (!user && inAuthGroup) {
      // Redirect to login page
      router.replace("/");
    } else if (user && !inAuthGroup) {
      // Redirect to home tab
      router.replace("/(tabs)/home");
    }
  }, [user, loading, segments, router]);

  // Synchronize root background on all platforms to prevent white flashes during transitions
  useEffect(() => {
    const bg = isStellar ? "#070a18" : "#faf6ef";

    // Native: set window/root view background so stack transitions don't show white
    Platform.OS !== "web" && setBackgroundColorAsync(bg).catch(() => {});

    // Web: sync document body and inject override style
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.body.style.backgroundColor = bg;

      const root = document.getElementById("root") || document.getElementById("__next");
      if (root) {
        root.style.backgroundColor = bg;
      }

      const rootDiv = document.querySelector("div[data-reactroot]");
      if (rootDiv instanceof HTMLElement) {
        rootDiv.style.backgroundColor = bg;
      }

      let styleTag = document.getElementById("dynamic-theme-style");
      if (!styleTag) {
        styleTag = document.createElement("style");
        styleTag.id = "dynamic-theme-style";
        document.head.appendChild(styleTag);
      }
      styleTag.textContent = `
        div[style*="background-color: rgb(255, 255, 255)"],
        div[style*="background-color: white"],
        div[style*="background-color:#ffffff"],
        div[style*="background-color: #ffffff"],
        .css-view-175oi2r[style*="background-color: rgb(255, 255, 255)"] {
          background-color: ${bg} !important;
        }
      `;
    }
  }, [isStellar]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: isStellar ? "#070a18" : "#faf6ef",
        },
      }}
    >
      <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: isStellar ? "#070a18" : "#faf6ef" } }} />
      <Stack.Screen name="(tabs)" options={{ contentStyle: { backgroundColor: isStellar ? "#070a18" : "#faf6ef" } }} />
      <Stack.Screen name="upload" options={{ presentation: "modal", contentStyle: { backgroundColor: isStellar ? "#070a18" : "#faf6ef" } }} />
      <Stack.Screen name="chat/[diaryId]" options={{ contentStyle: { backgroundColor: isStellar ? "#070a18" : "#faf6ef" } }} />
      {/* detachPreviousScreen prevents white flash on Android back navigation (keeps the underlying screen attached) */}
      <Stack.Screen name="diary/[diaryId]" options={{ detachPreviousScreen: false, contentStyle: { backgroundColor: isStellar ? "#070a18" : "#faf6ef" } } as any} />
    </Stack>
  );
}

export default function RootLayout() {
  const { theme } = useThemeStore();
  const isStellar = theme === "stellar";

  const StellarNavTheme = {
    ...NavDarkTheme,
    colors: {
      ...NavDarkTheme.colors,
      background: "#070a18",
      card: "#070a18",
      text: "#ffdfa9",
      border: "rgba(255, 223, 169, 0.08)",
    },
  };

  const KraftNavTheme = {
    ...NavDefaultTheme,
    colors: {
      ...NavDefaultTheme.colors,
      background: "#faf6ef",
      card: "#faf6ef",
      text: "#2c1810",
      border: "#d4c5a9",
    },
  };

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={isStellar ? StellarNavTheme : KraftNavTheme}>
          <StatusBar style={isStellar ? "light" : "dark"} />
          <RootLayoutContent />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}


