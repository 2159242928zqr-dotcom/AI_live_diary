import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Audio } from "expo-av";
import { getDiary, saveDiary, deleteDiary } from "@/lib/storage";
import { LocalDiary, LocalMessage } from "@/lib/types";
import { formatDateLabel } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { shareDiaryZip } from "@/lib/export";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function DiaryDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { diaryId } = useLocalSearchParams<{ diaryId: string }>();
  const [diary, setDiary] = useState<LocalDiary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTranscripts, setShowTranscripts] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Edit fields
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editContent, setEditContent] = useState("");

  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const soundRef = React.useRef<Audio.Sound | null>(null);
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const current = await getDiary(diaryId);
      if (current) {
        setDiary(current);
        setEditTitle(current.title);
        setEditSummary(current.summary);
        setEditContent(current.content);
      }
      setLoading(false);
    }
    load();

    return () => {
      // 页面销毁时，使用 ref 强制卸载可能正在播放的语音，防止音频跨页面残留播放
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch((err) => {
          console.warn("详情页卸载音频失败:", err);
        });
      }
    };
  }, [diaryId]);

  const handlePlayVoice = async (msg: LocalMessage) => {
    if (!msg.audioPath) return;
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }

      if (activeVoiceId === msg.id) {
        // Pause/stop
        setActiveVoiceId(null);
        return;
      }

      setActiveVoiceId(msg.id);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: msg.audioPath },
        { shouldPlay: true }
      );
      soundRef.current = newSound;
      setSound(newSound);

      newSound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.isLoaded && status.didJustFinish) {
          setActiveVoiceId(null);
          await newSound.unloadAsync().catch(() => {});
          if (soundRef.current === newSound) {
            soundRef.current = null;
          }
          setSound(null);
        }
      });
    } catch (e) {
      setActiveVoiceId(null);
      soundRef.current = null;
    }
  };

  const handleSaveEdit = async () => {
    if (!diary) return;
    try {
      const updated: LocalDiary = {
        ...diary,
        title: editTitle.trim() || "今日记录",
        summary: editSummary.trim(),
        content: editContent.trim(),
      };
      await saveDiary(updated);
      setDiary(updated);
      setIsEditing(false);
      Alert.alert("保存成功", "日记内容已更新。");
    } catch (e) {
      Alert.alert("保存失败", "更新日记出错。");
    }
  };

  const handleDelete = () => {
    Alert.alert("删除回忆", "删除后，图片、录音及聊天记录将从本机彻底抹去，且无法恢复。确认删除吗？", [
      { text: "保留", style: "cancel" },
      {
        text: "确认删除",
        style: "destructive",
        onPress: async () => {
          await deleteDiary(diaryId);
          router.replace("/(tabs)/home");
        },
      },
    ]);
  };

  const handleShare = async () => {
    if (!diary) return;
    try {
      await shareDiaryZip(diary);
    } catch (e) {
      Alert.alert("导出失败", e instanceof Error ? e.message : "未知错误");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#c6604a" size="large" />
      </View>
    );
  }

  if (!diary) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>未找到该日记</Text>
          <TouchableOpacity onPress={() => router.replace("/(tabs)/home")} style={styles.backLink}>
            <Text style={styles.backLinkText}>返回首页</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (soundRef.current) {
              soundRef.current.unloadAsync().catch(() => {});
              soundRef.current = null;
            }
            router.back();
          }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#8b7355" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>日记详情</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
          <Ionicons name="share-social-outline" size={24} color="#8b7355" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {diary.imagePath ? (
          <Image source={{ uri: diary.imagePath }} style={styles.coverImage} />
        ) : null}

        <View style={styles.notebookPage}>
          {isEditing ? (
            <View style={styles.editForm}>
              <Text style={styles.editLabel}>日记标题</Text>
              <TextInput
                style={styles.editInput}
                value={editTitle}
                onChangeText={setEditTitle}
                maxLength={28}
              />

              <Text style={styles.editLabel}>心情摘要</Text>
              <TextInput
                style={[styles.editInput, { height: 80 }]}
                value={editSummary}
                onChangeText={setEditSummary}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.editLabel}>日记正文</Text>
              <TextInput
                style={[styles.editInput, { height: 160 }]}
                value={editContent}
                onChangeText={setEditContent}
                multiline
                numberOfLines={6}
              />

              <View style={styles.editActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
                  <Text style={styles.cancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
                  <Text style={styles.saveText}>保存</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.dateText}>{formatDateLabel(diary.createdAt)}</Text>
              <Text style={styles.titleText}>{diary.title}</Text>

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

              <Text style={styles.summaryText}>{diary.summary}</Text>
              
              <View style={styles.divider} />
              
              <Text style={styles.contentText}>{diary.content}</Text>
              
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.actionButton} onPress={() => setIsEditing(true)}>
                  <Ionicons name="create-outline" size={16} color="#faf6ef" />
                  <Text style={styles.actionButtonText}>编辑</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.deleteBtn]} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={16} color="#faf6ef" />
                  <Text style={styles.actionButtonText}>删除</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Chat transcript log */}
          <View style={styles.transcriptHeader}>
            <Text style={styles.sectionTitle}>原始聊天轨迹</Text>
            <TouchableOpacity onPress={() => setShowTranscripts(!showTranscripts)}>
              <Text style={styles.toggleText}>{showTranscripts ? "隐藏转文字" : "显示转文字"}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.transcriptList}>
            {diary.messages.map((msg) => {
              const isAssistant = msg.role === "assistant";
              const isVoice = msg.inputType === "voice" || msg.inputType === "ai_voice";
              const isPlaying = activeVoiceId === msg.id;

              return (
                <View key={msg.id} style={styles.transcriptItem}>
                  <View style={styles.itemHeader}>
                    <View style={styles.meta}>
                      <Text style={styles.roleText}>{isAssistant ? "AI 语音" : "我的语音"}</Text>
                    </View>
                    {isVoice ? (
                      <TouchableOpacity
                        style={[styles.playBtn, isPlaying && styles.playingBtn]}
                        onPress={() => handlePlayVoice(msg)}
                      >
                        <Ionicons
                          name={isPlaying ? "pause" : "play"}
                          size={14}
                          color="#faf6ef"
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  
                  {showTranscripts && msg.transcript ? (
                    <Text style={styles.transcriptBody}>{msg.transcript}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f0e8",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#f5f0e8",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ede4d5",
  },
  backButton: {
    padding: 4,
  },
  shareButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2c1810",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  coverImage: {
    width: "100%",
    height: 280,
    resizeMode: "cover",
  },
  notebookPage: {
    backgroundColor: "#faf6ef",
    borderWidth: 1,
    borderColor: "#d4c5a9",
    borderRadius: 16,
    margin: 16,
    padding: 16,
    shadowColor: "#2c1810",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  dateText: {
    fontSize: 13,
    color: "#8b7355",
    fontWeight: "600",
  },
  titleText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#2c1810",
    marginTop: 6,
  },
  tagRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
  },
  tag: {
    backgroundColor: "#ede4d5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  tagText: {
    fontSize: 12,
    color: "#8b7355",
    fontWeight: "600",
  },
  summaryText: {
    fontSize: 15,
    fontStyle: "italic",
    lineHeight: 22,
    color: "#8b7355",
    backgroundColor: "#f5f0e8",
    padding: 12,
    borderRadius: 10,
    marginTop: 16,
    borderLeftWidth: 3,
    borderLeftColor: "#c6604a",
  },
  divider: {
    height: 1,
    backgroundColor: "#ede4d5",
    marginVertical: 20,
  },
  contentText: {
    fontSize: 16,
    lineHeight: 26,
    color: "#2c1810",
    fontFamily: "System",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#4a7c6b", // Olive Green
    borderRadius: 10,
    paddingVertical: 12,
  },
  deleteBtn: {
    backgroundColor: "#c6604a", // Clay Red
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#faf6ef",
  },
  editForm: {
    gap: 12,
  },
  editLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8b7355",
  },
  editInput: {
    backgroundColor: "#f5f0e8",
    borderColor: "#d4c5a9",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#2c1810",
    textAlignVertical: "top",
  },
  editActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#8b7355",
    borderRadius: 10,
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 14,
    color: "#8b7355",
    fontWeight: "700",
  },
  saveBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4a7c6b",
    borderRadius: 10,
    paddingVertical: 12,
  },
  saveText: {
    fontSize: 14,
    color: "#faf6ef",
    fontWeight: "700",
  },
  transcriptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: "#ede4d5",
    paddingTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2c1810",
  },
  toggleText: {
    fontSize: 13,
    color: "#c6604a",
    fontWeight: "600",
  },
  transcriptList: {
    gap: 10,
  },
  transcriptItem: {
    backgroundColor: "#f5f0e8",
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "#d4c5a9",
    padding: 12,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
  },
  roleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8b7355",
  },
  playBtn: {
    backgroundColor: "#8b7355",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  playingBtn: {
    backgroundColor: "#c6604a",
  },
  transcriptBody: {
    fontSize: 13,
    lineHeight: 18,
    color: "#2c1810",
    marginTop: 8,
    fontStyle: "italic",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#8b7355",
  },
  backLink: {
    marginTop: 16,
  },
  backLinkText: {
    color: "#c6604a",
    fontWeight: "700",
  },
});
