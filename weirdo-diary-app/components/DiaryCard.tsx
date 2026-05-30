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
      {/* Decorative notebook binder spiral at the top left */}
      <View style={styles.binderContainer}>
        <View style={styles.binderRing} />
        <View style={styles.binderRing} />
        <View style={styles.binderRing} />
      </View>

      {diary.imagePath ? (
        <Image source={{ uri: diary.imagePath }} style={styles.coverImage} />
      ) : null}

      <View style={styles.content}>
        <Text style={styles.dateText}>{formatDateLabel(diary.createdAt)}</Text>
        
        <Text style={styles.titleText}>{diary.title || "今日记录"}</Text>
        
        {hasTags ? (
          <View style={styles.tagRow}>
            {diary.eventTag ? (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{diary.eventTag}</Text>
              </View>
            ) : null}
            {diary.moodTag ? (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{diary.moodTag}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.summaryText} numberOfLines={3}>
          {diary.summary}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#faf6ef", // light paper card
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d4c5a9", // paper border
    marginVertical: 8,
    marginHorizontal: 16,
    overflow: "hidden",
    shadowColor: "#2c1810", // soft brown shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    position: "relative",
    paddingTop: 10,
  },
  binderContainer: {
    position: "absolute",
    top: 6,
    left: 20,
    flexDirection: "row",
    gap: 16,
    zIndex: 10,
  },
  binderRing: {
    width: 6,
    height: 12,
    borderRadius: 3,
    backgroundColor: "#8b7355", // Coffee Brown binder wire
    opacity: 0.35,
  },
  coverImage: {
    width: "100%",
    height: 160,
    resizeMode: "cover",
  },
  content: {
    padding: 16,
  },
  dateText: {
    fontSize: 12,
    color: "#8b7355", // Coffee Brown
    fontWeight: "600",
  },
  titleText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2c1810", // Dark Brown
    fontFamily: "System",
    marginTop: 4,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  tag: {
    backgroundColor: "#e8ddd0", // card background
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "#d4c5a9",
  },
  tagText: {
    fontSize: 11,
    color: "#8b7355",
    fontWeight: "600",
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#2c1810",
    opacity: 0.8,
    marginTop: 10,
  },
});
