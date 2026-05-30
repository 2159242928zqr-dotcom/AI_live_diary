import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";

interface TagPickerProps {
  label: string;
  tags: string[];
  selected: string;
  onSelect: (tag: string) => void;
}

export function TagPicker({ label, tags, selected, onSelect }: TagPickerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {tags.map((tag) => {
          const isSelected = selected === tag;
          return (
            <TouchableOpacity
              key={tag}
              style={[
                styles.tag,
                isSelected ? styles.selectedTag : styles.unselectedTag,
              ]}
              onPress={() => onSelect(tag)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tagText,
                  isSelected ? styles.selectedTagText : styles.unselectedTagText,
                ]}
              >
                {tag}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8b7355", // Coffee Brown
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  scrollContainer: {
    paddingVertical: 4,
    gap: 8,
  },
  tag: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1.5,
  },
  selectedTag: {
    backgroundColor: "#ede4d5", // deeper paper
    borderColor: "#c6604a", // Clay Red border
  },
  unselectedTag: {
    backgroundColor: "#faf6ef", // light paper card
    borderColor: "#d4c5a9", // vintage border
  },
  tagText: {
    fontSize: 14,
    fontWeight: "600",
  },
  selectedTagText: {
    color: "#c6604a", // Clay Red
  },
  unselectedTagText: {
    color: "#8b7355", // Coffee Brown
  },
});
