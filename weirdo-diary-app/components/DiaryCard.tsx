import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Platform } from "react-native";
import { LocalDiary } from "@/lib/types";
import { formatDateLabel } from "@/lib/utils";
import { useThemeStore } from "@/lib/tabState";

interface DiaryCardProps {
  diary: LocalDiary;
  onPress?: () => void;
}

export function DiaryCard({ diary, onPress }: DiaryCardProps) {
  const hasTags = diary.eventTag || diary.moodTag;
  const { theme } = useThemeStore();
  const styles = getDynamicStyles(theme);
  const isStellar = theme === "stellar";

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.95}>
      {/* 笔记本左侧线圈效果 - 升级为流光连接线 (Stellar Binder) */}
      <View style={styles.binderContainer}>
        <View style={styles.binderRing} />
        <View style={styles.binderRing} />
        <View style={styles.binderRing} />
        <View style={styles.binderRing} />
      </View>

      {/* 水平左右排版 */}
      <View style={styles.cardRow}>
        {/* 左侧：日记图片 */}
        {diary.imagePath ? (
          <View style={styles.thumbnailFrame}>
            <Image source={{ uri: diary.imagePath }} style={styles.thumbnailImage} />
            <View style={styles.thumbnailGlassRim} />
          </View>
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Text style={styles.placeholderText}>日记图片</Text>
          </View>
        )}

        {/* 右侧：标题、标签、时间及摘要 */}
        <View style={styles.infoArea}>
          {/* 顶部行：标题和时间 */}
          <View style={styles.topRow}>
            <Text style={styles.titleText} numberOfLines={1}>
              {diary.title || "今日记录"}
            </Text>
 
            <Text style={styles.dateText}>
              {formatDateLabel(diary.createdAt)}
            </Text>
          </View>
          
          {/* 标签行 */}
          {hasTags ? (
            <View style={[styles.tagRow, { marginBottom: 8 }]}>
              {diary.eventTag ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{diary.eventTag + "  "}</Text>
                </View>
              ) : null}
              {diary.moodTag ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{diary.moodTag + "  "}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
 
           {/* 底部行：心情摘要 */}
          <Text style={styles.summaryText} numberOfLines={3}>
            {diary.summary || "开启照片对话，封存怪咖日记..."}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
 
const staticStyles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.04)", // 玻璃卡片底板
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 223, 169, 0.15)", // 微弱金色高光描边
    marginVertical: 8,
    marginHorizontal: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
    position: "relative",
    padding: 12,
    paddingLeft: 22, // 为左侧线圈留出空白空间
  },
  binderContainer: {
    position: "absolute",
    top: 14,
    bottom: 14,
    left: 8,
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
    width: 6,
  },
  binderRing: {
    width: 12,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 223, 169, 0.25)", // 金色/紫铜色星云连接线
    borderWidth: 0.8,
    borderColor: "rgba(255, 223, 169, 0.4)",
    marginLeft: -4,
    shadowColor: "#ffdfa9",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  thumbnailFrame: {
    width: 80,
    height: 80,
    borderRadius: 12,
    padding: 2.5,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 223, 169, 0.18)",
    position: "relative",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    resizeMode: "cover",
    backgroundColor: "rgba(7, 10, 24, 0.4)",
  },
  thumbnailGlassRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  thumbnailPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: "rgba(7, 10, 24, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 223, 169, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: 10,
    color: "rgba(255, 223, 169, 0.4)",
    fontWeight: "600",
  },
  infoArea: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  titleText: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 15,
    fontWeight: "700",
    color: "#f8fafc", // Off-white
    flex: 1,
    marginRight: 10,
  },
  tagRow: {
    flexDirection: "row",
    gap: 6,
    flexShrink: 0,
  },
  tag: {
    backgroundColor: "rgba(255, 223, 169, 0.08)", // 玻璃卡片小标签
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.8,
    borderColor: "rgba(255, 223, 169, 0.2)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tagText: {
    fontSize: 9,
    color: "#ffdfa9", // 金色
    fontWeight: "700",
    flexShrink: 0,
  },
  dateText: {
    fontSize: 11,
    color: "#ffdf9f", 
    fontWeight: "600",
    flexShrink: 0,
  },
  summaryText: {
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255, 223, 169, 0.6)", // 较轻淡金色半透文字
  },
});

const getDynamicStyles = (theme: "stellar" | "kraft") => {
  const isStellar = theme === "stellar";
  return {
    ...staticStyles,
    card: {
      ...staticStyles.card,
      backgroundColor: isStellar ? "rgba(255, 255, 255, 0.04)" : "#faf6ef",
      borderRadius: isStellar ? 16 : 14,
      borderWidth: 1,
      borderColor: isStellar ? "rgba(255, 223, 169, 0.15)" : "#d4c5a9",
      shadowColor: isStellar ? "#000" : "#2c1810",
      shadowOffset: isStellar ? { width: 0, height: 4 } : { width: 0, height: 2 },
      shadowOpacity: isStellar ? 0.2 : 0.08,
      shadowRadius: isStellar ? 8 : 6,
    },
    binderRing: {
      ...staticStyles.binderRing,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.25)" : "#8b7355",
      borderWidth: isStellar ? 0.8 : 0,
      borderColor: isStellar ? "rgba(255, 223, 169, 0.4)" : "transparent",
      opacity: isStellar ? 1 : 0.35,
      shadowColor: isStellar ? "#ffdfa9" : "transparent",
      shadowOpacity: isStellar ? 0.6 : 0,
      shadowRadius: isStellar ? 3 : 0,
    },
    thumbnailFrame: {
      ...staticStyles.thumbnailFrame,
      backgroundColor: isStellar ? "rgba(255, 255, 255, 0.03)" : "#faf6ef",
      borderWidth: isStellar ? 1 : 0,
      borderColor: isStellar ? "rgba(255, 223, 169, 0.18)" : "transparent",
      borderRadius: isStellar ? 12 : 10,
      padding: isStellar ? 2.5 : 0,
    },
    thumbnailImage: {
      ...staticStyles.thumbnailImage,
      backgroundColor: isStellar ? "rgba(7, 10, 24, 0.4)" : "#ede4d5",
      borderRadius: isStellar ? 10 : 8,
    },
    thumbnailGlassRim: {
      ...staticStyles.thumbnailGlassRim,
      display: (isStellar ? "flex" : "none") as any,
    },
    thumbnailPlaceholder: {
      ...staticStyles.thumbnailPlaceholder,
      backgroundColor: isStellar ? "rgba(7, 10, 24, 0.4)" : "#ede4d5",
      borderWidth: isStellar ? 1 : 0,
      borderColor: isStellar ? "rgba(255, 223, 169, 0.12)" : "transparent",
      borderRadius: isStellar ? 12 : 10,
    },
    placeholderText: {
      ...staticStyles.placeholderText,
      color: isStellar ? "rgba(255, 223, 169, 0.4)" : "#8b7355",
      fontSize: isStellar ? 10 : 11,
    },
    titleText: {
      ...staticStyles.titleText,
      color: isStellar ? "#f8fafc" : "#2c1810",
      fontFamily: isStellar ? (Platform.OS === "ios" ? "Georgia" : "serif") : "System",
      fontSize: isStellar ? 15 : 16,
    },
    tag: {
      ...staticStyles.tag,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.08)" : "#e8ddd0",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.2)" : "#d4c5a9",
      borderWidth: isStellar ? 0.8 : 0.5,
      borderRadius: 8,
    },
    tagText: {
      ...staticStyles.tagText,
      color: isStellar ? "#ffdfa9" : "#8b7355",
      fontWeight: (isStellar ? "700" : "600") as any,
    },
    dateText: {
      ...staticStyles.dateText,
      color: isStellar ? "#ffdf9f" : "#8b7355",
    },
    summaryText: {
      ...staticStyles.summaryText,
      color: isStellar ? "rgba(255, 223, 169, 0.6)" : "#2c1810",
      opacity: isStellar ? 1 : 0.75,
      fontSize: isStellar ? 12 : 13,
    },
  };
};
