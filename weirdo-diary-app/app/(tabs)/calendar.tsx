import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { loadAllDiaries } from "@/lib/storage";
import { LocalDiary } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { formatDateLabel } from "@/lib/utils";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeStore } from "@/lib/tabState";
import { StellarBackground } from "@/components/StellarBackground";

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getCalendarCells(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const firstWeekday = (first.getDay() + 6) % 7; // monday is 0
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
}

export default function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useThemeStore();
  const styles = getDynamicStyles(theme);
  const isStellar = theme === "stellar";
  const [cursor, setCursor] = useState(() => new Date());
  const [diaries, setDiaries] = useState<LocalDiary[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const local = new Date();
    const y = local.getFullYear();
    const m = String(local.getMonth() + 1).padStart(2, "0");
    const d = String(local.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  const cells = useMemo(() => getCalendarCells(cursor), [cursor]);
  const weeks = useMemo(() => {
    const result = [];
    for (let i = 0; i < cells.length; i += 7) {
      const week = cells.slice(i, i + 7);
      if (week.some((day) => day !== null)) {
        result.push(week);
      }
    }
    return result;
  }, [cells]);
  const currentMonth = monthKey(cursor);

  // Load diaries on focus
  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function fetchDiaries() {
        const loaded = await loadAllDiaries();
        const visible = loaded.filter((d) => d.status !== "deleted");
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

  const diariesByDate = useMemo(() => {
    return diaries.reduce<Record<string, LocalDiary[]>>((acc, diary) => {
      acc[diary.date] = [...(acc[diary.date] ?? []), diary];
      return acc;
    }, {});
  }, [diaries]);

  const selectedDiaries = diariesByDate[selectedDate] ?? [];

  function changeMonth(offset: number) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  const renderCalendarContent = () => (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: isStellar ? "transparent" : "#f5f0e8" }]}>
      <View style={styles.header}>
        <Text style={styles.appTitle}>记忆日历</Text>
        <Text style={styles.tagline}>在时间中探寻足迹</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.calendarCard}>
          <View style={styles.monthHeader}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthNav}>
              <Ionicons name="chevron-back" size={20} color="#8b7355" />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>
              {cursor.getFullYear()} 年 {cursor.getMonth() + 1} 月
            </Text>
            <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthNav}>
              <Ionicons name="chevron-forward" size={20} color="#8b7355" />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdayRow}>
            {["一", "二", "三", "四", "五", "六", "日"].map((day) => (
              <Text key={day} style={styles.weekdayText}>{day}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {weeks.map((week, weekIndex) => (
              <View key={`week-${weekIndex}`} style={styles.weekRow}>
                {week.map((day, index) => {
                  if (!day) {
                    return <View key={`blank-${index}`} style={styles.cellBlank} />;
                  }

                  const date = `${currentMonth}-${String(day).padStart(2, "0")}`;
                  const dayDiaries = diariesByDate[date] ?? [];
                  const hasDiary = dayDiaries.length > 0;
                  const isSelected = date === selectedDate;
                  
                  const localToday = new Date();
                  const todayStr = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, "0")}-${String(localToday.getDate()).padStart(2, "0")}`;
                  const isToday = date === todayStr;

                  return (
                    <TouchableOpacity
                      key={date}
                      style={[
                        styles.cell,
                        isSelected && styles.cellSelected,
                        hasDiary && !isSelected && styles.cellWithDiary,
                      ]}
                      onPress={() => setSelectedDate(date)}
                      activeOpacity={0.8}
                    >
                      <Text
                        numberOfLines={1}
                        ellipsizeMode="clip"
                        style={[
                          styles.cellText,
                          isSelected && styles.cellTextSelected,
                          isToday && !isSelected && styles.cellTextToday,
                        ]}
                      >
                        {day}
                      </Text>
                      {hasDiary ? (
                        <View
                          style={[
                            styles.dot,
                            isSelected ? styles.dotSelected : styles.dotActive,
                          ]}
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.diarySection}>
          <Text style={styles.sectionHeader}>
            {selectedDate} · {selectedDiaries.length} 篇日记
          </Text>

          {selectedDiaries.length > 0 ? (
            selectedDiaries.map((diary) => (
              <TouchableOpacity
                key={diary.id}
                style={styles.diaryCard}
                onPress={() => router.push(`/diary/${diary.id}`)}
                activeOpacity={0.9}
              >
                {diary.imagePath ? (
                  <Image source={{ uri: diary.imagePath }} style={styles.diaryThumb} />
                ) : null}
                <View style={styles.diaryContent}>
                  <Text style={styles.diaryTitle}>{diary.title || "今日记录"}</Text>
                  <Text style={styles.diarySummary} numberOfLines={2}>
                    {diary.summary}
                  </Text>
                  <View style={styles.tagRow}>
                    {diary.eventTag ? (
                      <View style={[styles.tag, { flexDirection: "row", alignItems: "center" }]}>
                        <Text style={styles.tagText} numberOfLines={1}>{diary.eventTag}</Text>
                      </View>
                    ) : null}
                    {diary.moodTag ? (
                      <View style={[styles.tag, { flexDirection: "row", alignItems: "center" }]}>
                        <Text style={styles.tagText} numberOfLines={1}>{diary.moodTag}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="cafe-outline" size={36} color={isStellar ? "rgba(255, 223, 169, 0.5)" : "#d4c5a9"} />
              <Text style={styles.emptyText}>今天空空如也呢，还没有留下回忆</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );

  if (isStellar) {
    return (
      <View style={{ flex: 1 }}>
        <StellarBackground>
          {renderCalendarContent()}
        </StellarBackground>
      </View>
    );
  }
  return renderCalendarContent();
}

const staticStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f0e8",
  },
  header: {
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
  scrollContent: {
    paddingBottom: 32,
  },
  calendarCard: {
    backgroundColor: "#faf6ef",
    margin: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d4c5a9",
    padding: 12,
    shadowColor: "#2c1810",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  monthNav: {
    padding: 6,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2c1810",
  },
  weekdayRow: {
    flexDirection: "row",
    width: "100%",
    marginBottom: 6,
  },
  weekdayText: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    color: "#8b7355",
    opacity: 0.8,
  },
  grid: {
    width: "100%",
  },
  weekRow: {
    flexDirection: "row",
    width: "100%",
    marginBottom: 4,
  },
  cellBlank: {
    flex: 1,
    aspectRatio: 1.15,
  },
  cell: {
    flex: 1,
    aspectRatio: 1.15,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    position: "relative",
  },
  cellSelected: {
    backgroundColor: "#c6604a",
  },
  cellWithDiary: {
    backgroundColor: "#ede4d5",
  },
  cellText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2c1810",
    textAlign: "center",
    width: "100%",
  },
  cellTextSelected: {
    color: "#faf6ef",
  },
  cellTextToday: {
    color: "#c6604a",
    textDecorationLine: "underline",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: "absolute",
    bottom: 4,
  },
  dotActive: {
    backgroundColor: "#c6604a",
  },
  dotSelected: {
    backgroundColor: "#faf6ef",
  },
  diarySection: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8b7355",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  diaryCard: {
    backgroundColor: "#faf6ef",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d4c5a9",
    marginBottom: 12,
    flexDirection: "row",
    overflow: "hidden",
  },
  diaryThumb: {
    width: 100,
    height: "100%",
    minHeight: 100,
    resizeMode: "cover",
  },
  diaryContent: {
    flex: 1,
    padding: 12,
  },
  diaryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2c1810",
  },
  diarySummary: {
    fontSize: 13,
    color: "#8b7355",
    marginTop: 4,
    lineHeight: 18,
  },
  tagRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 8,
  },
  tag: {
    backgroundColor: "#e8ddd0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tagText: {
    fontSize: 9,
    color: "#8b7355",
    fontWeight: "600",
    flexShrink: 0,
  },
  emptyContainer: {
    backgroundColor: "#faf6ef",
    borderWidth: 1,
    borderColor: "#d4c5a9",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: "#8b7355",
    opacity: 0.6,
  },
});

const getDynamicStyles = (theme: "stellar" | "kraft") => {
  const isStellar = theme === "stellar";
  return {
    ...staticStyles,
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
    },
    tagline: {
      ...staticStyles.tagline,
      color: isStellar ? "rgba(255, 223, 169, 0.5)" : "#8b7355",
      fontSize: isStellar ? 10 : 11,
    },
    calendarCard: {
      ...staticStyles.calendarCard,
      backgroundColor: isStellar ? "rgba(12, 19, 36, 0.8)" : "#faf6ef",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.18)" : "#d4c5a9",
      borderRadius: isStellar ? 24 : 16,
    },
    monthTitle: {
      ...staticStyles.monthTitle,
      color: isStellar ? "#ffdfa9" : "#2c1810",
    },
    weekdayText: {
      ...staticStyles.weekdayText,
      color: isStellar ? "rgba(255, 223, 169, 0.5)" : "#8b7355",
    },
    cell: {
      ...staticStyles.cell,
    },
    cellSelected: {
      ...staticStyles.cellSelected,
      backgroundColor: isStellar ? "#ffdfa9" : "#c6604a",
    },
    cellWithDiary: {
      ...staticStyles.cellWithDiary,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.1)" : "#ede4d5",
    },
    cellText: {
      ...staticStyles.cellText,
      color: isStellar ? "#f8fafc" : "#2c1810",
    },
    cellTextSelected: {
      ...staticStyles.cellTextSelected,
      color: isStellar ? "#0c1324" : "#faf6ef",
    },
    cellTextToday: {
      ...staticStyles.cellTextToday,
      color: isStellar ? "#ffdfa9" : "#c6604a",
    },
    dotActive: {
      ...staticStyles.dotActive,
      backgroundColor: isStellar ? "#ffdfa9" : "#c6604a",
    },
    dotSelected: {
      ...staticStyles.dotSelected,
      backgroundColor: isStellar ? "#0c1324" : "#faf6ef",
    },
    sectionHeader: {
      ...staticStyles.sectionHeader,
      color: isStellar ? "rgba(255, 223, 169, 0.6)" : "#8b7355",
    },
    diaryCard: {
      ...staticStyles.diaryCard,
      backgroundColor: isStellar ? "rgba(12, 19, 36, 0.8)" : "#faf6ef",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.18)" : "#d4c5a9",
      borderRadius: isStellar ? 16 : 12,
    },
    diaryTitle: {
      ...staticStyles.diaryTitle,
      color: isStellar ? "#f8fafc" : "#2c1810",
    },
    diarySummary: {
      ...staticStyles.diarySummary,
      color: isStellar ? "rgba(255, 223, 169, 0.6)" : "#8b7355",
    },
    tag: {
      ...staticStyles.tag,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.08)" : "#e8ddd0",
    },
    tagText: {
      ...staticStyles.tagText,
      color: isStellar ? "#ffdfa9" : "#8b7355",
    },
    emptyContainer: {
      ...staticStyles.emptyContainer,
      backgroundColor: isStellar ? "rgba(12, 19, 36, 0.8)" : "#faf6ef",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.18)" : "#d4c5a9",
    },
    emptyText: {
      ...staticStyles.emptyText,
      color: isStellar ? "rgba(255, 223, 169, 0.5)" : "#8b7355",
    },
  };
};
