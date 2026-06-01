import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTabStore, useThemeStore } from "@/lib/tabState";

export default function TabsLayout() {
  const { showDashboard } = useTabStore();
  const { theme } = useThemeStore();
  const isStellar = theme === "stellar";

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneContainerStyle: {
          backgroundColor: isStellar ? "#070a18" : "#faf6ef",
        },
        tabBarStyle: {
          backgroundColor: isStellar ? "#070a18" : "#faf6ef", 
          borderTopColor: isStellar ? "rgba(255, 223, 169, 0.08)" : "#d4c5a9", 
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 18,
          paddingTop: 8,
          display: !showDashboard ? "none" : "flex",
        },
        tabBarActiveTintColor: isStellar ? "#ffdfa9" : "#c6604a", 
        tabBarInactiveTintColor: isStellar ? "rgba(255, 223, 169, 0.4)" : "#8b7355", 
        tabBarLabelStyle: {
          fontFamily: "System",
          fontSize: 12,
          fontWeight: "600",
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: string = "";

          if (route.name === "home") {
            iconName = focused ? "book" : "book-outline";
          } else if (route.name === "calendar") {
            iconName = focused ? "calendar" : "calendar-outline";
          } else if (route.name === "settings") {
            iconName = focused ? "settings" : "settings-outline";
          }

          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "日记",
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "日历",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "设置",
        }}
      />
    </Tabs>
  );
}
