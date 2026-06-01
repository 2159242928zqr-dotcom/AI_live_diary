import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LocalMessage } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { VoiceWave } from "./VoiceWave";
import { useThemeStore } from "@/lib/tabState";

interface MessageBubbleProps {
  message: LocalMessage;
  onPlayVoice?: (message: LocalMessage) => void;
  isPlaying?: boolean;
}

export function MessageBubble({ message, onPlayVoice, isPlaying = false }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isVoice = message.inputType === "voice" || message.inputType === "ai_voice";
  const { theme } = useThemeStore();
  const isStellar = theme === "stellar";

  // Dynamic values
  const bubbleStyles = isStellar 
    ? (isUser 
        ? { backgroundColor: "rgba(255, 223, 169, 0.08)", borderColor: "rgba(255, 223, 169, 0.25)" }
        : { backgroundColor: "rgba(139, 92, 246, 0.06)", borderColor: "rgba(139, 92, 246, 0.18)" })
    : (isUser ? styles.userBubble : styles.assistantBubble);

  const textStyle = isStellar
    ? (isUser ? { color: "#ffdfa9" } : { color: "#a78bfa" })
    : (isUser ? styles.userText : styles.assistantText);

  const voiceBtnStyle = isStellar
    ? { backgroundColor: isUser ? "rgba(255, 223, 169, 0.15)" : "rgba(139, 92, 246, 0.15)", borderWidth: 1, borderColor: isUser ? "rgba(255, 223, 169, 0.3)" : "rgba(139, 92, 246, 0.3)" }
    : styles.voiceButton;

  const timeColor = isStellar ? "rgba(255, 223, 169, 0.4)" : "#8b7355";

  return (
    <View style={[styles.wrapper, isUser ? styles.userWrapper : styles.assistantWrapper]}>
      <View
        style={[
          styles.bubble,
          bubbleStyles,
          isVoice && styles.voiceBubble,
        ]}
      >
        {isVoice ? (
          <TouchableOpacity
            style={styles.voiceContainer}
            onPress={() => onPlayVoice?.(message)}
            activeOpacity={0.7}
          >
            <VoiceWave active={isPlaying} color={isStellar ? (isUser ? "#ffdfa9" : "#a78bfa") : (isUser ? "#2c1810" : "#c6604a")} count={5} />
            <View style={[styles.voiceButton, voiceBtnStyle]}>
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={18}
                color={isStellar ? (isUser ? "#ffdfa9" : "#a78bfa") : "#faf6ef"}
              />
            </View>
            {message.transcript && (
              <Text style={[styles.transcriptText, textStyle]}>
                {message.transcript}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <Text style={[styles.text, textStyle]}>
            {message.text}
          </Text>
        )}
      </View>
      <Text style={[styles.timeText, { color: timeColor }]}>
        {new Date(message.createdAt).toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 6,
    maxWidth: "80%",
  },
  userWrapper: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  assistantWrapper: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  userBubble: {
    backgroundColor: "#ede4d5", // deeper paper color
    borderColor: "#d4c5a9",
    borderBottomRightRadius: 2,
  },
  assistantBubble: {
    backgroundColor: "#faf6ef", // light paper card
    borderColor: "#d4c5a9",
    borderBottomLeftRadius: 2,
  },
  voiceBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  voiceContainer: {
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  voiceButton: {
    backgroundColor: "#c6604a",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  text: {
    fontFamily: "System",
    fontSize: 15,
    lineHeight: 22,
  },
  transcriptText: {
    fontFamily: "System",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    fontStyle: "italic",
    opacity: 0.8,
  },
  userText: {
    color: "#2c1810", // dark brown
  },
  assistantText: {
    color: "#c6604a", // clay red
  },
  timeText: {
    fontSize: 10,
    marginTop: 3,
    marginHorizontal: 4,
  },
});
