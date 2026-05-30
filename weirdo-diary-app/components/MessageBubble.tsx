import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LocalMessage } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { VoiceWave } from "./VoiceWave";

interface MessageBubbleProps {
  message: LocalMessage;
  onPlayVoice?: (message: LocalMessage) => void;
  isPlaying?: boolean;
}

export function MessageBubble({ message, onPlayVoice, isPlaying = false }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isVoice = message.inputType === "voice" || message.inputType === "ai_voice";

  return (
    <View style={[styles.wrapper, isUser ? styles.userWrapper : styles.assistantWrapper]}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          isVoice && styles.voiceBubble,
        ]}
      >
        {isVoice ? (
          <TouchableOpacity
            style={styles.voiceContainer}
            onPress={() => onPlayVoice?.(message)}
            activeOpacity={0.7}
          >
            <VoiceWave active={isPlaying} color={isUser ? "#2c1810" : "#c6604a"} count={5} />
            <View style={styles.voiceButton}>
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={18}
                color={isUser ? "#faf6ef" : "#faf6ef"}
              />
            </View>
            {message.transcript && (
              <Text style={[styles.transcriptText, isUser ? styles.userText : styles.assistantText]}>
                {message.transcript}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <Text style={[styles.text, isUser ? styles.userText : styles.assistantText]}>
            {message.text}
          </Text>
        )}
      </View>
      <Text style={styles.timeText}>
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
    color: "#8b7355", // Coffee brown
    marginTop: 3,
    marginHorizontal: 4,
  },
});
