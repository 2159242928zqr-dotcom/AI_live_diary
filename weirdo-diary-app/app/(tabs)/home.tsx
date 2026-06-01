import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  AppState,
  AppStateStatus,
  Platform,
  Dimensions
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { loadAllDiaries } from "@/lib/storage";
import { LocalDiary } from "@/lib/types";
import { DiaryCard } from "@/components/DiaryCard";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StellarBackground } from "@/components/StellarBackground";
import { useTabStore, useThemeStore } from "@/lib/tabState";

const { width, height } = Dimensions.get("window");

export default function HomeScreen() {
  const router = useRouter();
  const [diaries, setDiaries] = useState<LocalDiary[]>([]);
  const { showDashboard, setShowDashboard } = useTabStore();
  const insets = useSafeAreaInsets();
  const { theme } = useThemeStore();
  const styles = getDynamicStyles(theme);
  const isStellar = theme === "stellar";

  // Reset to landing screen (only plus and right arrow) when app is reopened/resumed
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        setShowDashboard(false);
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // Load diaries every time page comes into focus
  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function fetchDiaries() {
        const loaded = await loadAllDiaries();
        const visible = loaded
          .filter((d) => d.status !== "deleted")
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        
        if (active) {
          setDiaries(visible);
        }
      }

      fetchDiaries();

      return () => {
        active = false;
      };
    }, [])
  );

  // 1. 极简着陆页 (仅展示 + 号和右下角右箭头) - 重构为星河磨砂玻璃按键风格
  if (!showDashboard) {
    const landingContent = (
      <View style={[styles.landingContainer, { paddingTop: insets.top, backgroundColor: isStellar ? "transparent" : "#f5f0e8" }]}>
        {/* 中央加号按钮 */}
        <View style={styles.startCenter}>
          <TouchableOpacity
            style={styles.startPlusButton}
            onPress={() => router.push("/upload")}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={isStellar ? 56 : 64} color={isStellar ? "#ffdfa9" : "#faf6ef"} />
            {isStellar && <View style={styles.plusBtnGlow} />}
          </TouchableOpacity>
          <Text style={styles.startTitle}>开启今日记忆胶囊</Text>
        </View>

        {/* 右下角右箭头 */}
        <TouchableOpacity
          style={[styles.startArrowButton, { bottom: insets.bottom + 24 }]}
          onPress={() => setShowDashboard(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-forward" size={20} color={isStellar ? "#ffdfa9" : "#8b7355"} />
        </TouchableOpacity>
      </View>
    );

    if (isStellar) {
      return (
        <View style={{ flex: 1 }}>
          <StellarBackground>{landingContent}</StellarBackground>
        </View>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: "#f5f0e8" }}>
        {landingContent}
      </View>
    );
  }

  // 2. 软件主页工作台 - 升级为深夜星空磨砂玻璃流光卡片风格
  const dashboardContent = (
    <View style={[styles.dashboardContainer, { paddingTop: insets.top, backgroundColor: isStellar ? "transparent" : "#f5f0e8" }]}>
      {/* Header block */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>Memory Vessel</Text>
          <Text style={styles.tagline}>封存当下的温热与瞬间</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/upload")}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={isStellar ? 22 : 24} color={isStellar ? "#0c1324" : "#faf6ef"} />
        </TouchableOpacity>
      </View>

      {/* Diaries deck list */}
      <FlatList
        data={diaries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DiaryCard
            diary={item}
            onPress={() => router.push(`/diary/${item.id}`)}
          />
        )}
        contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="journal-outline" size={48} color={isStellar ? "#ffdfa9" : "#d4c5a9"} />
              {isStellar && <View style={styles.emptyIconGlow} />}
            </View>
            <Text style={styles.emptyText}>还没有日记呢</Text>
            <Text style={styles.emptySubtext}>
              {isStellar ? "点击右上角的 + 按钮，封存第一枚记忆胶囊吧" : "点击右上角的 + 按钮，翻开新一页吧"}
            </Text>
          </View>
        }
      />
    </View>
  );

  if (isStellar) {
    return (
      <View style={{ flex: 1 }}>
        <StellarBackground>
          {dashboardContent}
        </StellarBackground>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: "#f5f0e8" }}>
      {dashboardContent}
    </View>
  );
}

const staticStyles = StyleSheet.create({
  // Landing/minimalist welcome cover styles
  landingContainer: {
    flex: 1,
    position: "relative",
  },
  startCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  startPlusButton: {
    backgroundColor: "rgba(255, 223, 169, 0.05)",
    borderWidth: 2,
    borderColor: "rgba(255, 216, 143, 0.25)",
    width: 130,
    height: 130,
    borderRadius: 65,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
    marginBottom: 28,
  },
  plusBtnGlow: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#ffdfa9",
    opacity: 0.08,
  },
  startTitle: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 15,
    color: "#ffdf9f",
    fontWeight: "700",
    fontStyle: "italic",
    letterSpacing: 2,
  },
  startArrowButton: {
    position: "absolute",
    right: 24,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 223, 169, 0.2)",
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },

  // Dashboard styles
  dashboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255, 223, 169, 0.08)",
  },
  appTitle: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 22,
    fontWeight: "800",
    color: "#ffdfa9",
    letterSpacing: 1.2,
  },
  tagline: {
    fontSize: 10,
    color: "rgba(255, 223, 169, 0.5)",
    marginTop: 3,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  addButton: {
    backgroundColor: "#ffdfa9",
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#ffdfa9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  listContainer: {
    paddingVertical: 12,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    marginTop: height * 0.18,
  },
  emptyIconContainer: {
    position: "relative",
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyIconGlow: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#ffdfa9",
    opacity: 0.1,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffdfa9",
  },
  emptySubtext: {
    fontSize: 11,
    color: "rgba(255, 223, 169, 0.5)",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 16,
  },
});

const getDynamicStyles = (theme: "stellar" | "kraft") => {
  const isStellar = theme === "stellar";
  return {
    ...staticStyles,
    dashboardContainer: {
      ...staticStyles.dashboardContainer,
      backgroundColor: isStellar ? "transparent" : "#f5f0e8",
    },
    header: {
      ...staticStyles.header,
      borderBottomColor: isStellar ? "rgba(255, 223, 169, 0.08)" : "#ede4d5",
      borderBottomWidth: isStellar ? 0.5 : 1,
    },
    appTitle: {
      ...staticStyles.appTitle,
      color: isStellar ? "#ffdfa9" : "#2c1810",
      fontFamily: isStellar ? (Platform.OS === "ios" ? "Georgia" : "serif") : "System",
      fontSize: isStellar ? 22 : 24,
      letterSpacing: isStellar ? 1.2 : 0,
    },
    tagline: {
      ...staticStyles.tagline,
      color: isStellar ? "rgba(255, 223, 169, 0.5)" : "#8b7355",
      fontSize: isStellar ? 10 : 11,
      marginTop: isStellar ? 3 : 2,
    },
    addButton: {
      ...staticStyles.addButton,
      backgroundColor: isStellar ? "#ffdfa9" : "#c6604a",
      width: isStellar ? 38 : 42,
      height: isStellar ? 38 : 42,
      borderRadius: isStellar ? 19 : 21,
      shadowColor: isStellar ? "#ffdfa9" : "#c6604a",
    },
    startPlusButton: {
      ...staticStyles.startPlusButton,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.05)" : "#c6604a",
      borderWidth: isStellar ? 2 : 0,
      borderColor: isStellar ? "rgba(255, 216, 143, 0.25)" : "transparent",
      width: isStellar ? 130 : 140,
      height: isStellar ? 130 : 140,
      borderRadius: isStellar ? 65 : 70,
      shadowColor: isStellar ? "#8b5cf6" : "#c6604a",
    },
    startTitle: {
      ...staticStyles.startTitle,
      color: isStellar ? "#ffdf9f" : "#8b7355",
      fontFamily: isStellar ? (Platform.OS === "ios" ? "Georgia" : "serif") : "System",
      fontStyle: (isStellar ? "italic" : "normal") as any,
    },
    startArrowButton: {
      ...staticStyles.startArrowButton,
      backgroundColor: isStellar ? "rgba(255, 255, 255, 0.06)" : "#faf6ef",
      borderWidth: 1,
      borderColor: isStellar ? "rgba(255, 223, 169, 0.2)" : "#d4c5a9",
      shadowColor: isStellar ? "#000" : "#2c1810",
    },
    emptyText: {
      ...staticStyles.emptyText,
      color: isStellar ? "#ffdfa9" : "#8b7355",
      fontSize: isStellar ? 16 : 18,
    },
    emptySubtext: {
      ...staticStyles.emptySubtext,
      color: isStellar ? "rgba(255, 223, 169, 0.5)" : "#8b7355",
      opacity: isStellar ? 1 : 0.7,
      marginTop: isStellar ? 8 : 6,
    },
  };
};
