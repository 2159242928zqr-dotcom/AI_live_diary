import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Image,
  Modal,
  Clipboard
} from "react-native";
import { useAuth } from "@/lib/auth";
import { Ionicons } from "@expo/vector-icons";
import { getTagSettings, saveTagSettings, TagSettings, getSavedAccounts, saveAccountToList } from "@/lib/storage";
import { exportAllDiariesAsZip } from "@/lib/export";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { getApiConfig, saveApiConfig } from "@/lib/api";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [eventTags, setEventTags] = useState<string[]>(["旅游", "看电影", "聚会", "工作", "散步", "独处"]);
  const [moodTags, setMoodTags] = useState<string[]>(["开心", "高兴", "平静", "疲惫", "期待", "难过"]);
  const [newEventTag, setNewEventTag] = useState("");
  const [newMoodTag, setNewMoodTag] = useState("");

  // Profile states
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("gradient:0");
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Custom toggles
  const [keepAudio, setKeepAudio] = useState(true);
  const [autoplayVoice, setAutoplayVoice] = useState(true);
  const [largeText, setLargeText] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // API & AI settings
  const [apiUrl, setApiUrl] = useState("");
  const [useLocalAi, setUseLocalAi] = useState(false);
  const [glmApiKey, setGlmApiKey] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSavingApi, setIsSavingApi] = useState(false);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [isSavingAi, setIsSavingAi] = useState(false);

  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Load tag settings
    getTagSettings()
      .then((settings) => {
        if (settings) {
          if (settings.eventTags) setEventTags(settings.eventTags);
          if (settings.moodTags) setMoodTags(settings.moodTags);
        }
      })
      .catch((err) => {
        console.warn("Failed to load tag settings", err);
      });

    // Load profile from user metadata
    if (user) {
      const userMetadata = user.user_metadata;
      setUsername(userMetadata?.username || user.email?.split("@")[0] || "");
      setAvatarUrl(userMetadata?.avatarUrl || "gradient:0");
    }

    // Load API & AI Configuration
    getApiConfig()
      .then((config) => {
        setApiUrl(config.apiUrl);
        setUseLocalAi(config.useLocalAi);
        setGlmApiKey(config.glmApiKey);
      })
      .catch((err) => {
        console.warn("Failed to load API config", err);
      });
  }, [user]);

  const handleSaveProfile = async () => {
    if (!username.trim()) {
      Alert.alert("提示", "昵称不能为空。");
      return;
    }
    setIsSavingProfile(true);
    try {
      if (!user) throw new Error("用户未登录");
      
      // Update Supabase auth metadata
      const { error } = await supabase.auth.updateUser({
        data: { username: username.trim(), avatarUrl }
      });
      if (error) throw error;

      // Update in local saved accounts list for instant switcher
      const inviteCode = `MV-${user.id.slice(0, 5).toUpperCase()}`;
      const saved = await getSavedAccounts();
      const match = saved.find((a) => a.email.toLowerCase() === user.email?.toLowerCase());

      await saveAccountToList({
        userId: user.id,
        email: user.email || "",
        password: match?.password, // preserve password for auto-login
        username: username.trim(),
        avatarUrl: avatarUrl,
        inviteCode: inviteCode
      });

      Alert.alert("保存成功", "个人资料已同步！");
    } catch (e) {
      Alert.alert("保存失败", e instanceof Error ? e.message : "未知错误");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarUpload = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("权限不足", "需要相册访问权限来选择头像！");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const base64Data = `data:image/jpeg;base64,${asset.base64}`;
        setAvatarUrl(base64Data);
        setShowAvatarModal(false);
      }
    } catch (err) {
      Alert.alert("错误", "图片读取失败，请重试。");
    }
  };

  const handleCopyInviteCode = () => {
    const inviteCode = `MV-${(user?.id || "USER").slice(0, 5).toUpperCase()}`;
    Clipboard.setString(inviteCode);
    Alert.alert("复制成功", "您的专属邀请码已复制到剪切板！");
  };

  const handleTestConnection = async () => {
    if (!apiUrl.trim()) {
      Alert.alert("提示", "请输入 API 服务器地址！");
      return;
    }
    
    const normalizedUrl = apiUrl.trim().replace(/\/$/, "");
    setIsTestingConnection(true);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${normalizedUrl}/api/health`, {
        method: "GET",
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json().catch(() => null);
        if (data && data.ok) {
          Alert.alert("连接成功", "已成功连通怪咖日记 AI 服务端！AI 助手已配置就绪。");
        } else {
          Alert.alert("测试结果", `已连接到服务器，但后端状态未就绪：\n缺失配置: ${data?.missing?.join(", ") || "无"}`);
        }
      } else {
        Alert.alert("连接失败", `服务器响应错误 (HTTP ${response.status})。请确保输入正确的后端服务地址。`);
      }
    } catch (err) {
      console.warn("测试连接出错:", err);
      Alert.alert(
        "测试失败", 
        "无法连接到 API 服务端，请确认：\n1. 电脑端 Next.js 开发服务已正常开启；\n2. 手机与电脑在同一局域网下，或已正确开启 Expo Tunnel 隧道服务；\n3. 输入的 IP 地址及端口号正确。"
      );
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveApiUrl = async () => {
    if (!apiUrl.trim()) {
      Alert.alert("提示", "API 地址不能为空。");
      return;
    }
    setIsSavingApi(true);
    try {
      await saveApiConfig({ apiUrl: apiUrl.trim() });
      Alert.alert("保存成功", "API 服务器地址已保存！");
    } catch (err) {
      Alert.alert("保存失败", err instanceof Error ? err.message : "保存出错了，请重试。");
    } finally {
      setIsSavingApi(false);
    }
  };

  const handleTestAiConnection = async () => {
    if (!glmApiKey.trim()) {
      Alert.alert("提示", "请输入 智谱 AI API Key！");
      return;
    }
    
    setIsTestingAi(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      
      const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${glmApiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "glm-4-flash",
          messages: [
            { role: "user", content: "你好，请回复【测试通过】这四个字。" }
          ],
          temperature: 0.1,
          max_tokens: 15,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || "";
        Alert.alert("测试成功", `已成功连通智谱 AI 平台！\n模型回复: "${reply.trim()}"`);
      } else {
        const raw = await response.text();
        Alert.alert("测试失败", `智谱服务器响应错误:\nHTTP ${response.status}\n详情: ${raw}`);
      }
    } catch (err) {
      console.warn("测试 AI 连接出错:", err);
      Alert.alert("测试失败", "无法连接到智谱 AI 服务器，请确认您的设备已连接互联网，且输入的 API Key 格式正确。");
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleSaveAiConfig = async () => {
    setIsSavingAi(true);
    try {
      await saveApiConfig({
        useLocalAi,
        glmApiKey: glmApiKey.trim(),
      });
      Alert.alert("保存成功", "AI 直连配置已更新并持久化！");
    } catch (err) {
      Alert.alert("保存失败", err instanceof Error ? err.message : "未知错误");
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const zipPath = await exportAllDiariesAsZip();
      if (zipPath) {
        Alert.alert("导出成功", "日记已打包为 ZIP 文件，已调起分享窗口进行保存！");
      } else {
        Alert.alert("导出失败", "当前没有任何日记可供导出备份。");
      }
    } catch (error) {
      Alert.alert("导出出错", error instanceof Error ? error.message : "未知错误");
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("退出登录", "退出登录后，本地日记将保留在设备上。确定要退出吗？", [
      { text: "取消", style: "cancel" },
      { text: "退出", style: "destructive", onPress: () => logout() }
    ]);
  };

  const handleAddEventTag = async () => {
    const trimmed = newEventTag.trim();
    if (!trimmed) return;
    if (eventTags.includes(trimmed)) {
      Alert.alert("提示", "该标签已存在");
      return;
    }
    const updated = [...eventTags, trimmed];
    setEventTags(updated);
    setNewEventTag("");
    try {
      await saveTagSettings({ eventTags: updated, moodTags });
    } catch (e) {
      Alert.alert("错误", "保存标签失败");
    }
  };

  const handleAddMoodTag = async () => {
    const trimmed = newMoodTag.trim();
    if (!trimmed) return;
    if (moodTags.includes(trimmed)) {
      Alert.alert("提示", "该标签已存在");
      return;
    }
    const updated = [...moodTags, trimmed];
    setMoodTags(updated);
    setNewMoodTag("");
    try {
      await saveTagSettings({ eventTags, moodTags: updated });
    } catch (e) {
      Alert.alert("错误", "保存标签失败");
    }
  };

  const handleDeleteEventTag = (tag: string) => {
    Alert.alert("删除标签", `确定要删除事件标签 "${tag}" 吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          const updated = eventTags.filter((t) => t !== tag);
          setEventTags(updated);
          try {
            await saveTagSettings({ eventTags: updated, moodTags });
          } catch (e) {
            Alert.alert("错误", "保存标签失败");
          }
        }
      }
    ]);
  };

  const handleDeleteMoodTag = (tag: string) => {
    Alert.alert("删除标签", `确定要删除情绪标签 "${tag}" 吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          const updated = moodTags.filter((t) => t !== tag);
          setMoodTags(updated);
          try {
            await saveTagSettings({ eventTags, moodTags: updated });
          } catch (e) {
            Alert.alert("错误", "保存标签失败");
          }
        }
      }
    ]);
  };

  const isGradient = avatarUrl?.startsWith("gradient:");
  const gradientIndex = isGradient ? parseInt(avatarUrl.split(":")[1], 10) : 0;
  const gradients = [
    "#ff7f50",
    "#20b2aa",
    "#9370db",
    "#6395ee",
    "#e06666",
    "#b5a642"
  ];
  const gradientColor = gradients[gradientIndex] || gradients[0];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {activeSection !== null && (
          <TouchableOpacity
            style={styles.backHeaderButton}
            onPress={() => setActiveSection(null)}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#c6604a" />
            <Text style={styles.backHeaderText}>返回主页</Text>
          </TouchableOpacity>
        )}
        <View>
          <Text style={styles.appTitle}>
            {activeSection === "account" && "账户与个人中心"}
            {activeSection === "tags" && "日记标签预设"}
            {activeSection === "backup" && "数据备份导出"}
            {activeSection === "preferences" && "应用优先偏好"}
            {activeSection === "ai" && "AI 密钥与直连配置"}
            {activeSection === null && "系统设置"}
          </Text>
          <Text style={styles.tagline}>
            {activeSection === "account" && "管理您的头像、名字及邀请码"}
            {activeSection === "tags" && "自定义新增和删除手账事件与情绪分类"}
            {activeSection === "backup" && "导出您的本地日记离线归档包"}
            {activeSection === "preferences" && "配置您专属的偏好与隐私功能"}
            {activeSection === "ai" && "配置智谱 API Key，开启纯本地直连 AI"}
            {activeSection === null && "个性化您的日记本"}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeSection === null && (
          <View style={styles.menuList}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setActiveSection("account")}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuItemIconBg, { backgroundColor: "#c6604a" }]}>
                  <Ionicons name="person-outline" size={20} color="#faf6ef" />
                </View>
                <View style={styles.menuItemTextContainer}>
                  <Text style={styles.menuItemTitle}>账户与个人中心</Text>
                  <Text style={styles.menuItemSubtitle}>更换名字和预设头像，专属邀请码复制</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#8b7355" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setActiveSection("tags")}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuItemIconBg, { backgroundColor: "#8b7355" }]}>
                  <Ionicons name="pricetags-outline" size={20} color="#faf6ef" />
                </View>
                <View style={styles.menuItemTextContainer}>
                  <Text style={styles.menuItemTitle}>日记标签预设</Text>
                  <Text style={styles.menuItemSubtitle}>自定义修改手账事件与情绪分类标签</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#8b7355" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setActiveSection("backup")}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuItemIconBg, { backgroundColor: "#6395ee" }]}>
                  <Ionicons name="archive-outline" size={20} color="#faf6ef" />
                </View>
                <View style={styles.menuItemTextContainer}>
                  <Text style={styles.menuItemTitle}>数据备份与导出</Text>
                  <Text style={styles.menuItemSubtitle}>打包导出离线 HTML 手账 ZIP 压缩包</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#8b7355" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setActiveSection("preferences")}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuItemIconBg, { backgroundColor: "#20b2aa" }]}>
                  <Ionicons name="options-outline" size={20} color="#faf6ef" />
                </View>
                <View style={styles.menuItemTextContainer}>
                  <Text style={styles.menuItemTitle}>应用优先偏好</Text>
                  <Text style={styles.menuItemSubtitle}>声音保留、自动播报、大字号手账等</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#8b7355" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setActiveSection("ai")}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuItemIconBg, { backgroundColor: "#9370db" }]}>
                  <Ionicons name="bulb-outline" size={20} color="#faf6ef" />
                </View>
                <View style={styles.menuItemTextContainer}>
                  <Text style={styles.menuItemTitle}>AI 密钥与直连配置</Text>
                  <Text style={styles.menuItemSubtitle}>输入 API Key，在局域网受限时直接连接大模型</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#8b7355" />
            </TouchableOpacity>
          </View>
        )}

        {/* 1. Account Panel */}
        {activeSection === "account" && (
          <View style={styles.section}>
            <View style={styles.accountCard}>
              <View style={styles.accountInfo}>
                <TouchableOpacity
                  onPress={() => setShowAvatarModal(true)}
                  activeOpacity={0.8}
                  style={[
                    styles.avatar,
                    isGradient ? { backgroundColor: gradientColor } : null
                  ]}
                >
                  {isGradient ? (
                    <Text style={styles.avatarText}>
                      {(username || user?.email || "U").slice(0, 1).toUpperCase()}
                    </Text>
                  ) : (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                  )}
                  <View style={styles.avatarEditOverlay}>
                    <Ionicons name="camera" size={12} color="#faf6ef" />
                  </View>
                </TouchableOpacity>

                <View style={styles.profileInputs}>
                  <Text style={styles.emailText}>{user?.email}</Text>
                  
                  <TouchableOpacity
                    onLongPress={handleCopyInviteCode}
                    delayLongPress={600}
                    onPress={handleCopyInviteCode}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.inviteText}>
                      专属邀请码: MV-{(user?.id || "USER").slice(0, 5).toUpperCase()} <Text style={styles.copyHint}>（长按复制）</Text>
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputField}>
                <Text style={styles.inputLabel}>昵称 / 姓名</Text>
                <TextInput
                  style={styles.textInput}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="设置您的个性昵称"
                  placeholderTextColor="#a09078"
                  maxLength={16}
                />
              </View>

              <View style={styles.profileActionRow}>
                <TouchableOpacity
                  style={styles.saveProfileButton}
                  onPress={handleSaveProfile}
                  disabled={isSavingProfile}
                >
                  {isSavingProfile ? (
                    <ActivityIndicator color="#faf6ef" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#faf6ef" />
                      <Text style={styles.saveProfileText}>保存个人资料</Text>
                    </>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={18} color="#c6604a" />
                  <Text style={styles.logoutText}>退出登录</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* 2. Offline Backups */}
        {activeSection === "backup" && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={handleExport}
              disabled={exporting}
              activeOpacity={0.8}
            >
              <View style={styles.actionIcon}>
                <Ionicons name="archive-outline" size={22} color="#faf6ef" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>一键导出离线 ZIP 备份</Text>
                <Text style={styles.actionDesc}>
                  打包所有日记（含封面照片、语音音频及精美 HTML 播放阅读页）
                </Text>
              </View>
              {exporting ? (
                <ActivityIndicator color="#c6604a" size="small" />
              ) : (
                <Ionicons name="chevron-forward" size={20} color="#8b7355" />
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* 3. Local Tags */}
        {activeSection === "tags" && (
          <View style={styles.section}>
            <View style={styles.tagCard}>
              <Text style={styles.tagLabel}>事件类型 (点击标签可删除)</Text>
              <View style={styles.tagRow}>
                {eventTags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={styles.tag}
                    onPress={() => handleDeleteEventTag(tag)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.tagText}>
                      {tag}
                      <Text style={styles.tagDeleteText}> ×</Text>
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.addTagInputRow}>
                <TextInput
                  style={styles.tagInput}
                  placeholder="新增事件标签..."
                  placeholderTextColor="#a09078"
                  value={newEventTag}
                  onChangeText={setNewEventTag}
                  maxLength={10}
                />
                <TouchableOpacity style={styles.addTagButton} onPress={handleAddEventTag}>
                  <Text style={styles.addTagButtonText}>添加</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={[styles.tagLabel, { marginTop: 24 }]}>情绪状态 (点击标签可删除)</Text>
              <View style={styles.tagRow}>
                {moodTags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={styles.tag}
                    onPress={() => handleDeleteMoodTag(tag)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.tagText}>
                      {tag}
                      <Text style={styles.tagDeleteText}> ×</Text>
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.addTagInputRow}>
                <TextInput
                  style={styles.tagInput}
                  placeholder="新增情绪标签..."
                  placeholderTextColor="#a09078"
                  value={newMoodTag}
                  onChangeText={setNewMoodTag}
                  maxLength={10}
                />
                <TouchableOpacity style={styles.addTagButton} onPress={handleAddMoodTag}>
                  <Text style={styles.addTagButtonText}>添加</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* 4. Preference Settings Panel */}
        {activeSection === "preferences" && (
          <View style={styles.section}>
            <View style={styles.tagCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>分析后保留人声录音</Text>
                  <Text style={styles.settingDesc}>开启后，您说话的音频数据将完整保留于本机沙盒中</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setKeepAudio(!keepAudio)}
                  activeOpacity={0.8}
                  style={[styles.toggleBg, keepAudio ? styles.toggleBgOn : null]}
                >
                  <View style={[styles.toggleCircle, keepAudio ? styles.toggleCircleOn : null]} />
                </TouchableOpacity>
              </View>

              <View style={[styles.settingRow, { marginTop: 16, borderTopWidth: 1, borderTopColor: "#ede4d5", paddingTop: 16 }]}>
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>AI 语音回复自动播放</Text>
                  <Text style={styles.settingDesc}>在对话流程中，AI 分析完画面或文字后自动播放语音回复</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setAutoplayVoice(!autoplayVoice)}
                  activeOpacity={0.8}
                  style={[styles.toggleBg, autoplayVoice ? styles.toggleBgOn : null]}
                >
                  <View style={[styles.toggleCircle, autoplayVoice ? styles.toggleCircleOn : null]} />
                </TouchableOpacity>
              </View>

              <View style={[styles.settingRow, { marginTop: 16, borderTopWidth: 1, borderTopColor: "#ede4d5", paddingTop: 16 }]}>
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>大字号阅读手账</Text>
                  <Text style={styles.settingDesc}>自动调大日记详情页的正文字号，提供舒适阅读视觉</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setLargeText(!largeText)}
                  activeOpacity={0.8}
                  style={[styles.toggleBg, largeText ? styles.toggleBgOn : null]}
                >
                  <View style={[styles.toggleCircle, largeText ? styles.toggleCircleOn : null]} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* 5. AI Settings Panel */}
        {activeSection === "ai" && (
          <View style={styles.section}>
            {/* Card 1: Direct Local AI */}
            <View style={styles.tagCard}>
              <Text style={[styles.tagLabel, { fontSize: 14, marginBottom: 12 }]}>本地公网直连 AI</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingTitle}>启用本地直连 AI (Direct AI)</Text>
                  <Text style={styles.settingDesc}>
                    开启后将直接连接智谱 AI 官方接口，不再通过 Next.js 后端服务中转，适合局域网不通时开启。
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setUseLocalAi(!useLocalAi)}
                  activeOpacity={0.8}
                  style={[styles.toggleBg, useLocalAi ? styles.toggleBgOn : null]}
                >
                  <View style={[styles.toggleCircle, useLocalAi ? styles.toggleCircleOn : null]} />
                </TouchableOpacity>
              </View>

              <View style={[styles.inputField, { marginTop: 16, borderTopWidth: 1, borderTopColor: "#ede4d5", paddingTop: 16 }]}>
                <Text style={styles.inputLabel}>智谱 AI API Key</Text>
                <TextInput
                  style={styles.textInput}
                  value={glmApiKey}
                  onChangeText={setGlmApiKey}
                  placeholder="请输入您的 Zhipu API Key"
                  placeholderTextColor="#a09078"
                  secureTextEntry={true}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={[styles.settingDesc, { marginTop: 6 }]}>
                  请前往智谱 AI 开放平台 (bigmodel.cn) 注册并免费申请 API Key。
                </Text>
              </View>

              <View style={[styles.profileActionRow, { marginTop: 16 }]}>
                <TouchableOpacity
                  style={styles.saveProfileButton}
                  onPress={handleSaveAiConfig}
                  disabled={isSavingAi}
                >
                  {isSavingAi ? (
                    <ActivityIndicator color="#faf6ef" size="small" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={18} color="#faf6ef" />
                      <Text style={styles.saveProfileText}>保存配置</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.logoutButton, { borderColor: "#9370db" }]}
                  onPress={handleTestAiConnection}
                  disabled={isTestingAi}
                >
                  {isTestingAi ? (
                    <ActivityIndicator color="#9370db" size="small" />
                  ) : (
                    <>
                      <Ionicons name="flash-outline" size={18} color="#9370db" />
                      <Text style={[styles.logoutText, { color: "#9370db" }]}>测试 AI</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Card 2: Server Proxy Configuration */}
            <View style={[styles.tagCard, { marginTop: 16 }]}>
              <Text style={[styles.tagLabel, { fontSize: 14, marginBottom: 12 }]}>电脑开发服务端配置 (代理模式)</Text>
              
              <View style={styles.inputField}>
                <Text style={styles.inputLabel}>代理接口地址 (API Base URL)</Text>
                <TextInput
                  style={styles.textInput}
                  value={apiUrl}
                  onChangeText={setApiUrl}
                  placeholder="例如: http://192.168.1.100:3000"
                  placeholderTextColor="#a09078"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={[styles.settingDesc, { marginTop: 6 }]}>
                  当关闭“本地直连 AI”时，手机端将通过该代理地址连接到您电脑运行的 Next.js 服务端进行多模态和语音中转。
                </Text>
              </View>

              <View style={[styles.profileActionRow, { marginTop: 16 }]}>
                <TouchableOpacity
                  style={styles.saveProfileButton}
                  onPress={handleSaveApiUrl}
                  disabled={isSavingApi}
                >
                  {isSavingApi ? (
                    <ActivityIndicator color="#faf6ef" size="small" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={18} color="#faf6ef" />
                      <Text style={styles.saveProfileText}>保存地址</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.logoutButton, { borderColor: "#8b7355" }]}
                  onPress={handleTestConnection}
                  disabled={isTestingConnection}
                >
                  {isTestingConnection ? (
                    <ActivityIndicator color="#8b7355" size="small" />
                  ) : (
                    <>
                      <Ionicons name="swap-horizontal-outline" size={18} color="#8b7355" />
                      <Text style={[styles.logoutText, { color: "#8b7355" }]}>测试连接</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Info */}
        <View style={styles.infoSection}>
          <Ionicons name="shield-checkmark" size={32} color="#8b7355" style={{ opacity: 0.6 }} />
          <Text style={styles.infoText}>怪咖日记 · 本地隐私日记本 v1.0.0</Text>
          <Text style={styles.infoSubtext}>您的所有数据与媒体素材均在本地沙盒存储，绝不上云</Text>
        </View>
      </ScrollView>

      {/* 头像修改 Modal */}
      <Modal
        visible={showAvatarModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>更换头像</Text>
            
            <View style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>预设炫彩渐变</Text>
              <View style={styles.presetsGrid}>
                {[
                  "#ff7f50",
                  "#20b2aa",
                  "#9370db",
                  "#6395ee",
                  "#e06666",
                  "#b5a642"
                ].map((grad, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      setAvatarUrl(`gradient:${i}`);
                      setShowAvatarModal(false);
                    }}
                    style={[
                      styles.presetBubble,
                      { backgroundColor: grad },
                      avatarUrl === `gradient:${i}` ? styles.presetBubbleSelected : null
                    ]}
                  />
                ))}
              </View>

              <View style={styles.modalDivider}>
                <View style={styles.modalDividerLine} />
                <Text style={styles.modalDividerText}>或</Text>
                <View style={styles.modalDividerLine} />
              </View>

              <TouchableOpacity
                style={styles.modalPickerButton}
                onPress={handleAvatarUpload}
                activeOpacity={0.8}
              >
                <Ionicons name="image-outline" size={20} color="#faf6ef" />
                <Text style={styles.modalPickerText}>从相册选择图片</Text>
              </TouchableOpacity>

              <View style={styles.modalCancelRow}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowAvatarModal(false)}
                >
                  <Text style={styles.modalCancelText}>取消</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f0e8",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ede4d5",
  },
  appTitle: {
    fontFamily: "System",
    fontSize: 24,
    fontWeight: "800",
    color: "#2c1810",
  },
  tagline: {
    fontSize: 11,
    color: "#8b7355",
    marginTop: 2,
    fontWeight: "600",
  },
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8b7355",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  accountCard: {
    backgroundColor: "#faf6ef",
    borderWidth: 1,
    borderColor: "#d4c5a9",
    borderRadius: 14,
    padding: 16,
    gap: 16,
  },
  accountInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#8b7355",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderWidth: 2,
    borderColor: "#faf6ef",
    shadowColor: "#2c1810",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarText: {
    color: "#faf6ef",
    fontSize: 24,
    fontWeight: "800",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 30,
  },
  avatarEditOverlay: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#c6604a",
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#faf6ef",
  },
  profileInputs: {
    flex: 1,
  },
  emailText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2c1810",
  },
  inviteText: {
    fontSize: 11,
    color: "#8b7355",
    marginTop: 4,
  },
  copyHint: {
    color: "#c6604a",
    fontWeight: "700",
  },
  inputField: {
    gap: 6,
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8b7355",
    paddingLeft: 4,
  },
  textInput: {
    backgroundColor: "#ede4d5",
    borderColor: "#d4c5a9",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#2c1810",
  },
  profileActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  saveProfileButton: {
    flex: 1.3,
    flexDirection: "row",
    backgroundColor: "#c6604a",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 11,
    gap: 6,
    shadowColor: "#c6604a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  saveProfileText: {
    fontSize: 13,
    color: "#faf6ef",
    fontWeight: "700",
  },
  logoutButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#c6604a",
    borderRadius: 10,
    paddingVertical: 11,
    gap: 6,
  },
  logoutText: {
    fontSize: 13,
    color: "#c6604a",
    fontWeight: "700",
  },
  actionCard: {
    backgroundColor: "#faf6ef",
    borderWidth: 1,
    borderColor: "#d4c5a9",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#c6604a",
    alignItems: "center",
    justifyContent: "center",
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2c1810",
  },
  actionDesc: {
    fontSize: 11,
    color: "#8b7355",
    marginTop: 2,
    lineHeight: 14,
  },
  tagCard: {
    backgroundColor: "#faf6ef",
    borderWidth: 1,
    borderColor: "#d4c5a9",
    borderRadius: 14,
    padding: 16,
  },
  tagLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8b7355",
    marginBottom: 8,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    backgroundColor: "#ede4d5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: "#d4c5a9",
  },
  tagText: {
    fontSize: 12,
    color: "#8b7355",
    fontWeight: "600",
  },
  tagDeleteText: {
    fontSize: 11,
    color: "#c6604a",
    fontWeight: "800",
  },
  addTagInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  tagInput: {
    flex: 1,
    height: 36,
    backgroundColor: "#f5f0e8",
    borderWidth: 1,
    borderColor: "#d4c5a9",
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12,
    color: "#2c1810",
  },
  addTagButton: {
    backgroundColor: "#c6604a",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addTagButtonText: {
    color: "#faf6ef",
    fontSize: 12,
    fontWeight: "700",
  },
  infoSection: {
    marginTop: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  infoText: {
    fontSize: 12,
    color: "#8b7355",
    fontWeight: "700",
  },
  infoSubtext: {
    fontSize: 10,
    color: "#8b7355",
    textAlign: "center",
    opacity: 0.6,
    lineHeight: 14,
  },
  /* Avatar change modal styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#faf6ef",
    borderWidth: 1.5,
    borderColor: "#d4c5a9",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 360,
    shadowColor: "#2c1810",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontFamily: "System",
    fontSize: 20,
    fontWeight: "800",
    color: "#2c1810",
    marginBottom: 16,
  },
  modalBody: {
    gap: 16,
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8b7355",
    marginBottom: 6,
  },
  presetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  presetBubble: {
    width: "14%",
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  presetBubbleSelected: {
    borderColor: "#c6604a",
    transform: [{ scale: 1.1 }],
  },
  modalDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  modalDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#d4c5a9",
    opacity: 0.5,
  },
  modalDividerText: {
    fontSize: 11,
    color: "#8b7355",
    marginHorizontal: 12,
    fontWeight: "700",
    opacity: 0.6,
  },
  modalPickerButton: {
    flexDirection: "row",
    backgroundColor: "#8b7355",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  modalPickerText: {
    color: "#faf6ef",
    fontSize: 14,
    fontWeight: "700",
  },
  modalCancelRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  modalCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#c6604a",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2c1810",
  },
  settingDesc: {
    fontSize: 11,
    color: "#8b7355",
    marginTop: 4,
    lineHeight: 14,
  },
  toggleBg: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ede4d5",
    padding: 2,
    justifyContent: "center",
  },
  toggleBgOn: {
    backgroundColor: "#c6604a",
  },
  toggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#faf6ef",
    shadowColor: "#2c1810",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleCircleOn: {
    alignSelf: "flex-end",
  },
  backHeaderButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  backHeaderText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#c6604a",
  },
  menuList: {
    marginTop: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuItem: {
    backgroundColor: "#faf6ef",
    borderWidth: 1,
    borderColor: "#d4c5a9",
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  menuItemIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2c1810",
  },
  menuItemSubtitle: {
    fontSize: 11,
    color: "#8b7355",
    marginTop: 2,
  },
});
