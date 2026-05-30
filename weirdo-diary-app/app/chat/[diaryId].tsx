import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Audio } from "expo-av";
import { getDiary, saveDiary, saveAudio, deleteDiary } from "@/lib/storage";
import { LocalDiary, LocalMessage, DiaryMessage } from "@/lib/types";
import { apiPost } from "@/lib/api";
import { MessageBubble } from "@/components/MessageBubble";
import { VoiceWave } from "@/components/VoiceWave";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type AiStatus = "idle" | "thinking" | "speaking";

export default function ChatScreen() {
  const router = useRouter();
  const { diaryId } = useLocalSearchParams<{ diaryId: string }>();
  const insets = useSafeAreaInsets();
  const [diary, setDiary] = useState<LocalDiary | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [notice, setNotice] = useState("");
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const locked = isRecording || aiStatus !== "idle";

  useEffect(() => {
    // Enable audio play on iOS / Android in speaker mode
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });

    async function loadDraft() {
      const current = await getDiary(diaryId);
      if (!current) {
        Alert.alert("未找到草稿", "请先上传照片", [
          { text: "返回", onPress: () => router.replace("/(tabs)/home") }
        ]);
        return;
      }
      setDiary(current);
      
      // Start AI opening description
      if (current.messages.length === 0 && current.imagePath) {
        await startAiOpening(current.imagePath);
      } else {
        setMessages(current.messages);
      }
    }

    loadDraft();

    return () => {
      // Clean up sound on unmount using ref to prevent stale closure keeping audio playing after page exit
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch((err) => {
          console.warn("卸载音频失败:", err);
        });
      }
    };
  }, [diaryId]);

  // Scroll to bottom whenever messages list expands
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, aiStatus]);

  const startAiOpening = async (localImagePath: string) => {
    setAiStatus("thinking");
    setNotice("AI 正在解析图片，准备开启对话...");
    try {
      // 1. Read base64 image data URL from device storage
      const base64 = await FileSystemReadBase64(localImagePath);
      const dataUrl = `data:image/jpeg;base64,${base64}`;

      // 2. Request start opening
      const res = await apiPost(`/api/diaries/${diaryId}/start`, {
        imageDataUrl: dataUrl,
      });
      const data = await res.json();
      
      // 3. Process opening response
      const apiMessage = data.assistant_message;
      const localAudioPath = await saveBase64Audio(apiMessage.audioUrl, "ai");

      const localMsg: LocalMessage = {
        id: apiMessage.id,
        role: "assistant",
        inputType: "ai_voice",
        transcript: apiMessage.transcript,
        audioPath: localAudioPath,
        createdAt: apiMessage.createdAt,
      };

      const updatedMessages = [localMsg];
      setMessages(updatedMessages);
      
      // Save current progress locally
      if (diary) {
        await saveDiary({
          ...diary,
          status: "chatting",
          messages: updatedMessages,
        });
      }

      // Play the opening speech
      await playVoiceFile(localMsg);
      setNotice(data.voice_notice || "AI 语音准备完毕，按住麦克风说话。");
    } catch (e: any) {
      setAiStatus("idle");
      setNotice(`AI 看图失败: ${e?.message || e}，请点击重新加载试一试。`);
      console.warn("AI 看图失败:", e);
    }
  };

  const handleSendText = async () => {
    const trimmed = text.trim();
    if (!trimmed || locked) return;

    const userMsg: LocalMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: "user",
      inputType: "text",
      text: trimmed,
      createdAt: new Date().toISOString(),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setText("");
    setAiStatus("thinking");
    setNotice("AI 正在整理您的回答...");

    try {
      const history = nextMessages.map((m) => ({
        role: m.role,
        text: m.text || m.transcript || "",
      }));

      const res = await apiPost(`/api/diaries/${diaryId}/messages/text`, {
        content: trimmed,
        history,
      });
      const data = await res.json();

      const apiMsg = data.assistant_message;
      const localAudioPath = await saveBase64Audio(apiMsg.audioUrl, "ai");

      const assistantMsg: LocalMessage = {
        id: apiMsg.id,
        role: "assistant",
        inputType: "ai_voice",
        transcript: apiMsg.transcript,
        audioPath: localAudioPath,
        createdAt: apiMsg.createdAt,
      };

      const finalMessages = [...nextMessages, assistantMsg];
      setMessages(finalMessages);

      if (diary) {
        await saveDiary({
          ...diary,
          messages: finalMessages,
        });
      }

      await playVoiceFile(assistantMsg);
      setNotice(data.voice_notice || "");
    } catch (e: any) {
      setAiStatus("idle");
      setNotice(`发送失败: ${e?.message || e}，请重试。`);
      console.warn("发送失败:", e);
    }
  };

  const startRecordVoice = async () => {
    if (locked) return;
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("权限不足", "需要麦克风录音权限。");
        return;
      }

      // Configure recording preset
      const recordingInstance = new Audio.Recording();
      await recordingInstance.prepareToRecordAsync({
        android: {
          extension: ".m4a",
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
        },
        ios: {
          extension: ".wav",
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      });

      await recordingInstance.startAsync();
      setRecording(recordingInstance);
      setIsRecording(true);
      setNotice("正在录制音频中，松手即刻发送。");
    } catch (e) {
      setNotice("启动麦克风录音失败。");
    }
  };

  const stopRecordVoice = async () => {
    if (!recording) return;
    setIsRecording(false);
    setAiStatus("thinking");
    setNotice("正在转写您的语音...");

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        throw new Error("录音提取失败");
      }

      // 1. Copy user recording to local audios folder
      const localAudioPath = await saveAudio(uri, "user");

      // 2. Prepare Form payload
      const form = new FormData();
      
      let mimeType = "audio/wav";
      let fileName = "voice-message.wav";
      if (localAudioPath.endsWith(".m4a")) {
        mimeType = "audio/mp4";
        fileName = "voice-message.m4a";
      } else if (localAudioPath.endsWith(".aac")) {
        mimeType = "audio/aac";
        fileName = "voice-message.aac";
      } else if (localAudioPath.endsWith(".amr")) {
        mimeType = "audio/amr";
        fileName = "voice-message.amr";
      }
      
      form.append("audio", {
        uri: Platform.OS === "ios" ? localAudioPath.replace("file://", "") : localAudioPath,
        type: mimeType,
        name: fileName,
      } as any);

      const history = messages.map((m) => ({
        role: m.role,
        text: m.text || m.transcript || "",
      }));
      form.append("history", JSON.stringify(history));

      // 3. Post to backend voice handler
      const res = await apiPost(`/api/diaries/${diaryId}/messages/voice`, form);
      const data = await res.json();

      // 4. Save response messages
      const apiUserMsg = data.user_message;
      const apiAssistantMsg = data.assistant_message;

      const userMsg: LocalMessage = {
        id: apiUserMsg.id,
        role: "user",
        inputType: "voice",
        transcript: apiUserMsg.transcript,
        audioPath: localAudioPath,
        createdAt: apiUserMsg.createdAt,
      };

      const localAssistantAudioPath = await saveBase64Audio(apiAssistantMsg.audioUrl, "ai");

      const assistantMsg: LocalMessage = {
        id: apiAssistantMsg.id,
        role: "assistant",
        inputType: "ai_voice",
        transcript: apiAssistantMsg.transcript,
        audioPath: localAssistantAudioPath,
        createdAt: apiAssistantMsg.createdAt,
      };

      const finalMessages = [...messages, userMsg, assistantMsg];
      setMessages(finalMessages);

      if (diary) {
        await saveDiary({
          ...diary,
          messages: finalMessages,
        });
      }

      await playVoiceFile(assistantMsg);
      setNotice(data.voice_notice || "");
    } catch (e: any) {
      setAiStatus("idle");
      setNotice(`录音处理失败: ${e?.message || e}，请重试说话。`);
      console.warn("录音处理失败:", e);
    }
  };

  const playVoiceFile = async (msg: LocalMessage) => {
    if (!msg.audioPath) return;
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }

      setAiStatus("speaking");
      setActiveVoiceId(msg.id);

      // 先创建但不播放，让音频系统稳定下来
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: msg.audioPath },
        { shouldPlay: false }
      );

      soundRef.current = newSound;
      setSound(newSound);
      await new Promise(resolve => setTimeout(resolve, 150));
      await newSound.playAsync();

      newSound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.isLoaded && status.didJustFinish) {
          setAiStatus("idle");
          setActiveVoiceId(null);
          await newSound.unloadAsync().catch(() => {});
          if (soundRef.current === newSound) {
            soundRef.current = null;
          }
          setSound(null);
        }
      });
    } catch (e) {
      setAiStatus("idle");
      setActiveVoiceId(null);
      soundRef.current = null;
    }
  };

  const handleGenerateDiary = async () => {
    if (messages.length === 0 || locked) return;
    
    setAiStatus("thinking");
    setNotice("正在汇聚对话碎片生成日记本...");
    
    try {
      const history = messages.map((m) => ({
        role: m.role,
        text: m.text || m.transcript || "",
      }));

      const res = await apiPost(`/api/diaries/${diaryId}/generate`, {
        messages: history,
      });
      const data = await res.json();
      
      const userTexts = messages
        .filter((m) => m.role === "user")
        .map((m) => m.text || m.transcript)
        .filter(Boolean);

      const title = diary?.title || (userTexts.length > 0 ? "今天留下一段怪咖记忆" : "从照片开始的聊天");
      const summary = data.summary || "一次围绕照片展开的日记聊天，记录当下的真实温度与心跳。";
      
      const content =
        userTexts.length > 0
          ? `今天我从一张照片开始记录。${userTexts.join(" ")} 这些对话片段被整理成一篇温热的日记，像是给今天留下一枚安静的手账书签。`
          : "今天我从一张照片开始记录。画面本身像一个入口，让我慢慢靠近此刻的心情，也把这段小小的时间保存下来。";

      if (diary) {
        const finalDiary: LocalDiary = {
          ...diary,
          title,
          summary,
          content,
          status: "generated",
          messages,
        };
        await saveDiary(finalDiary);
      }

      router.replace(`/diary/${diaryId}`);
    } catch (e) {
      setAiStatus("idle");
      Alert.alert("生成失败", "生成日记出错，请再次尝试。");
    }
  };

  const handleExitChat = () => {
    // 退出时立刻停止可能正在播放的语音
    if (soundRef.current) {
      soundRef.current.stopAsync().catch(() => {});
    }

    if (messages.length === 0) {
      router.back();
      return;
    }

    Alert.alert(
      "退出确认",
      "您正在退出语音聊天，是否将当前对话生成并保存为日记？",
      [
        {
          text: "取消",
          style: "cancel",
        },
        {
          text: "直接退出",
          style: "destructive",
          onPress: async () => {
            if (soundRef.current) {
              soundRef.current.unloadAsync().catch(() => {});
              soundRef.current = null;
            }
            // 彻底删除当前未保存的草稿，防止其在首页自动保存和展示
            await deleteDiary(diaryId);
            router.back();
          },
        },
        {
          text: "保存并退出",
          onPress: async () => {
            if (soundRef.current) {
              soundRef.current.unloadAsync().catch(() => {});
              soundRef.current = null;
            }
            await handleGenerateDiary();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleExitChat} style={styles.backButton}>
            <Ionicons name="close" size={24} color="#8b7355" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI 语音日记本</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.chatArea}>
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {diary?.imagePath && (
              <View style={styles.imageCard}>
                <Image source={{ uri: diary.imagePath }} style={styles.diaryImage} />
              </View>
            )}

            {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

            {messages.map((item) => (
              <MessageBubble
                key={item.id}
                message={item}
                onPlayVoice={playVoiceFile}
                isPlaying={activeVoiceId === item.id}
              />
            ))}

            {aiStatus !== "idle" && aiStatus !== "speaking" ? (
              <View style={styles.thinkingBubble}>
                <ActivityIndicator color="#c6604a" size="small" />
                <Text style={styles.thinkingText}>AI 正在看图写信...</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>

        {/* Input Dock */}
        <View style={styles.inputDock}>
          {/* 1. 文本输入行（在 Dock 上方） */}
          <View style={styles.textInputRow}>
            <TextInput
              style={styles.textInput}
              placeholder={locked ? "请稍候..." : "输入文字也可以说话..."}
              placeholderTextColor="#8b7355"
              value={text}
              onChangeText={setText}
              editable={!locked}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!text.trim() || locked) && styles.disabledButton]}
              onPress={handleSendText}
              disabled={!text.trim() || locked}
            >
              <Ionicons name="send" size={20} color="#faf6ef" />
            </TouchableOpacity>
          </View>

          {/* 2. 控制行：录音与生成日记（在 Dock 下方，确保“生成日记”按钮在右下角，远离发送按钮防止误触） */}
          <View style={styles.dockRow}>
            {/* Voice record button */}
            <TouchableOpacity
              style={[
                styles.voiceButton,
                isRecording && styles.voiceButtonRecording,
                aiStatus !== "idle" && styles.disabledButton,
              ]}
              onPressIn={startRecordVoice}
              onPressOut={stopRecordVoice}
              disabled={aiStatus !== "idle"}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isRecording ? "stop" : "mic"}
                size={26}
                color="#faf6ef"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.finishButton, messages.length === 0 && styles.disabledButton]}
              onPress={handleGenerateDiary}
              disabled={messages.length === 0 || locked}
              activeOpacity={0.8}
            >
              <Text style={styles.finishText}>生成日记</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// Helpers for binary <-> filesystem operations
import { readAsStringAsync, writeAsStringAsync, documentDirectory, EncodingType } from "expo-file-system/legacy";

async function FileSystemReadBase64(path: string): Promise<string> {
  return readAsStringAsync(path, {
    encoding: EncodingType.Base64,
  });
}

async function saveBase64Audio(dataUrl: string, prefix: "user" | "ai"): Promise<string> {
  const [metadata, base64Data] = dataUrl.split(",");
  const binData = base64Data || metadata; // fallback
  const id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const dest = `${documentDirectory}audios/${id}.wav`;
  await writeAsStringAsync(dest, binData, {
    encoding: EncodingType.Base64,
  });
  return dest;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f0e8",
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2c1810",
  },
  chatArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  imageCard: {
    backgroundColor: "#faf6ef",
    borderWidth: 1,
    borderColor: "#d4c5a9",
    borderRadius: 14,
    padding: 6,
    marginBottom: 20,
    shadowColor: "#2c1810",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  diaryImage: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    resizeMode: "cover",
  },
  noticeText: {
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "center",
    color: "#8b7355",
    marginBottom: 16,
    opacity: 0.8,
  },
  thinkingBubble: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#faf6ef",
    borderWidth: 1,
    borderColor: "#d4c5a9",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    marginVertical: 6,
  },
  thinkingText: {
    fontSize: 14,
    color: "#8b7355",
  },
  inputDock: {
    backgroundColor: "#faf6ef",
    borderTopWidth: 1,
    borderTopColor: "#d4c5a9",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 16 : 24,
    gap: 12,
  },
  dockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  voiceButton: {
    backgroundColor: "#c6604a",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#c6604a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  voiceButtonRecording: {
    backgroundColor: "#a0402e",
    transform: [{ scale: 1.1 }],
  },
  finishButton: {
    backgroundColor: "#4a7c6b", // Olive Green
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    shadowColor: "#4a7c6b",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  finishText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#faf6ef",
  },
  textInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    backgroundColor: "#f5f0e8",
    borderWidth: 1,
    borderColor: "#d4c5a9",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#2c1810",
  },
  sendButton: {
    backgroundColor: "#c6604a",
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.5,
  },
});
