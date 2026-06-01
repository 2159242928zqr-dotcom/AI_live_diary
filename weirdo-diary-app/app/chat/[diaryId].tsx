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
  Platform,
  Animated,
  Easing,
  Dimensions
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Audio } from "expo-av";
import { getDiary, saveDiary, saveAudio, deleteDiary } from "@/lib/storage";
import { LocalDiary, LocalMessage } from "@/lib/types";
import { apiPost } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StellarBackground } from "@/components/StellarBackground";
import { useThemeStore } from "@/lib/tabState";

const { width, height } = Dimensions.get("window");
type AiStatus = "idle" | "thinking" | "speaking";

export default function ChatScreen() {
  const router = useRouter();
  const { diaryId } = useLocalSearchParams<{ diaryId: string }>();
  const insets = useSafeAreaInsets();
  const { theme } = useThemeStore();
  const styles = getDynamicStyles(theme);
  const isStellar = theme === "stellar";
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

  // --- NEW: Stellar Theme UI & Animations States ---
  const [showBubbleChat, setShowBubbleChat] = useState(false); // Seamless toggle between star orb and bubble chat
  const [displayedSubtitle, setDisplayedSubtitle] = useState("准备聆听你的声音");
  const [manualTypingMode, setManualTypingMode] = useState(false);

  // Animation values
  const subtitleOpacity = useRef(new Animated.Value(1)).current;
  const nebulaRotate1 = useRef(new Animated.Value(0)).current;
  const nebulaRotate2 = useRef(new Animated.Value(0)).current;
  const orbScale = useRef(new Animated.Value(1)).current;
  const ribbonAnim = useRef(new Animated.Value(0)).current;
  
  // Custom Dynamic Waveform heights
  const waveAnims = useRef(Array.from({ length: 6 }, () => new Animated.Value(1))).current;

  // Track the raw subtitle target text to apply fading on changes
  const targetSubtitleText = useRef("准备聆听你的声音");

  // Load and initialize
  useEffect(() => {
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
      
      if (current.messages.length === 0 && current.imagePath) {
        await startAiOpening(current.imagePath);
      } else {
        setMessages(current.messages);
      }
    }

    loadDraft();

    // Start background nebula rotations
    Animated.loop(
      Animated.timing(nebulaRotate1, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(nebulaRotate2, {
        toValue: 1,
        duration: 24000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Start ribbon stardust path loop animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(ribbonAnim, {
          toValue: 1,
          duration: 3500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ribbonAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(500),
      ])
    ).start();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch((err) => {
          console.warn("卸载音频失败:", err);
        });
      }
    };
  }, [diaryId]);

  // Handle AI status breath & waveform animations
  useEffect(() => {
    let orbBreath: Animated.CompositeAnimation | null = null;
    let waveLoops: Animated.CompositeAnimation[] = [];

    if (aiStatus === "thinking") {
      // Gentle breathing scale loop when thinking
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

    // Dynamic golden waves dance loop
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
      // Slow pulse wave height
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
      // Return to quiet ripple state
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

  // Keep transcripts scrolling to end in bubble mode
  useEffect(() => {
    if (showBubbleChat) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [messages, aiStatus, showBubbleChat]);

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

  const startAiOpening = async (localImagePath: string) => {
    setAiStatus("thinking");
    setNotice("AI 正在解析图片，准备开启对话...");
    updateSubtitleWithFade("AI 正在看图准备对话...");
    try {
      const base64 = await FileSystemReadBase64(localImagePath);
      const dataUrl = `data:image/jpeg;base64,${base64}`;

      const res = await apiPost(`/api/diaries/${diaryId}/start`, {
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
      
      if (diary) {
        await saveDiary({
          ...diary,
          status: "chatting",
          messages: updatedMessages,
        });
      }

      setNotice(data.voice_notice || "AI 语音准备完毕，按住麦克风说话。");
      await playVoiceFile(localMsg);
    } catch (e: any) {
      setAiStatus("idle");
      setNotice(`AI 看图失败: ${e?.message || e}，请点击重新加载试一试。`);
      updateSubtitleWithFade("看图失败了，请尝试点击重新加载");
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
    updateSubtitleWithFade("AI 正在记录倾听...");

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

      setNotice(data.voice_notice || "");
      await playVoiceFile(assistantMsg);
    } catch (e: any) {
      setAiStatus("idle");
      setNotice(`发送失败: ${e?.message || e}，请重试。`);
      updateSubtitleWithFade("发送失败，请重试您的回话");
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
    if (!recording) return;
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

      const res = await apiPost(`/api/diaries/${diaryId}/messages/voice`, form);
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

      if (diary) {
        await saveDiary({
          ...diary,
          messages: finalMessages,
        });
      }

      setNotice(data.voice_notice || "");
      await playVoiceFile(assistantMsg);
    } catch (e: any) {
      setAiStatus("idle");
      setNotice(`录音处理失败: ${e?.message || e}，请重试说话。`);
      updateSubtitleWithFade("录音处理失败了，请再次尝试");
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

  const handleGenerateDiary = async () => {
    if (messages.length === 0 || locked) return;
    
    setAiStatus("thinking");
    setNotice("正在汇聚对话碎片生成日记本...");
    updateSubtitleWithFade("正在为您汇聚回忆生成日记手账...");
    
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
      updateSubtitleWithFade("生成失败，请再次重试");
      Alert.alert("生成失败", "生成日记出错，请再次尝试。");
    }
  };

  const handleExitChat = () => {
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

  // Swirling stars/nebula rotations interpolate
  const spin1 = nebulaRotate1.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const spin2 = nebulaRotate2.interpolate({
    inputRange: [0, 1],
    outputRange: ["360deg", "0deg"],
  });

  // Golden particle ribbon trails S-curve absolute translations
  const particle1Y = ribbonAnim.interpolate({ inputRange: [0, 1], outputRange: [180, 310] });
  const particle1X = ribbonAnim.interpolate({
    inputRange: [0, 0.4, 0.7, 1],
    outputRange: [width / 2, width / 2 - 25, width / 2 + 20, width / 2]
  });

  const particle2Y = ribbonAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 310] });
  const particle2X = ribbonAnim.interpolate({
    inputRange: [0, 0.3, 0.8, 1],
    outputRange: [width / 2 + 10, width / 2 - 15, width / 2 + 25, width / 2 + 2]
  });

  const renderChatContent = () => (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: isStellar ? "transparent" : "#f5f0e8" }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header top transparent bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleExitChat} style={styles.backButton}>
            <Ionicons name="close-outline" size={24} color={isStellar ? "#ffdfa9" : "#8b7355"} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Memory Vessel</Text>
          
          {/* Seamless toggle on-screen between subtitles & glassy bubbles */}
          <TouchableOpacity 
            onPress={() => setShowBubbleChat(!showBubbleChat)} 
            style={[styles.toggleModeBtn, showBubbleChat && styles.activeToggleModeBtn]}
          >
            <Ionicons 
              name={showBubbleChat ? "sparkles-outline" : "chatbubbles-outline"} 
              size={18} 
              color={isStellar ? "#ffdfa9" : (showBubbleChat ? "#faf6ef" : "#8b7355")} 
            />
              </TouchableOpacity>
            </View>

            {/* Main Interactive Space Canvas */}
            <View style={styles.interactiveArea}>
              
              {/* Golden dynamic memory particle trails ribbon (flowing down from image card) */}
              {!showBubbleChat && diary?.imagePath && (
                <View style={styles.ribbonLayer} pointerEvents="none">
                  <Animated.View style={[styles.ribbonParticle, { top: particle1Y, left: particle1X, opacity: ribbonAnim }]} />
                  <Animated.View style={[styles.ribbonParticle, { top: particle2Y, left: particle2X, opacity: ribbonAnim, width: 3.5, height: 3.5, backgroundColor: "#fff5df" }]} />
                </View>
              )}

              {/* Conditionally render Star Orb Mode OR scrolling Glassy Bubble flow */}
              {!showBubbleChat ? (
                /* 1. Immersive Nebula Orb & Poetic Subtitle Mode */
                <View style={styles.starOrbModeContainer}>
                  {/* Photo container with high contrast border */}
                  {diary?.imagePath && (
                    <View style={styles.photoContainer}>
                      <Image source={{ uri: diary.imagePath }} style={styles.diaryImage} />
                      <View style={styles.photoGlowRim} />
                    </View>
                  )}

                  {/* Giant cosmic glass orb */}
                  <Animated.View style={[styles.glassOrbContainer, { transform: [{ scale: orbScale }] }]}>
                    
                    {/* Swirling Nebula Layers */}
                    <Animated.View style={[styles.nebulaLayer, styles.purpleNebula, { transform: [{ rotate: spin1 }] }]} />
                    <Animated.View style={[styles.nebulaLayer, styles.blueNebula, { transform: [{ rotate: spin2 }] }]} />
                    
                    {/* Center dynamic golden wave ripples */}
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

                  {/* Serif Poetic Subtitle Dialogue Rendering block */}
                  <Animated.View style={[styles.subtitleContainer, { opacity: subtitleOpacity }]}>
                    <Text style={styles.subtitlePrompt}>“ 记忆正在流入今夜 ”</Text>
                    <Text style={styles.subtitleTranscript}>
                      {displayedSubtitle}
                    </Text>
                  </Animated.View>
                </View>
              ) : (
                /* 2. Glassy Dialogue Bubble flow Mode */
                <View style={styles.chatBubblesContainer}>
                  <ScrollView
                    ref={scrollViewRef}
                    contentContainerStyle={styles.chatScrollContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {messages.length === 0 ? (
                      <Text style={styles.emptyChatText}>星空静谧，期待您的声音来唤醒这段回忆...</Text>
                    ) : (
                      messages.map((item) => {
                        const isAi = item.role === "assistant";
                        const isPlaying = activeVoiceId === item.id;
                        
                        return (
                          <View 
                            key={item.id} 
                            style={[
                              styles.messageWrapper, 
                              isAi ? styles.messageAi : styles.messageUser
                            ]}
                          >
                            <View 
                              style={[
                                styles.glassBubble, 
                                isAi ? styles.glassBubbleAi : styles.glassBubbleUser
                              ]}
                            >
                              <Text style={styles.bubbleText}>
                                {item.transcript || item.text}
                              </Text>

                              {(item.inputType === "voice" || item.inputType === "ai_voice") && item.audioPath ? (
                                <TouchableOpacity 
                                  style={[styles.bubblePlayBtn, isPlaying && styles.activeBubblePlayBtn]}
                                  onPress={() => playVoiceFile(item)}
                                >
                                  <Ionicons 
                                    name={isPlaying ? "pause" : "play"} 
                                    size={14} 
                                    color={isPlaying ? "#0c1324" : "#ffdfa9"} 
                                  />
                                </TouchableOpacity>
                              ) : null}
                            </View>
                          </View>
                        );
                      })
                    )}

                    {aiStatus !== "idle" && aiStatus !== "speaking" && (
                      <View style={[styles.messageWrapper, styles.messageAi]}>
                        <View style={[styles.glassBubble, styles.glassBubbleAi, styles.thinkingBubble]}>
                          <ActivityIndicator size="small" color="#ffdfa9" />
                          <Text style={[styles.bubbleText, { marginLeft: 8 }]}>聆听者正在思索...</Text>
                        </View>
                      </View>
                    )}
                  </ScrollView>
                </View>
              )}

              {/* Poetic system notice */}
              {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
            </View>

            {/* Bottom Glassmorphic Control Panel Dock */}
            <View style={styles.controlDock}>
              
              {/* Keyboard manual manual typing overlay slide-in block */}
              {manualTypingMode && (
                <View style={styles.typingFieldRow}>
                  <TextInput
                    style={styles.glassTextInput}
                    placeholder={locked ? "请稍候..." : "用文字记录下此刻的细碎想法..."}
                    placeholderTextColor="rgba(255, 223, 169, 0.4)"
                    value={text}
                    onChangeText={setText}
                    editable={!locked}
                  />
                  <TouchableOpacity
                    style={[styles.sendTextBtn, (!text.trim() || locked) && styles.disabledBtn]}
                    onPress={handleSendText}
                    disabled={!text.trim() || locked}
                  >
                    <Ionicons name="send" size={16} color="#0c1324" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Dynamic trigger items bar */}
              <View style={styles.actionItemsRow}>
                {/* Keyboard icon button on left */}
                <TouchableOpacity 
                  onPress={() => setManualTypingMode(!manualTypingMode)} 
                  style={[styles.circleGlassBtn, manualTypingMode && styles.activeCircleGlassBtn]}
                >
                  <Ionicons 
                    name={manualTypingMode ? "mic-outline" : "keypad-outline"} 
                    size={20} 
                    color={isStellar ? "#ffdfa9" : (manualTypingMode ? "#faf6ef" : "#8b7355")} 
                  />
                </TouchableOpacity>

                {/* Center recording mic button */}
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
                      size={28}
                      color={isRecording ? (isStellar ? "#070a18" : "#faf6ef") : (isStellar ? "#ffdfa9" : "#faf6ef")}
                    />
                  </TouchableOpacity>
                </View>

                {/* Generate gold pill button on right */}
                <TouchableOpacity
                  style={[styles.generatePillBtn, messages.length === 0 && styles.disabledBtn]}
                  onPress={handleGenerateDiary}
                  disabled={messages.length === 0 || locked}
                  activeOpacity={0.8}
                >
                  <Text style={styles.generateBtnText}>生成回忆</Text>
                  <Ionicons name="sparkles" size={12} color={isStellar ? "#0c1324" : "#faf6ef"} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      );

  if (isStellar) {
    return (
      <View style={{ flex: 1 }}>
        <StellarBackground>
          {renderChatContent()}
        </StellarBackground>
      </View>
    );
  }
  return renderChatContent();
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

const staticStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    height: 56,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255, 223, 169, 0.08)",
  },
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
  toggleModeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 223, 169, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 223, 169, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  activeToggleModeBtn: {
    backgroundColor: "rgba(255, 223, 169, 0.22)",
    borderColor: "rgba(255, 223, 169, 0.35)",
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
    width: 4.5,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: "#ffdf9f",
    shadowColor: "#ffdf9f",
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 2,
  },

  // Subtitles mode styles
  starOrbModeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 24,
  },
  photoContainer: {
    width: 110,
    height: 110,
    borderRadius: 20,
    padding: 4,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 223, 169, 0.18)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 44,
  },
  diaryImage: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    resizeMode: "cover",
  },
  photoGlowRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },

  // Glass Orb Core styles
  glassOrbContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    position: "relative",
    backgroundColor: "rgba(10, 14, 35, 0.35)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 216, 143, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 44,
  },
  nebulaLayer: {
    position: "absolute",
    borderRadius: 9999,
  },
  purpleNebula: {
    width: 140,
    height: 140,
    backgroundColor: "rgba(139, 92, 246, 0.18)",
    left: 10,
    top: 20,
  },
  blueNebula: {
    width: 120,
    height: 120,
    backgroundColor: "rgba(14, 165, 233, 0.15)",
    right: 15,
    bottom: 25,
  },
  centerWaveLayout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    zIndex: 5,
    height: 50,
  },
  waveBar: {
    width: 3.5,
    backgroundColor: "#ffdfa9",
    borderRadius: 2,
    shadowColor: "#ffdfa9",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },
  orbHighlightRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },

  // Serif Poetic Subtitle typography
  subtitleContainer: {
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 20,
  },
  subtitlePrompt: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 14,
    color: "#ffdf9f",
    fontStyle: "italic",
    letterSpacing: 2,
    marginBottom: 14,
    opacity: 0.85,
  },
  subtitleTranscript: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 17,
    lineHeight: 28,
    color: "#f8fafc",
    textAlign: "center",
    letterSpacing: 1,
    fontWeight: "500",
  },

  // Bubble Chat scroll flow styles
  chatBubblesContainer: {
    flex: 1,
    width: "100%",
  },
  chatScrollContent: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 16,
  },
  emptyChatText: {
    fontSize: 13,
    color: "rgba(255, 223, 169, 0.4)",
    textAlign: "center",
    marginTop: height * 0.25,
    fontStyle: "italic",
  },
  messageWrapper: {
    width: "100%",
    flexDirection: "row",
  },
  messageAi: {
    justifyContent: "flex-start",
  },
  messageUser: {
    justifyContent: "flex-end",
  },
  glassBubble: {
    maxWidth: "82%",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  glassBubbleAi: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 223, 169, 0.12)",
    borderTopLeftRadius: 4,
  },
  glassBubbleUser: {
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderColor: "rgba(139, 92, 246, 0.25)",
    borderTopRightRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#f8fafc",
    letterSpacing: 0.5,
  },
  bubblePlayBtn: {
    marginTop: 8,
    alignSelf: "flex-end",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 0.8,
    borderColor: "rgba(255, 223, 169, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  activeBubblePlayBtn: {
    backgroundColor: "#ffdfa9",
  },
  thinkingBubble: {
    flexDirection: "row",
    alignItems: "center",
  },

  noticeText: {
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
    color: "rgba(255, 223, 169, 0.5)",
    marginVertical: 12,
  },

  // Control Dock bottom styles
  controlDock: {
    backgroundColor: "rgba(12, 19, 36, 0.85)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 223, 169, 0.12)",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 18 : 24,
    gap: 12,
  },
  typingFieldRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  glassTextInput: {
    flex: 1,
    backgroundColor: "rgba(7, 10, 24, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 223, 169, 0.15)",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 44,
    fontSize: 13,
    color: "#f8fafc",
  },
  sendTextBtn: {
    backgroundColor: "#ffdfa9",
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionItemsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  circleGlassBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 223, 169, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 223, 169, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  activeCircleGlassBtn: {
    backgroundColor: "rgba(255, 223, 169, 0.22)",
    borderColor: "rgba(255, 223, 169, 0.35)",
  },
  micBtnWrapper: {
    position: "relative",
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
  },
  micPulseRing: {
    position: "absolute",
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 1.5,
    borderColor: "#ffdfa9",
    backgroundColor: "rgba(255, 223, 169, 0.12)",
    transform: [{ scale: 1.15 }],
  },
  glassMicBtn: {
    backgroundColor: "rgba(139, 92, 246, 0.25)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 223, 169, 0.25)",
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  glassMicBtnRecording: {
    backgroundColor: "#ffdfa9",
    borderColor: "#ffffff",
    transform: [{ scale: 1.08 }],
    shadowColor: "#ffdfa9",
    shadowRadius: 15,
  },
  generatePillBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffdfa9",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 11,
    shadowColor: "#ffdfa9",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  generateBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0c1324",
    letterSpacing: 0.5,
  },
  disabledBtn: {
    opacity: 0.45,
  },
});

const getDynamicStyles = (theme: "stellar" | "kraft") => {
  const isStellar = theme === "stellar";
  return {
    ...staticStyles,
    header: {
      ...staticStyles.header,
      borderBottomColor: isStellar ? "rgba(255, 223, 169, 0.08)" : "#ede4d5",
    },
    headerTitle: {
      ...staticStyles.headerTitle,
      color: isStellar ? "#ffdfa9" : "#2c1810",
    },
    backButton: {
      ...staticStyles.backButton,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.08)" : "#faf6ef",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.12)" : "#d4c5a9",
    },
    toggleModeBtn: {
      ...staticStyles.toggleModeBtn,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.08)" : "#faf6ef",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.12)" : "#d4c5a9",
    },
    activeToggleModeBtn: {
      ...staticStyles.activeToggleModeBtn,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.22)" : "#ede4d5",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.35)" : "#c6604a",
    },
    starOrbModeContainer: {
      ...staticStyles.starOrbModeContainer,
      ...(isStellar ? {} : {
        backgroundColor: "#faf6ef",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#d4c5a9",
        paddingVertical: 20,
        marginHorizontal: 16,
        shadowColor: "#2c1810",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
      }),
    },
    glassOrbContainer: {
      ...staticStyles.glassOrbContainer,
      backgroundColor: isStellar ? "rgba(10, 14, 35, 0.35)" : "#ede4d5",
      borderColor: isStellar ? "rgba(255, 216, 143, 0.25)" : "#d4c5a9",
      shadowColor: isStellar ? "#8b5cf6" : "transparent",
    },
    circleGlassBtn: {
      ...staticStyles.circleGlassBtn,
      backgroundColor: isStellar ? "rgba(255, 255, 255, 0.05)" : "#ede4d5",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.15)" : "#d4c5a9",
    },
    activeCircleGlassBtn: {
      ...staticStyles.activeCircleGlassBtn,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.18)" : "#c6604a",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.4)" : "#c6604a",
    },
    glassMicBtn: {
      ...staticStyles.glassMicBtn,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.1)" : "#c6604a",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.2)" : "#c6604a",
    },
    glassMicBtnRecording: {
      ...staticStyles.glassMicBtnRecording,
      backgroundColor: isStellar ? "#ffdfa9" : "#4a7c6b",
      borderColor: isStellar ? "#ffdfa9" : "#4a7c6b",
    },
    generatePillBtn: {
      ...staticStyles.generatePillBtn,
      backgroundColor: isStellar ? "#ffdfa9" : "#4a7c6b",
      shadowColor: isStellar ? "#ffdfa9" : "#4a7c6b",
    },
    generateBtnText: {
      ...staticStyles.generateBtnText,
      color: isStellar ? "#0c1324" : "#faf6ef",
    },
  };
};
