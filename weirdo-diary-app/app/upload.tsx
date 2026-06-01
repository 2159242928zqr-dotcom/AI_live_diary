import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Platform
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { savePhoto, saveDiary, getTagSettings, defaultTagSettings } from "@/lib/storage";
import { LocalDiary } from "@/lib/types";
import { TagPicker } from "@/components/TagPicker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StellarBackground } from "@/components/StellarBackground";
import { useThemeStore } from "@/lib/tabState";

export default function UploadScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isManual = type === "manual";
  
  const insets = useSafeAreaInsets();
  const { theme } = useThemeStore();
  const styles = getDynamicStyles(theme);
  const isStellar = theme === "stellar";
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [manualContent, setManualContent] = useState("");
  const [eventTags, setEventTags] = useState<string[]>(defaultTagSettings.eventTags);
  const [moodTags, setMoodTags] = useState<string[]>(defaultTagSettings.moodTags);
  const [eventTag, setEventTag] = useState("");
  const [moodTag, setMoodTag] = useState("");
  const [loading, setLoading] = useState(false);

  // --- NEW: Stellar Theme Animations ---
  const iconBreathe = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Load presets
    getTagSettings().then((settings) => {
      setEventTags(settings.eventTags);
      setMoodTags(settings.moodTags);
      setEventTag(settings.eventTags[0] || "");
      setMoodTag(settings.moodTags[0] || "");
    });

    // Start soft breathing animation for the camera placeholder
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconBreathe, {
          toValue: 0.45,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(iconBreathe, {
          toValue: 1.0,
          duration: 1600,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, []);

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
        setImageUri(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert("选择照片失败", "请稍后重试。");
    }
  };

  const handleStart = async () => {
    if (isManual) {
      if (!manualContent.trim()) {
        Alert.alert("提示", "请输入手写日记的正文内容。");
        return;
      }

      setLoading(true);
      try {
        const localPhotoPath = imageUri ? await savePhoto(imageUri) : "";
        const local = new Date();
        const y = local.getFullYear();
        const m = String(local.getMonth() + 1).padStart(2, "0");
        const d = String(local.getDate()).padStart(2, "0");
        const localDateStr = `${y}-${m}-${d}`;
        const now = local.toISOString();
        const diaryId = `diary-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        
        const manualDiary: LocalDiary = {
          id: diaryId,
          title: title.trim() || "今天的手写手账",
          summary: manualContent.slice(0, 32).trim() + (manualContent.length > 32 ? "..." : ""),
          content: manualContent.trim(),
          date: localDateStr,
          createdAt: now,
          imagePath: localPhotoPath,
          eventTag: eventTag || "手写",
          moodTag: moodTag || "平静",
          status: "generated", // Skip chat entirely
          messages: [],
        };

        await saveDiary(manualDiary);
        router.replace(`/diary/${diaryId}`);
      } catch (error) {
        Alert.alert("创建失败", error instanceof Error ? error.message : "未知错误");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Original AI Capsule Flow
    if (!imageUri) {
      Alert.alert("提示", "必须先上传一张照片才能开启日记对话。");
      return;
    }

    setLoading(true);
    try {
      const localPhotoPath = await savePhoto(imageUri);
      const local = new Date();
      const y = local.getFullYear();
      const m = String(local.getMonth() + 1).padStart(2, "0");
      const d = String(local.getDate()).padStart(2, "0");
      const localDateStr = `${y}-${m}-${d}`;
      const now = local.toISOString();
      const diaryId = `diary-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      
      const draft: LocalDiary = {
        id: diaryId,
        title: title.trim() || "今天留下的一段怪咖记忆",
        summary: "照片已上传，AI 正在分析画面以语音开启本次日记对话...",
        content: "",
        date: localDateStr,
        createdAt: now,
        imagePath: localPhotoPath,
        eventTag: eventTag || "旅行",
        moodTag: moodTag || "平静",
        status: "image_uploaded",
        messages: [],
      };

      await saveDiary(draft);
      router.push(`/chat/${diaryId}`);
    } catch (error) {
      Alert.alert("创建失败", error instanceof Error ? error.message : "未知错误");
    } finally {
      setLoading(false);
    }
  };

  const renderUploadContent = () => (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: isStellar ? "transparent" : "#f5f0e8" }]}>
      {/* Transparent Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={22} color={isStellar ? "#ffdfa9" : "#8b7355"} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isManual ? (isStellar ? "封存手写手账" : "创建手写日记") : "创建记忆胶囊"}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Glassmorphic card container */}
        <View style={styles.glassBookPage}>
          
          {/* Interactive Hologram Photo Frame */}
          <TouchableOpacity
            style={[styles.photoFrame, imageUri ? styles.photoFrameSolid : styles.photoFrameDashed]}
            onPress={() => {
              Alert.alert("选择照片来源", "请选择今日日记的照片起点：", [
                { text: "拍照", onPress: () => pickImage(true) },
                { text: "相册", onPress: () => pickImage(false) },
                { text: "取消", style: "cancel" }
              ]);
            }}
            activeOpacity={0.8}
          >
            {imageUri ? (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: imageUri }} style={styles.previewImage} />
                {isStellar && <View style={styles.photoGlassOverlay} />}
              </View>
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Animated.View style={{ opacity: iconBreathe, alignItems: "center" }}>
                  <Ionicons name="camera-outline" size={isStellar ? 36 : 48} color={isStellar ? "#ffdf9f" : "#d4c5a9"} style={{ marginBottom: 4 }} />
                  <Text style={styles.placeholderTitle}>
                    {isManual ? "添加今日影像（可选）" : "寻找今日影像起点"}
                  </Text>
                  <Text style={styles.placeholderSub}>
                    {isManual 
                      ? (isStellar ? "点击为这篇手账附上一份影像碎片" : "点击上传一张插图照片")
                      : (isStellar ? "点击拍照或从相册选择一份影像碎片" : "点击上传一张今日照片")
                    }
                  </Text>
                </Animated.View>
              </View>
            )}
          </TouchableOpacity>

          {/* Title Input field with inner indent feel */}
          <View style={styles.field}>
            <Text style={styles.label}>手账标题</Text>
            <TextInput
              style={styles.input}
              placeholder="例如：海边的下午（选填）"
              placeholderTextColor={isStellar ? "rgba(255, 223, 169, 0.35)" : "#8b7355"}
              value={title}
              onChangeText={setTitle}
              maxLength={28}
              editable={!loading}
            />
          </View>

          {/* Multi-line Content input box for Manual Handwritten Mode */}
          {isManual && (
            <View style={styles.field}>
              <Text style={styles.label}>日记正文</Text>
              <TextInput
                style={[
                  styles.input, 
                  { 
                    height: 160, 
                    textAlignVertical: "top", 
                    paddingTop: 12, 
                    paddingBottom: 12 
                  }
                ]}
                placeholder="用文字记录下此刻的细碎想法与温热时光..."
                placeholderTextColor={isStellar ? "rgba(255, 223, 169, 0.35)" : "#8b7355"}
                value={manualContent}
                onChangeText={setManualContent}
                multiline={true}
                editable={!loading}
              />
            </View>
          )}

          {/* Tag Pickers upgraded to glassy capsules */}
          <TagPicker label="事件分类" tags={eventTags} selected={eventTag} onSelect={setEventTag} />
          <TagPicker label="情绪状态" tags={moodTags} selected={moodTag} onSelect={setMoodTag} />

          {/* Submit golden glowing button */}
          <TouchableOpacity
            style={[
              styles.startButton, 
              (loading || (isManual ? !manualContent.trim() : !imageUri)) && styles.disabledButton
            ]}
            onPress={handleStart}
            disabled={loading || (isManual ? !manualContent.trim() : !imageUri)}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={isStellar ? "#0c1324" : "#faf6ef"} />
            ) : (
              <>
                <Ionicons 
                  name={isManual ? "journal-outline" : "sparkles"} 
                  size={16} 
                  color={isStellar ? "#0c1324" : "#faf6ef"} 
                  style={{ marginRight: 6 }} 
                />
                <Text style={styles.startText}>
                  {isManual ? "保存手写日记" : "开启语音日记"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  if (isStellar) {
    return (
      <View style={{ flex: 1 }}>
        <StellarBackground>
          {renderUploadContent()}
        </StellarBackground>
      </View>
    );
  }
  return renderUploadContent();
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
  headerTitle: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 18,
    fontWeight: "700",
    color: "#ffdfa9",
    letterSpacing: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  glassBookPage: {
    backgroundColor: "rgba(12, 19, 36, 0.8)", // Glass backplate
    borderWidth: 1.2,
    borderColor: "rgba(255, 223, 169, 0.18)", // Gold rim
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
  photoFrame: {
    width: "100%",
    height: 230,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(7, 10, 24, 0.65)",
    marginBottom: 24,
  },
  photoFrameDashed: {
    borderWidth: 1.5,
    borderColor: "rgba(255, 223, 169, 0.25)",
    borderStyle: "dashed",
  },
  photoFrameSolid: {
    borderWidth: 1.2,
    borderColor: "rgba(255, 223, 169, 0.4)",
    shadowColor: "#ffdfa9",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  imageWrapper: {
    position: "relative",
    width: "100%",
    height: "100%",
  },
  previewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  photoGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7, 10, 24, 0.15)", // subtle merge mask
  },
  uploadPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  placeholderTitle: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 15,
    fontWeight: "700",
    color: "#ffdf9f",
    fontStyle: "italic",
    letterSpacing: 1,
  },
  placeholderSub: {
    fontSize: 11,
    color: "rgba(255, 223, 169, 0.45)",
    textAlign: "center",
    lineHeight: 16,
  },
  field: {
    gap: 8,
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255, 223, 169, 0.6)",
    paddingLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  input: {
    backgroundColor: "rgba(7, 10, 24, 0.6)",
    borderColor: "rgba(255, 223, 169, 0.15)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 46,
    fontSize: 14,
    color: "#f8fafc",
  },
  startButton: {
    backgroundColor: "#ffdfa9", // Glowing gold pill button
    borderRadius: 24,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    shadowColor: "#ffdfa9",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.45,
  },
  startText: {
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
    header: {
      ...staticStyles.header,
      borderBottomColor: isStellar ? "rgba(255, 223, 169, 0.08)" : "#ede4d5",
      borderBottomWidth: isStellar ? 0.5 : 1,
    },
    backButton: {
      ...staticStyles.backButton,
      ...(isStellar ? {} : {
        width: 36 as any,
        height: 36 as any,
        borderRadius: 0,
        backgroundColor: "transparent",
        borderWidth: 0,
        borderColor: "transparent",
        padding: 0,
      }),
    },
    headerTitle: {
      ...staticStyles.headerTitle,
      color: isStellar ? "#ffdfa9" : "#2c1810",
      fontFamily: isStellar ? (Platform.OS === "ios" ? "Georgia" : "serif") : "System",
      fontSize: isStellar ? 18 : 18,
      letterSpacing: isStellar ? 1 : 0,
    },
    glassBookPage: {
      ...staticStyles.glassBookPage,
      backgroundColor: isStellar ? "rgba(12, 19, 36, 0.8)" : "#faf6ef",
      borderWidth: isStellar ? 1.2 : 1,
      borderColor: isStellar ? "rgba(255, 223, 169, 0.18)" : "#d4c5a9",
      borderRadius: isStellar ? 24 : 16,
      padding: isStellar ? 20 : 16,
      shadowColor: isStellar ? "#000" : "#2c1810",
      shadowOffset: isStellar ? { width: 0, height: 16 } : { width: 0, height: 2 },
      shadowOpacity: isStellar ? 0.35 : 0.05,
      shadowRadius: isStellar ? 24 : 6,
      elevation: isStellar ? 8 : 2,
    },
    photoFrame: {
      ...staticStyles.photoFrame,
      backgroundColor: isStellar ? "rgba(7, 10, 24, 0.65)" : "#f5f0e8",
      height: isStellar ? 230 : 240,
      marginBottom: isStellar ? 24 : 20,
    },
    photoFrameDashed: {
      ...staticStyles.photoFrameDashed,
      borderColor: isStellar ? "rgba(255, 223, 169, 0.25)" : "#d4c5a9",
    },
    photoFrameSolid: {
      ...staticStyles.photoFrameSolid,
      borderColor: isStellar ? "rgba(255, 223, 169, 0.4)" : "#d4c5a9",
    },
    placeholderTitle: {
      ...staticStyles.placeholderTitle,
      color: isStellar ? "#ffdf9f" : "#8b7355",
      fontFamily: isStellar ? (Platform.OS === "ios" ? "Georgia" : "serif") : "System",
      fontStyle: (isStellar ? "italic" : "normal") as any,
      letterSpacing: isStellar ? 1 : 0,
      fontSize: isStellar ? 15 : 16,
    },
    placeholderSub: {
      ...staticStyles.placeholderSub,
      color: isStellar ? "rgba(255, 223, 169, 0.45)" : "#8b7355",
      opacity: isStellar ? 1 : 0.7,
    },
    label: {
      ...staticStyles.label,
      color: isStellar ? "rgba(255, 223, 169, 0.6)" : "#8b7355",
      textTransform: (isStellar ? "uppercase" : "none") as any,
      letterSpacing: isStellar ? 1.5 : 0,
    },
    input: {
      ...staticStyles.input,
      backgroundColor: isStellar ? "rgba(7, 10, 24, 0.6)" : "#f5f0e8",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.15)" : "#d4c5a9",
      color: isStellar ? "#f8fafc" : "#2c1810",
      height: (isStellar ? 46 : "auto") as any,
      borderRadius: isStellar ? 12 : 10,
    },
    startButton: {
      ...staticStyles.startButton,
      backgroundColor: isStellar ? "#ffdfa9" : "#c6604a",
      borderRadius: isStellar ? 24 : 12,
      shadowColor: isStellar ? "#ffdfa9" : "#c6604a",
      marginTop: isStellar ? 24 : 20,
    },
    startText: {
      ...staticStyles.startText,
      color: isStellar ? "#0c1324" : "#faf6ef",
      fontSize: isStellar ? 15 : 16,
    },
  };
};
