import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initStorage } from "@/lib/storage";
import { useThemeStore } from "@/lib/tabState";

function RootLayoutContent() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

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

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="upload" options={{ presentation: "modal" }} />
      <Stack.Screen name="chat/[diaryId]" />
      <Stack.Screen name="diary/[diaryId]" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootLayoutContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
