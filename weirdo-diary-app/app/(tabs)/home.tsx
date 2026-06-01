import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  AppState,
  AppStateStatus,
  Platform,
  Dimensions,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  ScrollView,
  KeyboardAvoidingView
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import { loadAllDiaries, savePhoto, saveDiary, deleteDiary, getTagSettings, defaultTagSettings, saveAudio } from "@/lib/storage";
import { LocalDiary, LocalMessage } from "@/lib/types";
import { DiaryCard } from "@/components/DiaryCard";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StellarBackground } from "@/components/StellarBackground";
import { TagPicker } from "@/components/TagPicker";
import { useTabStore, useThemeStore } from "@/lib/tabState";
import { apiPost } from "@/lib/api";
import { readAsStringAsync, writeAsStringAsync, documentDirectory, EncodingType } from "expo-file-system/legacy";

const { width, height } = Dimensions.get("window");
type AiStatus = "idle" | "thinking" | "speaking";

export default function HomeScreen() {
  const router = useRouter();
  const { showDashboard, setShowDashboard } = useTabStore();
  const insets = useSafeAreaInsets();
  const { theme } = useThemeStore();
  const styles = getDynamicStyles(theme);
  const isStellar = theme === "stellar";

  // --- Diaries & Active Today Diary States ---
  const [diaries, setDiaries] = useState<LocalDiary[]>([]);
  const [activeTodayDiary, setActiveTodayDiary] = useState<LocalDiary | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  
  // --- Voice / Chat / Recording States ---
  const [text, setText] = useState("");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [notice, setNotice] = useState("");
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);
  const locked = isRecording || aiStatus !== "idle";

  // --- Pop-up Modal States (Title & Tags Selection) ---
  const [showTagModal, setShowTagModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showPhotoSourceModal, setShowPhotoSourceModal] = useState(false);
  const [showCreateTypeModal, setShowCreateTypeModal] = useState(false);
  const [diaryTitle, setDiaryTitle] = useState("");
  const [selectedEventTag, setSelectedEventTag] = useState("");
  const [selectedMoodTag, setSelectedMoodTag] = useState("");
  const [eventTags, setEventTags] = useState<string[]>(defaultTagSettings.eventTags);
  const [moodTags, setMoodTags] = useState<string[]>(defaultTagSettings.moodTags);
  const [isGenerating, setIsGenerating] = useState(false);

  // --- Stellar Theme Animations States ---
  const [displayedSubtitle, setDisplayedSubtitle] = useState("准备聆听你的声音");
  const subtitleOpacity = useRef(new Animated.Value(1)).current;
  const nebulaRotate1 = useRef(new Animated.Value(0)).current;
  const nebulaRotate2 = useRef(new Animated.Value(0)).current;
  const orbScale = useRef(new Animated.Value(1)).current;
  const ribbonAnim = useRef(new Animated.Value(0)).current;
  
  // Custom Dynamic Waveform heights
  const waveAnims = useRef(Array.from({ length: 6 }, () => new Animated.Value(1))).current;
  const targetSubtitleText = useRef("准备聆听你的声音");

  // Concentric gravity wave ripple rings values
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;
  const ripple3 = useRef(new Animated.Value(0)).current;

  // Reset to landing screen when app is reopened/resumed
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        setShowDashboard(false);
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // Configure Audio Mode on mount & clean up
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });

    // Load tag settings presets
    getTagSettings().then((settings) => {
      setEventTags(settings.eventTags);
      setMoodTags(settings.moodTags);
    });

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch((err) => {
          console.warn("卸载音频失败:", err);
        });
      }
    };
  }, []);

  // Helper for staggering ripples
  const animateRipple = (anim: Animated.Value, delay: number) => {
    return Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 3500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        })
      ])
    );
  };

  // Load diaries and detect today's active draft
  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function fetchDiaries() {
        const loaded = await loadAllDiaries();
        const visible = loaded
          .filter((d) => d.status !== "deleted")
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        
        if (active) {
          setDiaries(visible);

          // Detect today's draft for the Stellar theme
          if (isStellar) {
            const local = new Date();
            const y = local.getFullYear();
            const m = String(local.getMonth() + 1).padStart(2, "0");
            const d = String(local.getDate()).padStart(2, "0");
            const todayDateStr = `${y}-${m}-${d}`;
            
            const todayDraft = visible.find(
              (diary) => 
                diary.date === todayDateStr && 
                diary.status !== "generated" && 
                diary.status !== "deleted"
            );

            if (todayDraft) {
              setActiveTodayDiary(todayDraft);
              setMessages(todayDraft.messages);
              setSelectedEventTag(todayDraft.eventTag || "");
              setSelectedMoodTag(todayDraft.moodTag || "");
              setDiaryTitle(todayDraft.title === "今天留下的一段星夜记忆" ? "" : todayDraft.title);
              
              // Automatically trigger AI opening if no messages exist yet
              if (todayDraft.messages.length === 0 && todayDraft.imagePath) {
                startAiOpening(todayDraft.imagePath, todayDraft.id);
              }
            } else {
              setActiveTodayDiary(null);
              setMessages([]);
            }
          }
        }
      }

      fetchDiaries();

      return () => {
        active = false;
      };
    }, [isStellar])
  );

  // Immersive animations loop
  useEffect(() => {
    // Start background nebula rotations
    const loop1 = Animated.loop(
      Animated.timing(nebulaRotate1, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop1.start();

    const loop2 = Animated.loop(
      Animated.timing(nebulaRotate2, {
        toValue: 1,
        duration: 24000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop2.start();

    // Start ribbon stardust path loop animation
    const loop3 = Animated.loop(
      Animated.sequence([
        Animated.timing(ribbonAnim, {
          toValue: 1,
          duration: 3500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(ribbonAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
        Animated.delay(500),
      ])
    );
    loop3.start();

    // Start Concentric Gravity Ripples
    const rip1 = animateRipple(ripple1, 0);
    const rip2 = animateRipple(ripple2, 1100);
    const rip3 = animateRipple(ripple3, 2200);
    rip1.start();
    rip2.start();
    rip3.start();

    return () => {
      loop1.stop();
      loop2.stop();
      loop3.stop();
      rip1.stop();
      rip2.stop();
      rip3.stop();
    };
  }, []);

  // Handle AI status breath & waveform animations
  useEffect(() => {
    let orbBreath: Animated.CompositeAnimation | null = null;
    let waveLoops: Animated.CompositeAnimation[] = [];

    if (aiStatus === "thinking") {
      orbBreath = Animated.loop(
        Animated.sequence([
          Animated.timing(orbScale, {
            toValue: 1.06,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(orbScale, {
            toValue: 1.0,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          })
        ])
      );
      orbBreath.start();
    } else {
      Animated.spring(orbScale, {
        toValue: 1.0,
        friction: 6,
        useNativeDriver: true,
      }).start();
    }

    // Dynamic wave dance heights
    if (aiStatus === "speaking" || isRecording) {
      waveLoops = waveAnims.map((anim, i) => {
        const bounce = Animated.sequence([
          Animated.timing(anim, {
            toValue: Math.random() * 2.8 + 1.2,
            duration: 180 + i * 40,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0.6,
            duration: 180 + i * 40,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          })
        ]);
        return Animated.loop(bounce);
      });
      Animated.parallel(waveLoops).start();
    } else if (aiStatus === "thinking") {
      waveLoops = waveAnims.map((anim, i) => {
        const pulse = Animated.sequence([
          Animated.timing(anim, {
            toValue: 1.3,
            duration: 800 + i * 100,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0.8,
            duration: 800 + i * 100,
            useNativeDriver: false,
          })
        ]);
        return Animated.loop(pulse);
      });
      Animated.parallel(waveLoops).start();
    } else {
      waveAnims.forEach((anim) => {
        Animated.spring(anim, {
          toValue: 1.0,
          friction: 5,
          useNativeDriver: false,
        }).start();
      });
    }

    return () => {
      if (orbBreath) orbBreath.stop();
      waveLoops.forEach((loop) => loop.stop());
    };
  }, [aiStatus, isRecording]);

  // Premium cross-fade transitions for subtitles
  const updateSubtitleWithFade = (newText: string) => {
    if (targetSubtitleText.current === newText) return;
    targetSubtitleText.current = newText;
    
    Animated.timing(subtitleOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setDisplayedSubtitle(newText);
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  };

  // Direct Image Picker Flow for State 1
  const pickImage = async (useCamera: boolean) => {
    try {
      let result;
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
      };

      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("权限不足", "需要相机使用权限才能拍照。");
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("权限不足", "需要媒体库访问权限才能选择照片。");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets && result.assets[0]) {
        const selectedUri = result.assets[0].uri;
        const savedPhotoPath = await savePhoto(selectedUri);
        
        const local = new Date();
        const y = local.getFullYear();
        const m = String(local.getMonth() + 1).padStart(2, "0");
        const d = String(local.getDate()).padStart(2, "0");
        const todayDateStr = `${y}-${m}-${d}`;
        const now = local.toISOString();
        const newDiaryId = `diary-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        
        const newDraft: LocalDiary = {
          id: newDiaryId,
          title: "今天留下的一段星夜记忆",
          summary: "照片已上传，AI 正在分析画面以语音开启本次日记对话...",
          content: "",
          date: todayDateStr,
          createdAt: now,
          imagePath: savedPhotoPath,
          eventTag: "",
          moodTag: "",
          status: "image_uploaded",
          messages: [],
        };
        
        await saveDiary(newDraft);
        setActiveTodayDiary(newDraft);
        setMessages([]);
        setDiaryTitle("");
        setSelectedEventTag("");
        setSelectedMoodTag("");
        
        startAiOpening(savedPhotoPath, newDiaryId);
      }
    } catch (e) {
      Alert.alert("选择照片失败", "请稍后重试。");
    }
  };

  // AI analysis of image on start
  const startAiOpening = async (localImagePath: string, targetDiaryId: string) => {
    setAiStatus("thinking");
    setNotice("AI 正在解析图片，准备开启对话...");
    updateSubtitleWithFade("AI 正在看图准备对话...");
    try {
      const base64 = await FileSystemReadBase64(localImagePath);
      const dataUrl = `data:image/jpeg;base64,${base64}`;

      const res = await apiPost(`/api/diaries/${targetDiaryId}/start`, {
        imageDataUrl: dataUrl,
      });
      const data = await res.json();
      
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
      
      // Update local storage
      const current = diaries.find(d => d.id === targetDiaryId) || activeTodayDiary;
      if (current) {
        const updatedDiary = {
          ...current,
          status: "chatting" as const,
          messages: updatedMessages,
        };
        await saveDiary(updatedDiary);
        setActiveTodayDiary(updatedDiary);
      }

      setNotice(data.voice_notice || "AI 语音准备完毕，按住麦克风说话。");
      await playVoiceFile(localMsg);
    } catch (e: any) {
      setAiStatus("idle");
      setNotice(`AI 看图失败: ${e?.message || e}，请点击重新加载试一试。`);
      updateSubtitleWithFade("看图失败了，请尝试重新上传或重试");
      console.warn("AI 看图失败:", e);
    }
  };

  // Text message sending
  const handleSendText = async () => {
    const trimmed = text.trim();
    if (!trimmed || locked || !activeTodayDiary) return;

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
    updateSubtitleWithFade("AI 正在记录倾听...");

    try {
      const history = nextMessages.map((m) => ({
        role: m.role,
        text: m.text || m.transcript || "",
      }));

      const res = await apiPost(`/api/diaries/${activeTodayDiary.id}/messages/text`, {
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

      const updatedDiary = {
        ...activeTodayDiary,
        messages: finalMessages,
      };
      await saveDiary(updatedDiary);
      setActiveTodayDiary(updatedDiary);

      setNotice(data.voice_notice || "");
      await playVoiceFile(assistantMsg);
    } catch (e: any) {
      setAiStatus("idle");
      setNotice(`发送失败: ${e?.message || e}，请重试。`);
      updateSubtitleWithFade("发送失败，请重试您的回话");
    }
  };

  // Voice recording & sending functions
  const startRecordVoice = async () => {
    if (locked) return;
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("权限不足", "需要麦克风录音权限。");
        return;
      }

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
      updateSubtitleWithFade("我正在聆听，请尽情倾诉...");
    } catch (e) {
      setNotice("启动麦克风录音失败。");
    }
  };

  const stopRecordVoice = async () => {
    if (!recording || !activeTodayDiary) return;
    setIsRecording(false);
    setAiStatus("thinking");
    setNotice("正在转写您的语音...");
    updateSubtitleWithFade("正在为您转写这段语音...");

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        throw new Error("录音提取失败");
      }

      const localAudioPath = await saveAudio(uri, "user");
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

      const res = await apiPost(`/api/diaries/${activeTodayDiary.id}/messages/voice`, form);
      const data = await res.json();

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

      const updatedDiary = {
        ...activeTodayDiary,
        messages: finalMessages,
      };
      await saveDiary(updatedDiary);
      setActiveTodayDiary(updatedDiary);

      setNotice(data.voice_notice || "");
      await playVoiceFile(assistantMsg);
    } catch (e: any) {
      setAiStatus("idle");
      setNotice(`录音处理失败: ${e?.message || e}，请重试说话。`);
      updateSubtitleWithFade("录音处理失败了，请再次尝试");
    }
  };

  // Play assistant voice file and sync with animation/subtitles
  const playVoiceFile = async (msg: LocalMessage) => {
    if (!msg.audioPath) return;
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }

      setAiStatus("speaking");
      setActiveVoiceId(msg.id);
      
      if (msg.transcript) {
        updateSubtitleWithFade(msg.transcript);
      }

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
          updateSubtitleWithFade("准备聆听你的声音");
        }
      });
    } catch (e) {
      setAiStatus("idle");
      setActiveVoiceId(null);
      soundRef.current = null;
      updateSubtitleWithFade("准备聆听你的声音");
    }
  };

  // Final Compilation of diary with user selected title & tags from popup modal
  const handleGenerateDiary = async () => {
    if (!activeTodayDiary || messages.length === 0 || isGenerating) return;
    
    setIsGenerating(true);
    setNotice("正在汇聚对话碎片生成日记本...");
    updateSubtitleWithFade("正在为您汇聚回忆生成日记手账...");
    
    try {
      const history = messages.map((m) => ({
        role: m.role,
        text: m.text || m.transcript || "",
      }));

      const res = await apiPost(`/api/diaries/${activeTodayDiary.id}/generate`, {
        messages: history,
      });
      const data = await res.json();
      
      const userTexts = messages
        .filter((m) => m.role === "user")
        .map((m) => m.text || m.transcript)
        .filter(Boolean);

      const title = diaryTitle.trim() || "今天留下的一段星夜记忆";
      const summary = data.summary || "一次围绕照片展开的日记聊天，记录当下的真实温度与心跳。";
      
      const content =
        userTexts.length > 0
          ? `今天我从一张照片开始记录。${userTexts.join(" ")} 这些对话片段被整理成一篇温热的日记，像是给今天留下一枚安静的手账书签。`
          : "今天我从一张照片开始记录。画面本身像一个入口，让我慢慢靠近此刻的心情，也把这段小小的时间保存下来。";

      const finalDiary: LocalDiary = {
        ...activeTodayDiary,
        title,
        summary,
        content,
        eventTag: selectedEventTag || "旅行",
        moodTag: selectedMoodTag || "平静",
        status: "generated",
        messages,
      };
      
      await saveDiary(finalDiary);
      setShowTagModal(false);
      
      // Stop any running sound
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      
      router.replace(`/diary/${activeTodayDiary.id}`);
    } catch (e) {
      setAiStatus("idle");
      updateSubtitleWithFade("生成失败，请再次重试");
      Alert.alert("生成失败", "生成日记出错，请再次尝试。");
    } finally {
      setIsGenerating(false);
    }
  };

  // Create a blank manual handwritten diary
  const handleCreateHandwrittenDiary = async () => {
    try {
      const local = new Date();
      const y = local.getFullYear();
      const m = String(local.getMonth() + 1).padStart(2, "0");
      const d = String(local.getDate()).padStart(2, "0");
      const todayDateStr = `${y}-${m}-${d}`;
      const now = local.toISOString();
      const newDiaryId = `diary-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      
      const newDiary: LocalDiary = {
        id: newDiaryId,
        title: "今天的手写日记",
        summary: "手写日记已开启，点击右上角编辑按钮开始记录...",
        content: "",
        date: todayDateStr,
        createdAt: now,
        imagePath: "",
        eventTag: "手写",
        moodTag: "平静",
        status: "generated", // Mark as generated so it's instantly reviewable & editable
        messages: [],
      };
      
      await saveDiary(newDiary);
      router.push(`/diary/${newDiaryId}`);
    } catch (e) {
      Alert.alert("创建失败", "无法创建手写日记，请稍后重试。");
    }
  };

  // Staggered Concentric Gravity Wave Ripple ring interpolates
  const ripple1Scale = ripple1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const ripple1Opacity = ripple1.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.5, 0.22, 0] });

  const ripple2Scale = ripple2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const ripple2Opacity = ripple2.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.5, 0.22, 0] });

  const ripple3Scale = ripple3.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const ripple3Opacity = ripple3.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.5, 0.22, 0] });

  // Stardust ribbon motion - 5 separate staggered flow trails
  const particle1Y = ribbonAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 310] });
  const particle1X = ribbonAnim.interpolate({
    inputRange: [0, 0.3, 0.7, 1],
    outputRange: [width / 2, width / 2 - 25, width / 2 + 15, width / 2]
  });

  const particle2Y = ribbonAnim.interpolate({ inputRange: [0.08, 0.98], outputRange: [200, 310], extrapolate: "clamp" });
  const particle2X = ribbonAnim.interpolate({
    inputRange: [0, 0.4, 0.8, 1],
    outputRange: [width / 2 + 8, width / 2 - 18, width / 2 + 25, width / 2 + 3]
  });

  const particle3Y = ribbonAnim.interpolate({ inputRange: [0.18, 0.98], outputRange: [200, 310], extrapolate: "clamp" });
  const particle3X = ribbonAnim.interpolate({
    inputRange: [0, 0.3, 0.6, 1],
    outputRange: [width / 2 - 15, width / 2 + 20, width / 2 - 22, width / 2 - 4]
  });

  const particle4Y = ribbonAnim.interpolate({ inputRange: [0.04, 0.94], outputRange: [200, 310], extrapolate: "clamp" });
  const particle4X = ribbonAnim.interpolate({
    inputRange: [0, 0.2, 0.7, 1],
    outputRange: [width / 2 + 18, width / 2 - 12, width / 2 + 12, width / 2 + 10]
  });

  const particle5Y = ribbonAnim.interpolate({ inputRange: [0.14, 0.94], outputRange: [200, 310], extrapolate: "clamp" });
  const particle5X = ribbonAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [width / 2 - 8, width / 2 + 16, width / 2]
  });

  // Swirling stars/nebula rotations interpolate
  const spin1 = nebulaRotate1.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const spin2 = nebulaRotate2.interpolate({
    inputRange: [0, 1],
    outputRange: ["360deg", "0deg"],
  });

  // --- RENDER 1: Dashboard Working Desk (History view) ---
  if (showDashboard) {
    return (
      <View style={{ flex: 1 }}>
        {isStellar ? (
          <StellarBackground>
            <View style={[styles.dashboardContainer, { paddingTop: insets.top }]}>
              {/* Header */}
              <View style={styles.header}>
                <View>
                  <Text style={styles.appTitle}>Memory Vessel</Text>
                  <Text style={styles.tagline}>封存当下的温热与瞬间</Text>
                </View>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => setShowCreateTypeModal(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={22} color="#0c1324" />
                </TouchableOpacity>
              </View>

              {/* Deck List */}
              <FlatList
                data={diaries}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <DiaryCard
                    diary={item}
                    onPress={() => router.push(`/diary/${item.id}`)}
                  />
                )}
                contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + 24 }]}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconContainer}>
                      <Ionicons name="journal-outline" size={48} color="#ffdfa9" />
                      <View style={styles.emptyIconGlow} />
                    </View>
                    <Text style={styles.emptyText}>还没有日记呢</Text>
                    <Text style={styles.emptySubtext}>
                      点击右上角的 + 按钮，封存第一枚记忆胶囊吧
                    </Text>
                  </View>
                }
              />
            </View>
          </StellarBackground>
        ) : (
          <View style={{ flex: 1, backgroundColor: "#f5f0e8", paddingTop: insets.top }}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: "#ede4d5", borderBottomWidth: 1 }]}>
              <View>
                <Text style={[styles.appTitle, { color: "#2c1810", fontFamily: "System", fontSize: 24, letterSpacing: 0 }]}>Memory Vessel</Text>
                <Text style={[styles.tagline, { color: "#8b7355", fontSize: 11, marginTop: 2 }]}>封存当下的温热与瞬间</Text>
              </View>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: "#c6604a", width: 42, height: 42, borderRadius: 21, shadowColor: "#c6604a" }]}
                onPress={() => setShowCreateTypeModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={24} color="#faf6ef" />
              </TouchableOpacity>
            </View>

            {/* List */}
            <FlatList
              data={diaries}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <DiaryCard
                  diary={item}
                  onPress={() => router.push(`/diary/${item.id}`)}
                />
              )}
              contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + 24 }]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconContainer}>
                    <Ionicons name="journal-outline" size={48} color="#d4c5a9" />
                  </View>
                  <Text style={[styles.emptyText, { color: "#8b7355", fontSize: 18 }]}>还没有日记呢</Text>
                  <Text style={[styles.emptySubtext, { color: "#8b7355", opacity: 0.7, marginTop: 6 }]}>
                    点击右上角的 + 按钮，翻开新一页吧
                  </Text>
                </View>
              }
            />
          </View>
        )}

        {/* Custom Create Type Selector Modal popup */}
        {showCreateTypeModal && (
          <View style={StyleSheet.absoluteFillObject}>
            <TouchableOpacity 
              style={styles.modalBackdrop} 
              activeOpacity={1} 
              onPress={() => setShowCreateTypeModal(false)}
            />
            <View style={styles.exitModalContainer}>
              <View style={[styles.exitGlassCard, !isStellar && { backgroundColor: "#faf6ef", borderColor: "#d4c5a9" }]}>
                <Ionicons name="journal-outline" size={32} color={isStellar ? "#ffdfa9" : "#c6604a"} style={{ marginBottom: 12 }} />
                <Text style={[styles.exitModalTitle, !isStellar && { color: "#2c1810" }]}>选择日记形式</Text>
                <Text style={[styles.exitModalSub, !isStellar && { color: "#8b7355" }]}>
                  请选择您今天想记录的手账形式：
                </Text>

                <View style={styles.exitButtonColumn}>
                  {/* Option 1: AI Diary */}
                  <TouchableOpacity
                    style={[styles.exitPillKeepBtn, !isStellar && { backgroundColor: "#c6604a" }]}
                    onPress={() => {
                      setShowCreateTypeModal(false);
                      if (isStellar) {
                        setShowDashboard(false);
                        setTimeout(() => {
                          setShowPhotoSourceModal(true);
                        }, 150);
                      } else {
                        router.push("/upload");
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="sparkles" size={16} color={isStellar ? "#0c1324" : "#faf6ef"} style={{ marginRight: 6 }} />
                      <Text style={[styles.exitKeepText, !isStellar && { color: "#faf6ef" }]}>AI 语音日记</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Option 2: Handwritten Diary */}
                  <TouchableOpacity
                    style={[
                      styles.exitPillKeepBtn, 
                      isStellar 
                        ? { backgroundColor: "rgba(255, 223, 169, 0.15)", borderWidth: 1, borderColor: "rgba(255, 223, 169, 0.3)" }
                        : { backgroundColor: "transparent", borderWidth: 1, borderColor: "#d4c5a9" }
                    ]}
                    onPress={() => {
                      setShowCreateTypeModal(false);
                      handleCreateHandwrittenDiary();
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="create-sharp" size={16} color={isStellar ? "#ffdfa9" : "#c6604a"} style={{ marginRight: 6 }} />
                      <Text style={[styles.exitKeepText, { color: isStellar ? "#ffdfa9" : "#c6604a" }]}>手动手写日记</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Option 3: Cancel */}
                  <TouchableOpacity
                    style={styles.exitCancelBtn}
                    onPress={() => setShowCreateTypeModal(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.exitCancelText, !isStellar && { color: "#8b7355" }]}>取消</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  // --- RENDER 2: Stellar (星夜) Immersive Home Screen Portal ---
  if (isStellar) {
    const renderStellarPortal = () => {
      // STATE 1: Pure Cosmic Sphere (Empty Upload state)
      if (!activeTodayDiary) {
        return (
          <View style={[styles.landingContainer, { paddingTop: insets.top }]}>
            {/* Header - Transparent & pure, NO "Memory Vessel" text */}
            <View style={[styles.header, { borderBottomWidth: 0 }]}>
              <View style={{ width: 1 }} />
              <View style={{ width: 1 }} />
            </View>

            {/* Center giant cosmic glass orb */}
            <View style={styles.startCenter}>
              
              {/* Pulsing Concentric Gravity wave ripples */}
              <View style={styles.rippleLayer} pointerEvents="none">
                <Animated.View style={[styles.rippleRing, { transform: [{ scale: ripple1Scale }], opacity: ripple1Opacity }]} />
                <Animated.View style={[styles.rippleRing, { transform: [{ scale: ripple2Scale }], opacity: ripple2Opacity }]} />
                <Animated.View style={[styles.rippleRing, { transform: [{ scale: ripple3Scale }], opacity: ripple3Opacity }]} />
              </View>

              <TouchableOpacity
                onPress={() => setShowPhotoSourceModal(true)}
                activeOpacity={0.85}
              >
                <Animated.View style={[styles.glassOrbContainer, { transform: [{ scale: orbScale }] }]}>
                  {/* Swirling Nebula Layers */}
                  <Animated.View style={[styles.nebulaLayer, styles.purpleNebula, { transform: [{ rotate: spin1 }] }]} />
                  <Animated.View style={[styles.nebulaLayer, styles.blueNebula, { transform: [{ rotate: spin2 }] }]} />
                  
                  {/* Plus Icon in the center */}
                  <Ionicons name="add" size={48} color="#ffdfa9" style={{ opacity: 0.85, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 }} />

                  {/* Highly-polished glass orb highlight border */}
                  <View style={styles.orbHighlightRing} />
                </Animated.View>
              </TouchableOpacity>
              
              <Text style={styles.startTitle}>开启今日记忆胶囊</Text>
            </View>

            {/* Bottom arrow transition button - ONLY in empty welcome state */}
            <TouchableOpacity
              style={[styles.startArrowButton, { bottom: insets.bottom + 24 }]}
              onPress={() => setShowDashboard(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-forward" size={20} color="#ffdfa9" />
            </TouchableOpacity>

            {/* Custom Glassmorphic Image Source Picker Modal popup */}
            {showPhotoSourceModal && (
              <View style={StyleSheet.absoluteFillObject}>
                <TouchableOpacity 
                  style={styles.modalBackdrop} 
                  activeOpacity={1} 
                  onPress={() => setShowPhotoSourceModal(false)}
                />
                <View style={styles.exitModalContainer}>
                  <View style={styles.exitGlassCard}>
                    <Ionicons name="camera-outline" size={32} color="#ffdfa9" style={{ marginBottom: 12 }} />
                    <Text style={styles.exitModalTitle}>今日影像起点</Text>
                    <Text style={styles.exitModalSub}>
                      请选择开启今日日记对话的照片起点，拍照或从系统相册选取：
                    </Text>

                    <View style={styles.exitButtonColumn}>
                      {/* Option 1: Camera */}
                      <TouchableOpacity
                        style={styles.exitPillKeepBtn}
                        onPress={() => {
                          setShowPhotoSourceModal(false);
                          pickImage(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="camera-sharp" size={16} color="#0c1324" style={{ marginRight: 6 }} />
                          <Text style={styles.exitKeepText}>拍照上传</Text>
                        </View>
                      </TouchableOpacity>

                      {/* Option 2: Gallery */}
                      <TouchableOpacity
                        style={[styles.exitPillKeepBtn, { backgroundColor: "rgba(255, 223, 169, 0.15)", borderWidth: 1, borderColor: "rgba(255, 223, 169, 0.3)" }]}
                        onPress={() => {
                          setShowPhotoSourceModal(false);
                          pickImage(false);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="image-sharp" size={16} color="#ffdfa9" style={{ marginRight: 6 }} />
                          <Text style={[styles.exitKeepText, { color: "#ffdfa9" }]}>从相册选择</Text>
                        </View>
                      </TouchableOpacity>

                      {/* Option 3: Cancel */}
                      <TouchableOpacity
                        style={styles.exitCancelBtn}
                        onPress={() => setShowPhotoSourceModal(false)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.exitCancelText}>取消</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        );
      }

      // STATE 2: Immersive Live Portal Chat (Active upload state)
      return (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.portalContainer, { paddingTop: insets.top }]}>
            {/* Header top transparent bar - NO "Memory Vessel" text, just X and Sparkles */}
            <View style={[styles.header, { borderBottomWidth: 0 }]}>
              <TouchableOpacity onPress={() => setShowExitModal(true)} style={styles.backButton}>
                <Ionicons name="close-outline" size={24} color="#ffdfa9" />
              </TouchableOpacity>
              <View style={{ width: 1 }} />
              
              {/* Premium completion icon-only sparkles button */}
              <TouchableOpacity 
                onPress={() => setShowTagModal(true)} 
                style={styles.doneIconBtn}
                activeOpacity={0.8}
              >
                <Ionicons name="sparkles" size={18} color="#ffdfa9" />
              </TouchableOpacity>
            </View>

            {/* Interactive Space Canvas */}
            <View style={styles.interactiveArea}>
              
              {/* Concentric Gravity wave ripples in State 2 */}
              <View style={styles.rippleLayer} pointerEvents="none">
                <Animated.View style={[styles.rippleRing, { transform: [{ scale: ripple1Scale }], opacity: ripple1Opacity }]} />
                <Animated.View style={[styles.rippleRing, { transform: [{ scale: ripple2Scale }], opacity: ripple2Opacity }]} />
                <Animated.View style={[styles.rippleRing, { transform: [{ scale: ripple3Scale }], opacity: ripple3Opacity }]} />
              </View>

              {/* Denser Golden Stardust Ribbon Trails flowing up */}
              {activeTodayDiary.imagePath && (
                <View style={styles.ribbonLayer} pointerEvents="none">
                  <Animated.View style={[styles.ribbonParticle, { top: particle1Y, left: particle1X, opacity: ribbonAnim }]} />
                  <Animated.View style={[styles.ribbonParticle, { top: particle2Y, left: particle2X, opacity: ribbonAnim, width: 3.2, height: 3.2, backgroundColor: "#ffe8bc" }]} />
                  <Animated.View style={[styles.ribbonParticle, { top: particle3Y, left: particle3X, opacity: ribbonAnim, width: 2.8, height: 2.8, backgroundColor: "#fff5df" }]} />
                  <Animated.View style={[styles.ribbonParticle, { top: particle4Y, left: particle4X, opacity: ribbonAnim, width: 3.5, height: 3.5, backgroundColor: "#ffd88f" }]} />
                  <Animated.View style={[styles.ribbonParticle, { top: particle5Y, left: particle5X, opacity: ribbonAnim, width: 3.0, height: 3.0, backgroundColor: "#ffeed0" }]} />
                </View>
              )}

              <View style={styles.starOrbModeContainer}>
                {/* Photo container with high contrast border */}
                {activeTodayDiary.imagePath && (
                  <View style={styles.photoContainer}>
                    <Image source={{ uri: activeTodayDiary.imagePath }} style={styles.diaryImage} />
                    <View style={styles.photoGlowRim} />
                  </View>
                )}

                {/* Giant cosmic glass orb */}
                <Animated.View style={[styles.glassOrbContainer, { transform: [{ scale: orbScale }] }]}>
                  {/* Swirling Nebula Layers */}
                  <Animated.View style={[styles.nebulaLayer, styles.purpleNebula, { transform: [{ rotate: spin1 }] }]} />
                  <Animated.View style={[styles.nebulaLayer, styles.blueNebula, { transform: [{ rotate: spin2 }] }]} />
                  
                  {/* Center dynamic wave ripples */}
                  <View style={styles.centerWaveLayout}>
                    {waveAnims.map((anim, idx) => {
                      const waveHeight = anim.interpolate({
                        inputRange: [0.5, 4],
                        outputRange: [6, 46],
                      });
                      return (
                        <Animated.View 
                          key={idx} 
                          style={[styles.waveBar, { height: waveHeight }]} 
                        />
                      );
                    })}
                  </View>

                  {/* Highly-polished glass orb highlight border */}
                  <View style={styles.orbHighlightRing} />
                </Animated.View>

                {/* Subtitle Dialogue rendering */}
                <Animated.View style={[styles.subtitleContainer, { opacity: subtitleOpacity }]}>
                  <Text style={styles.subtitlePrompt}>“ 记忆正在流入今夜 ”</Text>
                  <Text style={styles.subtitleTranscript}>
                    {displayedSubtitle}
                  </Text>
                </Animated.View>
              </View>

              {/* Poetic system notice */}
              {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
            </View>

            {/* Bottom Glassmorphic Control Panel Dock */}
            <View style={[styles.controlDock, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.typingFieldRow}>
                {/* Glass text input */}
                <TextInput
                  style={styles.glassTextInput}
                  placeholder={locked ? "请稍候..." : "想对星夜说点什么..."}
                  placeholderTextColor="rgba(255, 223, 169, 0.4)"
                  value={text}
                  onChangeText={setText}
                  editable={!locked}
                />
                
                {/* Send Text Button */}
                {text.trim().length > 0 ? (
                  <TouchableOpacity
                    style={[styles.sendTextBtn, locked && styles.disabledBtn]}
                    onPress={handleSendText}
                    disabled={locked}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="send" size={16} color="#0c1324" />
                  </TouchableOpacity>
                ) : null}

                {/* Constant Exquisite Microphone Recording button */}
                <View style={styles.micBtnWrapper}>
                  {isRecording && <View style={styles.micPulseRing} />}
                  <TouchableOpacity
                    style={[
                      styles.glassMicBtn,
                      isRecording && styles.glassMicBtnRecording,
                      aiStatus !== "idle" && styles.disabledBtn,
                    ]}
                    onPressIn={startRecordVoice}
                    onPressOut={stopRecordVoice}
                    disabled={aiStatus !== "idle"}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={isRecording ? "stop" : "mic-sharp"}
                      size={20}
                      color={isRecording ? "#070a18" : "#ffdfa9"}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Custom Glassmorphic Exit Confirmation Modal popup */}
            {showExitModal && (
              <View style={StyleSheet.absoluteFillObject}>
                <TouchableOpacity 
                  style={styles.modalBackdrop} 
                  activeOpacity={1} 
                  onPress={() => setShowExitModal(false)}
                />
                <View style={styles.exitModalContainer}>
                  <View style={styles.exitGlassCard}>
                    <Ionicons name="alert-circle-outline" size={32} color="#ffdfa9" style={{ marginBottom: 12 }} />
                    <Text style={styles.exitModalTitle}>暂存或清空记忆</Text>
                    <Text style={styles.exitModalSub}>
                      您的今日记忆胶囊正在星空下汇聚中... 您可以选择将其暂存，或清空并重新开始今日的记录。
                    </Text>

                    <View style={styles.exitButtonColumn}>
                      {/* Option 1: Keep & exit */}
                      <TouchableOpacity
                        style={styles.exitPillKeepBtn}
                        onPress={() => {
                          if (soundRef.current) {
                            soundRef.current.stopAsync().catch(() => {});
                          }
                          setShowExitModal(false);
                          setShowDashboard(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.exitKeepText}>暂存并查看过去</Text>
                      </TouchableOpacity>

                      {/* Option 2: Clear & restart */}
                      <TouchableOpacity
                        style={styles.exitPillClearBtn}
                        onPress={async () => {
                          if (soundRef.current) {
                            soundRef.current.unloadAsync().catch(() => {});
                            soundRef.current = null;
                          }
                          if (activeTodayDiary) {
                            await deleteDiary(activeTodayDiary.id);
                          }
                          setActiveTodayDiary(null);
                          setMessages([]);
                          setNotice("");
                          setShowExitModal(false);
                          updateSubtitleWithFade("准备聆听你的声音");
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.exitClearText}>清空并重新开始</Text>
                      </TouchableOpacity>

                      {/* Option 3: Cancel */}
                      <TouchableOpacity
                        style={styles.exitCancelBtn}
                        onPress={() => setShowExitModal(false)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.exitCancelText}>取消</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Glassmorphic Tags/Title Pop-up modal */}
            {showTagModal && (
              <View style={StyleSheet.absoluteFillObject}>
                {/* Semi-transparent dark cover */}
                <TouchableOpacity 
                  style={styles.modalBackdrop} 
                  activeOpacity={1} 
                  onPress={() => setShowTagModal(false)}
                />

                <KeyboardAvoidingView 
                  behavior={Platform.OS === "ios" ? "padding" : undefined}
                  style={styles.modalKeyboardAvoiding}
                >
                  <View style={styles.modalGlassCard}>
                    {/* Header */}
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitleText}>汇聚今天的记忆</Text>
                      <TouchableOpacity onPress={() => setShowTagModal(false)} style={styles.modalCloseBtn}>
                        <Ionicons name="close" size={20} color="#ffdfa9" />
                      </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
                      {/* Title Input */}
                      <View style={styles.modalField}>
                        <Text style={styles.modalLabel}>给这篇手账起个怪咖标题</Text>
                        <TextInput
                          style={styles.modalInput}
                          placeholder="例如：海边的下午（选填）"
                          placeholderTextColor="rgba(255, 223, 169, 0.35)"
                          value={diaryTitle}
                          onChangeText={setDiaryTitle}
                          maxLength={28}
                          editable={!isGenerating}
                        />
                      </View>

                      {/* Tag Pickers */}
                      <View style={{ gap: 16 }}>
                        <TagPicker 
                          label="事件分类" 
                          tags={eventTags} 
                          selected={selectedEventTag} 
                          onSelect={setSelectedEventTag} 
                        />
                        <TagPicker 
                          label="情绪状态" 
                          tags={moodTags} 
                          selected={selectedMoodTag} 
                          onSelect={setSelectedMoodTag} 
                        />
                      </View>

                      {/* Final compilation submit button */}
                      <TouchableOpacity
                        style={[styles.modalSubmitBtn, isGenerating && styles.disabledBtn]}
                        onPress={handleGenerateDiary}
                        disabled={isGenerating}
                        activeOpacity={0.8}
                      >
                        {isGenerating ? (
                          <ActivityIndicator color="#0c1324" />
                        ) : (
                          <>
                            <Ionicons name="sparkles" size={16} color="#0c1324" style={{ marginRight: 6 }} />
                            <Text style={styles.modalSubmitText}>开启汇聚</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </ScrollView>
                  </View>
                </KeyboardAvoidingView>
              </View>
            )}

            {/* Custom Glassmorphic Image Source Picker Modal popup */}
            {showPhotoSourceModal && (
              <View style={StyleSheet.absoluteFillObject}>
                <TouchableOpacity 
                  style={styles.modalBackdrop} 
                  activeOpacity={1} 
                  onPress={() => setShowPhotoSourceModal(false)}
                />
                <View style={styles.exitModalContainer}>
                  <View style={styles.exitGlassCard}>
                    <Ionicons name="camera-outline" size={32} color="#ffdfa9" style={{ marginBottom: 12 }} />
                    <Text style={styles.exitModalTitle}>今日影像起点</Text>
                    <Text style={styles.exitModalSub}>
                      请选择开启今日日记对话的照片起点，拍照或从系统相册选取：
                    </Text>

                    <View style={styles.exitButtonColumn}>
                      {/* Option 1: Camera */}
                      <TouchableOpacity
                        style={styles.exitPillKeepBtn}
                        onPress={() => {
                          setShowPhotoSourceModal(false);
                          pickImage(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="camera-sharp" size={16} color="#0c1324" style={{ marginRight: 6 }} />
                          <Text style={styles.exitKeepText}>拍照上传</Text>
                        </View>
                      </TouchableOpacity>

                      {/* Option 2: Gallery */}
                      <TouchableOpacity
                        style={[styles.exitPillKeepBtn, { backgroundColor: "rgba(255, 223, 169, 0.15)", borderWidth: 1, borderColor: "rgba(255, 223, 169, 0.3)" }]}
                        onPress={() => {
                          setShowPhotoSourceModal(false);
                          pickImage(false);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="image-sharp" size={16} color="#ffdfa9" style={{ marginRight: 6 }} />
                          <Text style={[styles.exitKeepText, { color: "#ffdfa9" }]}>从相册选择</Text>
                        </View>
                      </TouchableOpacity>

                      {/* Option 3: Cancel */}
                      <TouchableOpacity
                        style={styles.exitCancelBtn}
                        onPress={() => setShowPhotoSourceModal(false)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.exitCancelText}>取消</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      );
    };

    return (
      <View style={{ flex: 1 }}>
        <StellarBackground>{renderStellarPortal()}</StellarBackground>
      </View>
    );
  }

  // --- RENDER 3: Kraft (手账) Welcome Cover ---
  const landingContent = (
    <View style={[styles.landingContainer, { paddingTop: insets.top, backgroundColor: "#f5f0e8" }]}>
      {/* Central Plus */}
      <View style={styles.startCenter}>
        <TouchableOpacity
          style={styles.startPlusButton}
          onPress={() => router.push("/upload")}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={64} color="#faf6ef" />
        </TouchableOpacity>
        <Text style={styles.startTitle}>开启今日记忆胶囊</Text>
      </View>

      {/* Bottom arrow */}
      <TouchableOpacity
        style={[styles.startArrowButton, { bottom: insets.bottom + 24 }]}
        onPress={() => setShowDashboard(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-forward" size={20} color="#8b7355" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f0e8" }}>
      {landingContent}
    </View>
  );
}

// Helpers for binary <-> filesystem operations
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

const staticStyles = StyleSheet.create({
  landingContainer: {
    flex: 1,
    position: "relative",
  },
  portalContainer: {
    flex: 1,
    position: "relative",
  },
  startCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  startPlusButton: {
    backgroundColor: "#c6604a",
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#c6604a",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
    marginBottom: 28,
  },
  startTitle: {
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
    fontSize: 15,
    color: "#8b7355",
    fontWeight: "700",
    letterSpacing: 2,
  },
  startArrowButton: {
    position: "absolute",
    right: 24,
    backgroundColor: "#faf6ef",
    borderWidth: 1,
    borderColor: "#d4c5a9",
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2c1810",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },

  // Dashboard styles
  dashboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255, 223, 169, 0.08)",
  },
  appTitle: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 22,
    fontWeight: "800",
    color: "#ffdfa9",
    letterSpacing: 1.2,
  },
  tagline: {
    fontSize: 10,
    color: "rgba(255, 223, 169, 0.5)",
    marginTop: 3,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  addButton: {
    backgroundColor: "#ffdfa9",
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#ffdfa9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  listContainer: {
    paddingVertical: 12,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    marginTop: height * 0.18,
  },
  emptyIconContainer: {
    position: "relative",
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyIconGlow: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#ffdfa9",
    opacity: 0.1,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffdfa9",
  },
  emptySubtext: {
    fontSize: 11,
    color: "rgba(255, 223, 169, 0.5)",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 16,
  },

  // --- Stellar Portal State Styles ---
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 223, 169, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 223, 169, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  doneIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 223, 169, 0.12)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 223, 169, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ffdfa9",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 3,
  },
  headerTitle: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 18,
    fontWeight: "700",
    color: "#ffdfa9",
    letterSpacing: 1,
  },
  interactiveArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },

  // Ribbon Dynamic Trails Particles
  ribbonLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  ribbonParticle: {
    position: "absolute",
    width: 4.2,
    height: 4.2,
    borderRadius: 2.1,
    backgroundColor: "#ffdf9f",
    shadowColor: "#ffdf9f",
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 2,
  },

  // Concentric Gravity ripples background layer
  rippleLayer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 0,
  },
  rippleRing: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.0,
    borderColor: "rgba(255, 223, 169, 0.16)",
    shadowColor: "#8b5cf6",
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },

  // Cosmic Sphere Glass Orb
  glassOrbContainer: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(10, 16, 32, 0.45)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 223, 169, 0.18)",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 10,
    marginBottom: 35,
    zIndex: 2,
  },
  orbClickAction: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 223, 169, 0.05)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 223, 169, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    shadowColor: "#ffdfa9",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  nebulaLayer: {
    position: "absolute",
    width: "150%",
    height: "150%",
    borderRadius: 999,
    opacity: 0.42,
  },
  purpleNebula: {
    backgroundColor: "transparent",
    borderWidth: 35,
    borderColor: "rgba(139, 92, 246, 0.14)",
    borderTopColor: "rgba(168, 85, 247, 0.35)",
    borderBottomColor: "rgba(139, 92, 246, 0.3)",
  },
  blueNebula: {
    backgroundColor: "transparent",
    borderWidth: 28,
    borderColor: "rgba(14, 165, 233, 0.12)",
    borderLeftColor: "rgba(56, 189, 248, 0.38)",
    borderRightColor: "rgba(14, 165, 233, 0.25)",
  },
  orbHighlightRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 110,
    borderWidth: 2.2,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderTopColor: "rgba(255, 223, 169, 0.45)",
    borderLeftColor: "rgba(255, 223, 169, 0.2)",
    pointerEvents: "none",
  },
  centerWaveLayout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    gap: 4.5,
    zIndex: 5,
  },
  waveBar: {
    width: 3.5,
    borderRadius: 2,
    backgroundColor: "#ffdfa9",
    minHeight: 6,
    shadowColor: "#ffdfa9",
    shadowOpacity: 0.65,
    shadowRadius: 2,
  },

  // Star Orb Subtitles Panel
  starOrbModeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 24,
  },
  photoContainer: {
    width: 105,
    height: 105,
    borderRadius: 18,
    borderWidth: 1.8,
    borderColor: "rgba(255, 223, 169, 0.35)",
    shadowColor: "#ffdfa9",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 40,
    overflow: "hidden",
    position: "relative",
    zIndex: 3,
  },
  diaryImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  photoGlowRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    pointerEvents: "none",
  },
  subtitleContainer: {
    width: "90%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
  },
  subtitlePrompt: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 14,
    color: "#ffdf9f",
    opacity: 0.65,
    fontStyle: "italic",
    letterSpacing: 2,
    marginBottom: 10,
  },
  subtitleTranscript: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 16,
    color: "#fff5df",
    textAlign: "center",
    lineHeight: 25,
    fontWeight: "600",
    letterSpacing: 0.8,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  noticeText: {
    position: "absolute",
    bottom: 12,
    fontSize: 10.5,
    color: "rgba(255, 223, 169, 0.38)",
    fontWeight: "500",
    textAlign: "center",
    letterSpacing: 0.5,
  },

  // Bottom Control Panel Dock
  controlDock: {
    width: "100%",
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "transparent",
  },
  typingFieldRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(7, 10, 24, 0.72)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 223, 169, 0.15)",
    borderRadius: 24,
    paddingHorizontal: 12,
    height: 52,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  glassTextInput: {
    flex: 1,
    height: "100%",
    fontSize: 14,
    color: "#fff5df",
    paddingLeft: 6,
    letterSpacing: 0.5,
  },
  sendTextBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#ffdfa9",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ffdfa9",
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  disabledBtn: {
    opacity: 0.4,
  },

  // Microphone record button
  micBtnWrapper: {
    position: "relative",
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  glassMicBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 223, 169, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 223, 169, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ffdfa9",
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  glassMicBtnRecording: {
    backgroundColor: "#ffdfa9",
    borderColor: "#ffdfa9",
  },
  micPulseRing: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(255, 223, 169, 0.4)",
    backgroundColor: "rgba(255, 223, 169, 0.15)",
  },

  // --- Custom Glassmorphic Exit Modal popup styles ---
  exitModalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    zIndex: 110,
  },
  exitGlassCard: {
    width: "100%",
    backgroundColor: "rgba(12, 19, 36, 0.98)",
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: "rgba(255, 223, 169, 0.22)",
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 20,
  },
  exitModalTitle: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 18,
    fontWeight: "700",
    color: "#ffdfa9",
    textAlign: "center",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  exitModalSub: {
    fontSize: 12.5,
    color: "rgba(255, 223, 169, 0.65)",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 24,
  },
  exitButtonColumn: {
    width: "100%",
    gap: 12,
  },
  exitPillKeepBtn: {
    width: "100%",
    backgroundColor: "#ffdfa9",
    borderRadius: 20,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ffdfa9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  exitKeepText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0c1324",
    letterSpacing: 0.5,
  },
  exitPillClearBtn: {
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.5)",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderRadius: 20,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  exitClearText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ef4444",
  },
  exitCancelBtn: {
    width: "100%",
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  exitCancelText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 223, 169, 0.5)",
    letterSpacing: 0.5,
  },

  // --- Glassmorphic tags modal popup styles ---
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4, 6, 15, 0.72)",
  },
  modalKeyboardAvoiding: {
    flex: 1,
    justifyContent: "flex-end",
    zIndex: 100,
  },
  modalGlassCard: {
    backgroundColor: "rgba(12, 19, 36, 0.96)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1.2,
    borderColor: "rgba(255, 223, 169, 0.2)",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255, 223, 169, 0.08)",
    paddingBottom: 12,
    marginBottom: 20,
  },
  modalTitleText: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 18,
    fontWeight: "700",
    color: "#ffdfa9",
    letterSpacing: 1,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 223, 169, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalScrollContent: {
    gap: 20,
  },
  modalField: {
    gap: 8,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255, 223, 169, 0.6)",
    paddingLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  modalInput: {
    backgroundColor: "rgba(7, 10, 24, 0.6)",
    borderColor: "rgba(255, 223, 169, 0.15)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 46,
    fontSize: 14,
    color: "#fff5df",
  },
  modalSubmitBtn: {
    backgroundColor: "#ffdfa9",
    borderRadius: 24,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    shadowColor: "#ffdfa9",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  modalSubmitText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0c1324",
    letterSpacing: 0.5,
  },
});

const getDynamicStyles = (theme: "stellar" | "kraft") => {
  const isStellar = theme === "stellar";
  return {
    ...staticStyles,
    dashboardContainer: {
      ...staticStyles.dashboardContainer,
      backgroundColor: isStellar ? "transparent" : "#f5f0e8",
    },
    header: {
      ...staticStyles.header,
      borderBottomColor: isStellar ? "rgba(255, 223, 169, 0.08)" : "#ede4d5",
      borderBottomWidth: isStellar ? 0.5 : 1,
    },
    appTitle: {
      ...staticStyles.appTitle,
      color: isStellar ? "#ffdfa9" : "#2c1810",
      fontFamily: isStellar ? (Platform.OS === "ios" ? "Georgia" : "serif") : "System",
      fontSize: isStellar ? 22 : 24,
      letterSpacing: isStellar ? 1.2 : 0,
    },
    tagline: {
      ...staticStyles.tagline,
      color: isStellar ? "rgba(255, 223, 169, 0.5)" : "#8b7355",
      fontSize: isStellar ? 10 : 11,
      marginTop: isStellar ? 3 : 2,
    },
    addButton: {
      ...staticStyles.addButton,
      backgroundColor: isStellar ? "#ffdfa9" : "#c6604a",
      width: isStellar ? 38 : 42,
      height: isStellar ? 38 : 42,
      borderRadius: isStellar ? 19 : 21,
      shadowColor: isStellar ? "#ffdfa9" : "#c6604a",
    },
    startPlusButton: {
      ...staticStyles.startPlusButton,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.05)" : "#c6604a",
      borderWidth: isStellar ? 2 : 0,
      borderColor: isStellar ? "rgba(255, 216, 143, 0.25)" : "transparent",
      width: isStellar ? 130 : 140,
      height: isStellar ? 130 : 140,
      borderRadius: isStellar ? 65 : 70,
      shadowColor: isStellar ? "#8b5cf6" : "#c6604a",
    },
    startTitle: {
      ...staticStyles.startTitle,
      color: isStellar ? "#ffdf9f" : "#8b7355",
      fontFamily: isStellar ? (Platform.OS === "ios" ? "Georgia" : "serif") : "System",
      fontStyle: (isStellar ? "italic" : "normal") as any,
    },
    startArrowButton: {
      ...staticStyles.startArrowButton,
      backgroundColor: isStellar ? "rgba(255, 255, 255, 0.06)" : "#faf6ef",
      borderWidth: 1,
      borderColor: isStellar ? "rgba(255, 223, 169, 0.2)" : "#d4c5a9",
      shadowColor: isStellar ? "#000" : "#2c1810",
    },
    emptyText: {
      ...staticStyles.emptyText,
      color: isStellar ? "#ffdfa9" : "#8b7355",
      fontSize: isStellar ? 16 : 18,
    },
    emptySubtext: {
      ...staticStyles.emptySubtext,
      color: isStellar ? "rgba(255, 223, 169, 0.5)" : "#8b7355",
      opacity: isStellar ? 1 : 0.7,
      marginTop: isStellar ? 8 : 6,
    },
  };
};
