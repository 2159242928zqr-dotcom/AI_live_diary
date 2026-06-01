import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from "react-native";
import { useThemeStore } from "@/lib/tabState";

interface TagPickerProps {
  label: string;
  tags: string[];
  selected: string;
  onSelect: (tag: string) => void;
}

export function TagPicker({ label, tags, selected, onSelect }: TagPickerProps) {
  const { theme } = useThemeStore();
  const styles = getDynamicStyles(theme);
  const isStellar = theme === "stellar";
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
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tagText,
                  isSelected ? styles.selectedTagText : styles.unselectedTagText,
                ]}
              >
                {tag + "  "}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const staticStyles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255, 223, 169, 0.6)", // Muted gold
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  scrollContainer: {
    paddingVertical: 4,
  },
  tag: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    marginRight: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  selectedTag: {
    backgroundColor: "rgba(255, 223, 169, 0.18)", // Glass highlight
    borderColor: "rgba(255, 223, 169, 0.45)", // Golden accent border
    shadowColor: "#8b5cf6", // Subtle violet glow
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
  },
  unselectedTag: {
    backgroundColor: "rgba(255, 255, 255, 0.04)", // Muted glass base
    borderColor: "rgba(255, 223, 169, 0.15)", // Muted gold border
  },
  tagText: {
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 0,
    letterSpacing: 0.5,
  },
  selectedTagText: {
    color: "#ffdfa9", // Glowing gold
  },
  unselectedTagText: {
    color: "rgba(255, 223, 169, 0.5)", // Muted gold text
  },
});

const getDynamicStyles = (theme: "stellar" | "kraft") => {
  const isStellar = theme === "stellar";
  return {
    ...staticStyles,
    label: {
      ...staticStyles.label,
      color: isStellar ? "rgba(255, 223, 169, 0.6)" : "#8b7355",
      letterSpacing: isStellar ? 1.5 : 1,
      fontSize: isStellar ? 11 : 12,
      marginBottom: isStellar ? 8 : 6,
    },
    tag: {
      ...staticStyles.tag,
      borderRadius: 20,
      paddingHorizontal: isStellar ? 16 : 14,
      paddingVertical: isStellar ? 8 : 7,
      borderWidth: isStellar ? 1 : 1.5,
    },
    selectedTag: {
      ...staticStyles.selectedTag,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.18)" : "#ede4d5",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.45)" : "#c6604a",
      shadowColor: isStellar ? "#8b5cf6" : "transparent",
      shadowOpacity: isStellar ? 0.3 : 0,
      shadowRadius: isStellar ? 6 : 0,
      elevation: isStellar ? 2 : 0,
    },
    unselectedTag: {
      ...staticStyles.unselectedTag,
      backgroundColor: isStellar ? "rgba(255, 255, 255, 0.04)" : "#faf6ef",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.15)" : "#d4c5a9",
    },
    tagText: {
      ...staticStyles.tagText,
      fontSize: isStellar ? 13 : 14,
      fontWeight: (isStellar ? "700" : "600") as any,
      letterSpacing: isStellar ? 0.5 : 0,
    },
    selectedTagText: {
      ...staticStyles.selectedTagText,
      color: isStellar ? "#ffdfa9" : "#c6604a",
    },
    unselectedTagText: {
      ...staticStyles.unselectedTagText,
      color: isStellar ? "rgba(255, 223, 169, 0.5)" : "#8b7355",
    },
  };
};
