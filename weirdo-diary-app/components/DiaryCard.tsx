import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { LocalDiary } from "@/lib/types";
import { formatDateLabel } from "@/lib/utils";

interface DiaryCardProps {
  diary: LocalDiary;
  onPress?: () => void;
}

export function DiaryCard({ diary, onPress }: DiaryCardProps) {
  const hasTags = diary.eventTag || diary.moodTag;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.95}>
      {/* 笔记本左侧线圈效果 */}
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
          <Image source={{ uri: diary.imagePath }} style={styles.thumbnailImage} />
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
            <View style={[styles.tagRow, { marginBottom: 6 }]}>
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
 
const styles = StyleSheet.create({
  card: {
    backgroundColor: "#faf6ef", // 纸张暖白卡片
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d4c5a9", // 纸面边框
    marginVertical: 8,
    marginHorizontal: 16,
    overflow: "hidden",
    shadowColor: "#2c1810", // 咖啡色柔和阴影
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    position: "relative",
    padding: 12,
    paddingLeft: 22, // 为左侧线圈留出空白空间
  },
  binderContainer: {
    position: "absolute",
    top: 12,
    bottom: 12,
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
    backgroundColor: "#8b7355", // 线圈咖啡色
    opacity: 0.35,
    marginLeft: -4,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  thumbnailImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    resizeMode: "cover",
    backgroundColor: "#ede4d5",
  },
  thumbnailPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: "#ede4d5",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: 11,
    color: "#8b7355",
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
  titleAndTags: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    marginRight: 12, // 留出充足间距，防止右侧时间被挤压
  },
  titleText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2c1810", // 深咖啡色
    fontFamily: "System",
    flex: 1, // 占用剩余空间，让标签优先完整显示并防止挤压
    marginRight: 12, // 留出充足间距，防止右侧时间被挤压
  },
  tagRow: {
    flexDirection: "row",
    gap: 4,
    flexShrink: 0, // 标签始终完整显示，不允许被收缩挤压
  },
  tag: {
    backgroundColor: "#e8ddd0", 
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#d4c5a9",
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
  dateText: {
    fontSize: 11,
    color: "#8b7355", 
    fontWeight: "600",
    flexShrink: 0, // 时间（如“周六”等字符）绝对不允许被收缩遮挡
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#2c1810",
    opacity: 0.75,
  },
});
