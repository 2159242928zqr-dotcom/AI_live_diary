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
  ActivityIndicator,
  Platform
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Audio } from "expo-av";
import { getDiary, saveDiary, deleteDiary } from "@/lib/storage";
import { LocalDiary, LocalMessage } from "@/lib/types";
import { formatDateLabel } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { shareDiaryZip } from "@/lib/export";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeStore } from "@/lib/tabState";
import { StellarBackground } from "@/components/StellarBackground";

export default function DiaryDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useThemeStore();
  const styles = getDynamicStyles(theme);
  const isStellar = theme === "stellar";
  const { diaryId } = useLocalSearchParams<{ diaryId: string }>();
  const [diary, setDiary] = useState<LocalDiary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTranscripts, setShowTranscripts] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

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

  const handleShowMenu = () => {
    setShowMenu((prev) => !prev);
  };

  const handleBack = () => {
    if (isEditing) {
      // 退出编辑模式，撤销修改并还原文本
      if (diary) {
        setEditTitle(diary.title);
        setEditSummary(diary.summary || "");
        setEditContent(diary.content || "");
      }
      setIsEditing(false);
    } else {
      // 正常退出：停止语音并返回上一页
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      router.back();
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

  const renderDetailContent = () => (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: isStellar ? "transparent" : "#f5f0e8" }]}>
      {/* 菜单背景点击遮罩：点击其他区域直接关闭菜单 */}
      {showMenu && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        />
      )}

      {/* 右上角三点浮动下拉菜单 */}
      {showMenu && (
        <View style={styles.menuDropdown}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setShowMenu(false);
              handleShare();
            }}
          >
            <Ionicons name="share-social-outline" size={16} color="#8b7355" style={{ marginRight: 8 }} />
            <Text style={styles.menuItemText}>分享日记</Text>
          </TouchableOpacity>
          
          <View style={styles.menuDivider} />
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setShowMenu(false);
              setIsEditing(true);
            }}
          >
            <Ionicons name="create-outline" size={16} color="#8b7355" style={{ marginRight: 8 }} />
            <Text style={styles.menuItemText}>编辑日记</Text>
          </TouchableOpacity>
          
          <View style={styles.menuDivider} />
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setShowMenu(false);
              handleDelete();
            }}
          >
            <Ionicons name="trash-outline" size={16} color="#c6604a" style={{ marginRight: 8 }} />
            <Text style={[styles.menuItemText, { color: "#c6604a" }]}>删除回忆</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#8b7355" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? "编辑日记" : "日记详情"}
        </Text>
        {!isEditing ? (
          <TouchableOpacity onPress={handleShowMenu} style={styles.shareButton}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#8b7355" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 32 }} /> // 保持左右对称
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {diary.imagePath ? (
          <View style={styles.imageCard}>
            <Image source={{ uri: diary.imagePath }} style={styles.diaryImage} />
          </View>
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
                  <View style={[styles.tag, { flexDirection: "row", alignItems: "center" }]}>
                    <Text style={styles.tagText}>{diary.eventTag + "  "}</Text>
                  </View>
                ) : null}
                {diary.moodTag ? (
                  <View style={[styles.tag, { flexDirection: "row", alignItems: "center" }]}>
                    <Text style={styles.tagText}>{diary.moodTag + "  "}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.summaryText}>{diary.summary}</Text>
              
              <View style={styles.divider} />
              
              <Text style={styles.contentText}>{diary.content}</Text>
            </View>
          )}

          {/* Chat transcript log */}
          {diary.messages && diary.messages.length > 0 && (
            <>
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
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );

  if (isStellar) {
    return (
      <View style={{ flex: 1 }}>
        <StellarBackground>
          {renderDetailContent()}
        </StellarBackground>
      </View>
    );
  }
  return renderDetailContent();
}

const staticStyles = StyleSheet.create({
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
  imageCard: {
    backgroundColor: "#faf6ef", // light paper card
    borderWidth: 1,
    borderColor: "#d4c5a9", // paper border
    borderRadius: 16,
    padding: 6,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: "#2c1810", // soft brown shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  diaryImage: {
    width: "100%",
    height: 220,
    borderRadius: 12,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tagText: {
    fontSize: 12,
    color: "#8b7355",
    fontWeight: "600",
    flexShrink: 0,
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
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    zIndex: 999,
  },
  menuDropdown: {
    position: "absolute",
    top: 56, // 直接挂在 header 下方
    right: 16,
    backgroundColor: "#faf6ef", // warm paper card background
    borderWidth: 1,
    borderColor: "#d4c5a9",
    borderRadius: 12,
    paddingVertical: 4,
    width: 140,
    zIndex: 1000,
    shadowColor: "#2c1810",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 14,
    color: "#2c1810",
    fontWeight: "600",
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#ede4d5",
    marginHorizontal: 10,
  },
});

const getDynamicStyles = (theme: "stellar" | "kraft") => {
  const isStellar = theme === "stellar";
  return {
    ...staticStyles,
    container: {
      ...staticStyles.container,
      backgroundColor: isStellar ? "transparent" : "#f5f0e8",
    },
    header: {
      ...staticStyles.header,
      borderBottomColor: isStellar ? "rgba(255, 223, 169, 0.08)" : "#ede4d5",
      borderBottomWidth: isStellar ? 0.5 : 1,
    },
    backButton: {
      ...staticStyles.backButton,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.08)" : "#faf6ef",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.12)" : "#d4c5a9",
    },
    headerTitle: {
      ...staticStyles.headerTitle,
      color: isStellar ? "#ffdfa9" : "#2c1810",
      fontFamily: isStellar ? (Platform.OS === "ios" ? "Georgia" : "serif") : "System",
    },
    shareButton: {
      ...staticStyles.shareButton,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.08)" : "#faf6ef",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.12)" : "#d4c5a9",
    },
    notebookPage: {
      ...staticStyles.notebookPage,
      backgroundColor: isStellar ? "rgba(12, 19, 36, 0.8)" : "#faf6ef",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.18)" : "#d4c5a9",
      borderRadius: isStellar ? 24 : 16,
      shadowColor: isStellar ? "#000" : "#2c1810",
    },
    titleText: {
      ...staticStyles.titleText,
      color: isStellar ? "#f8fafc" : "#2c1810",
      fontFamily: isStellar ? (Platform.OS === "ios" ? "Georgia" : "serif") : "System",
    },
    dateText: {
      ...staticStyles.dateText,
      color: isStellar ? "#ffdf9f" : "#8b7355",
    },
    tag: {
      ...staticStyles.tag,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.08)" : "#ede4d5",
    },
    tagText: {
      ...staticStyles.tagText,
      color: isStellar ? "#ffdfa9" : "#8b7355",
    },
    summaryText: {
      ...staticStyles.summaryText,
      color: isStellar ? "#ffdfa9" : "#2c1810",
      backgroundColor: isStellar ? "rgba(7, 10, 24, 0.55)" : "#f5f0e8",
      borderLeftColor: isStellar ? "#ffdfa9" : "#c6604a",
    },
    divider: {
      ...staticStyles.divider,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.08)" : "#ede4d5",
    },
    sectionTitle: {
      ...staticStyles.sectionTitle,
      color: isStellar ? "rgba(255, 223, 169, 0.6)" : "#8b7355",
    },
    contentText: {
      ...staticStyles.contentText,
      color: isStellar ? "#f8fafc" : "#2c1810",
    },
    transcriptItem: {
      ...staticStyles.transcriptItem,
      backgroundColor: isStellar ? "rgba(7, 10, 24, 0.4)" : "#f5f0e8",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.1)" : "#ede4d5",
    },
    roleText: {
      ...staticStyles.roleText,
      color: isStellar ? "#ffdf9f" : "#8b7355",
    },
    transcriptBody: {
      ...staticStyles.transcriptBody,
      color: isStellar ? "rgba(255, 223, 169, 0.65)" : "#8b7355",
    },
    playBtn: {
      ...staticStyles.playBtn,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.15)" : "#4a7c6b",
    },
    playingBtn: {
      ...staticStyles.playingBtn,
      backgroundColor: isStellar ? "#ffdfa9" : "#c6604a",
    },
    menuDropdown: {
      ...staticStyles.menuDropdown,
      backgroundColor: isStellar ? "rgba(12, 19, 36, 0.95)" : "#faf6ef",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.2)" : "#d4c5a9",
      shadowColor: isStellar ? "#000" : "#2c1810",
    },
    menuItemText: {
      ...staticStyles.menuItemText,
      color: isStellar ? "#f8fafc" : "#2c1810",
    },
    menuDivider: {
      ...staticStyles.menuDivider,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.08)" : "#ede4d5",
    },
  };
};
