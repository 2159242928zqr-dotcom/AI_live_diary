import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  AppState,
  AppStateStatus
} from "react-native";
import { useRouter, useFocusEffect, useNavigation } from "expo-router";
import { loadAllDiaries } from "@/lib/storage";
import { LocalDiary } from "@/lib/types";
import { DiaryCard } from "@/components/DiaryCard";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTabStore } from "@/lib/tabState";

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [diaries, setDiaries] = useState<LocalDiary[]>([]);
  const { showDashboard, setShowDashboard } = useTabStore();
  const insets = useSafeAreaInsets();

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

  // 1. 极简着陆页 (仅展示 + 号和右下角右箭头)
  if (!showDashboard) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* 中央加号按钮 */}
        <View style={styles.startCenter}>
          <TouchableOpacity
            style={styles.startPlusButton}
            onPress={() => router.push("/upload")}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={64} color="#faf6ef" />
          </TouchableOpacity>
          <Text style={styles.startTitle}>开启今日日记记录</Text>
        </View>

        {/* 右下角右箭头 */}
        <TouchableOpacity
          style={styles.startArrowButton}
          onPress={() => setShowDashboard(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-forward" size={24} color="#c6604a" />
        </TouchableOpacity>
      </View>
    );
  }

  // 2. 软件主页工作台
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>怪咖日记</Text>
          <Text style={styles.tagline}>用照片和语音封存今天</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/upload")}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={24} color="#faf6ef" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={diaries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DiaryCard
            diary={item}
            onPress={() => router.push(`/diary/${item.id}`)}
          />
        )}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="book-outline" size={64} color="#d4c5a9" style={styles.emptyIcon} />
            <Text style={styles.emptyText}>还没有日记呢</Text>
            <Text style={styles.emptySubtext}>点击右上角的 + 按钮，翻开新一页吧</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f0e8", // Warm background
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ede4d5",
  },
  appTitle: {
    fontFamily: "System",
    fontSize: 24,
    fontWeight: "800",
    color: "#2c1810",
  },
  tagline: {
    fontSize: 11,
    color: "#8b7355",
    marginTop: 2,
    fontWeight: "600",
  },
  addButton: {
    backgroundColor: "#c6604a", // Clay Red button
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#c6604a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  listContainer: {
    paddingVertical: 10,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    marginTop: 100,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#8b7355",
  },
  emptySubtext: {
    fontSize: 13,
    color: "#8b7355",
    opacity: 0.7,
    marginTop: 6,
    textAlign: "center",
  },
  /* Landing minimalist styling */
  startCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  startPlusButton: {
    backgroundColor: "#c6604a",
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#c6604a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8,
    marginBottom: 24,
  },
  startTitle: {
    fontSize: 15,
    color: "#8b7355",
    fontWeight: "700",
    letterSpacing: 2,
  },
  startArrowButton: {
    position: "absolute",
    bottom: 24,
    right: 24,
    backgroundColor: "#faf6ef",
    borderWidth: 1,
    borderColor: "#d4c5a9",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2c1810",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
});
