import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { savePhoto, saveDiary, getTagSettings, defaultTagSettings } from "@/lib/storage";
import { LocalDiary } from "@/lib/types";
import { TagPicker } from "@/components/TagPicker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function UploadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [eventTags, setEventTags] = useState<string[]>(defaultTagSettings.eventTags);
  const [moodTags, setMoodTags] = useState<string[]>(defaultTagSettings.moodTags);
  const [eventTag, setEventTag] = useState("");
  const [moodTag, setMoodTag] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load presets
    getTagSettings().then((settings) => {
      setEventTags(settings.eventTags);
      setMoodTags(settings.moodTags);
      setEventTag(settings.eventTags[0] || "");
      setMoodTag(settings.moodTags[0] || "");
    });
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
    if (!imageUri) {
      Alert.alert("提示", "必须先上传一张照片才能开启日记对话。");
      return;
    }

    setLoading(true);
    try {
      // 1. Copy the photo to our on-device sandboxed photos folder
      const localPhotoPath = await savePhoto(imageUri);
      const local = new Date();
      const y = local.getFullYear();
      const m = String(local.getMonth() + 1).padStart(2, "0");
      const d = String(local.getDate()).padStart(2, "0");
      const localDateStr = `${y}-${m}-${d}`;
      const now = local.toISOString();
      const diaryId = `diary-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      
      // 2. Formulate local diary draft
      const draft: LocalDiary = {
        id: diaryId,
        title: title.trim() || "今天留下的一段怪咖记忆",
        summary: "照片已上传，AI 正在分析画面以语音开启本次日记对话...",
        content: "",
        date: localDateStr,
        createdAt: now,
        imagePath: localPhotoPath,
        eventTag,
        moodTag,
        status: "image_uploaded",
        messages: [],
      };

      // 3. Save draft locally
      await saveDiary(draft);

      // 4. Redirect to chat interface
      router.push(`/chat/${diaryId}`);
    } catch (error) {
      Alert.alert("创建失败", error instanceof Error ? error.message : "未知错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#8b7355" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>创建日记</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.bookPage}>
          {/* Cover Photo Slot */}
          <TouchableOpacity
            style={styles.photoFrame}
            onPress={() => {
              Alert.alert("选择照片来源", "请选择今日日记的照片起点：", [
                { text: "拍照", onPress: () => pickImage(true) },
                { text: "相册", onPress: () => pickImage(false) },
                { text: "取消", style: "cancel" }
              ]);
            }}
            activeOpacity={0.9}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons name="camera-outline" size={48} color="#d4c5a9" />
                <Text style={styles.placeholderTitle}>拍下今天的瞬间</Text>
                <Text style={styles.placeholderSub}>点击拍照或从相册选择（单张照片）</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Title Input */}
          <View style={styles.field}>
            <Text style={styles.label}>手账标题</Text>
            <TextInput
              style={styles.input}
              placeholder="例如：海边的下午（选填）"
              placeholderTextColor="#8b7355"
              value={title}
              onChangeText={setTitle}
              maxLength={28}
              editable={!loading}
            />
          </View>

          {/* Tag Pickers */}
          <TagPicker label="事件分类" tags={eventTags} selected={eventTag} onSelect={setEventTag} />
          <TagPicker label="情绪状态" tags={moodTags} selected={moodTag} onSelect={setMoodTag} />

          {/* Submit */}
          <TouchableOpacity
            style={[styles.startButton, (!imageUri || loading) && styles.disabledButton]}
            onPress={handleStart}
            disabled={!imageUri || loading}
          >
            {loading ? (
              <ActivityIndicator color="#faf6ef" />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#faf6ef" style={{ marginRight: 6 }} />
                <Text style={styles.startText}>开启语音日记</Text>
              </>
            )}
          </TouchableOpacity>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  bookPage: {
    backgroundColor: "#faf6ef",
    borderWidth: 1,
    borderColor: "#d4c5a9",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#2c1810",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  photoFrame: {
    width: "100%",
    height: 240,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#d4c5a9",
    borderStyle: "dashed",
    overflow: "hidden",
    backgroundColor: "#f5f0e8",
    marginBottom: 20,
  },
  previewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  uploadPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#8b7355",
  },
  placeholderSub: {
    fontSize: 12,
    color: "#8b7355",
    opacity: 0.7,
    textAlign: "center",
  },
  field: {
    gap: 6,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8b7355",
    paddingLeft: 4,
  },
  input: {
    backgroundColor: "#f5f0e8",
    borderColor: "#d4c5a9",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#2c1810",
  },
  startButton: {
    backgroundColor: "#c6604a",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    shadowColor: "#c6604a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  disabledButton: {
    opacity: 0.6,
  },
  startText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#faf6ef",
  },
});
