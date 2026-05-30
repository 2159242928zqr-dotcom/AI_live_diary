import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTabStore } from "@/lib/tabState";

export default function TabsLayout() {
  const { showDashboard } = useTabStore();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#faf6ef", // card background
          borderTopColor: "#d4c5a9", // vintage border
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 18,
          paddingTop: 8,
          display: !showDashboard ? "none" : "flex",
        },
        tabBarActiveTintColor: "#c6604a", // Clay Red
        tabBarInactiveTintColor: "#8b7355", // Coffee Brown
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
