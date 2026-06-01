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
  Clipboard,
  Platform
} from "react-native";
import { useAuth } from "@/lib/auth";
import { Ionicons } from "@expo/vector-icons";
import {
  getTagSettings,
  saveTagSettings,
  TagSettings,
  getSavedAccounts,
  saveAccountToList,
  removeAccountFromList,
  purgeUserDiaries,
  type SavedAccount
} from "@/lib/storage";
import { exportAllDiariesAsZip } from "@/lib/export";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { useThemeStore } from "@/lib/tabState";
import { getApiConfig, saveApiConfig, apiPost } from "@/lib/api";
import { StellarBackground } from "@/components/StellarBackground";


export default function SettingsScreen() {
  const { user, logout, login } = useAuth();
  const { theme, setTheme } = useThemeStore();
  const styles = getDynamicStyles(theme);
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

  // Account Sub-sections & Options
  const [accountSubSection, setAccountSubSection] = useState<"menu" | "edit_profile" | "change_password" | "invitation">("menu");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPasswordState, setShowConfirmPasswordState] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [myInviteCode, setMyInviteCode] = useState(user ? `gk-${user.id.slice(0, 6).toUpperCase()}` : "");
  const [invitedBy, setInvitedBy] = useState<string | null>(null);
  const [inputInviteCode, setInputInviteCode] = useState("");
  const [invitedPeople, setInvitedPeople] = useState<Array<{ email: string; createdAt: string }>>([]);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [isLoadingInviteData, setIsLoadingInviteData] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [savedAccountsList, setSavedAccountsList] = useState<SavedAccount[]>([]);

  // Temporary editing states for profile editing tab (isolates edits from display, allowing Cancel to work)
  const [editUsername, setEditUsername] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("gradient:0");

  // Premium kraft-paper custom alert state & helper
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons: Array<{ text: string; style?: "cancel" | "destructive" | "default"; onPress?: () => void }>;
  }>({
    visible: false,
    title: "",
    message: "",
    buttons: []
  });

  const showCustomAlert = (
    title: string,
    message: string,
    buttons?: Array<{ text: string; style?: "cancel" | "destructive" | "default"; onPress?: () => void }>
  ) => {
    setCustomAlert({
      visible: true,
      title,
      message,
      buttons: buttons || [{ text: "好", onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
    });
  };

  // Local Alert shadow object to redirect all standard Alert.alert calls to the unified custom theme modal
  const Alert = {
    alert: (
      title: string,
      message?: string,
      buttons?: Array<{ text: string; style?: "cancel" | "destructive" | "default"; onPress?: () => void }>,
      options?: any
    ) => {
      showCustomAlert(title, message || "", buttons);
    }
  };

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

    // Load profile from local saved accounts first (offline-first), then auto-sync to Supabase if they mismatch
    if (user) {
      setMyInviteCode(`gk-${user.id.slice(0, 6).toUpperCase()}`);
      
      getSavedAccounts().then(async (saved) => {
        const match = saved.find((a) => a.email.toLowerCase() === user.email?.toLowerCase());
        const userMetadata = user.user_metadata;
        
        const localUsername = match?.username || user.email?.split("@")[0] || "";
        const localAvatarUrl = match?.avatarUrl || "gradient:0";
        
        // Apply local sandboxed details immediately for offline-first responsiveness
        setUsername(localUsername);
        setAvatarUrl(localAvatarUrl);

      }).catch((e) => {
        console.warn("读取本地账号凭证失败:", e);
        // Fallback to Supabase cloud metadata directly
        const userMetadata = user.user_metadata;
        setUsername(userMetadata?.username || user.email?.split("@")[0] || "");
        setAvatarUrl(userMetadata?.avatarUrl || "gradient:0");
      });
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

  useEffect(() => {
    if (activeSection === "account" && accountSubSection === "invitation") {
      loadInvitationData();
    }
  }, [activeSection, accountSubSection]);

  const verifyOldPassword = async (oldPass: string): Promise<boolean> => {
    if (!user || !user.email) return false;
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPass
      });
      return !error;
    } catch {
      return false;
    }
  };

  const handleSaveCombinedProfile = async () => {
    if (!editUsername.trim()) {
      Alert.alert("提示", "昵称不能为空。");
      return;
    }
    setIsSavingProfile(true);

    try {
      // 无论 Supabase 云端同步成功与否，本地一定要更新并持久化以支持纯本地离线运行
      const saved = await getSavedAccounts();
      const currentEmail = user?.email || "";
      const currentUserId = user?.id || "shared";
      
      const match = saved.find((a) => a.email.toLowerCase() === currentEmail.toLowerCase());
      const finalPassword = match?.password || "";
      const inviteCode = match?.inviteCode || `gk-${currentUserId.slice(0, 6).toUpperCase()}`;

      await saveAccountToList({
        userId: currentUserId,
        email: currentEmail,
        password: finalPassword,
        username: editUsername.trim(),
        avatarUrl: editAvatarUrl,
        inviteCode: inviteCode
      });

      // Commit changes to primary states locally
      setUsername(editUsername.trim());
      setAvatarUrl(editAvatarUrl);

      Alert.alert("保存成功", "个人信息只保存在本地。");
      setAccountSubSection("menu");
    } catch (localErr) {
      Alert.alert("保存失败", localErr instanceof Error ? localErr.message : "保存出错了，请重试。");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveOnlyPassword = async () => {
    if (!oldPassword.trim()) {
      Alert.alert("提示", "请输入原密码进行身份验证。");
      return;
    }
    if (!newPassword.trim()) {
      Alert.alert("提示", "请输入新密码。");
      return;
    }
    if (newPassword.trim().length < 6) {
      Alert.alert("提示", "新密码长度至少需要 6 位。");
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      Alert.alert("提示", "两次输入的新密码不一致。");
      return;
    }

    setIsSavingPassword(true);
    try {
      if (!user) throw new Error("用户未登录");

      // 1. 校验原密码
      const isOldCorrect = await verifyOldPassword(oldPassword.trim());
      if (!isOldCorrect) {
        throw new Error("原密码错误，身份验证失败。");
      }

      // 2. 同步到 Supabase Auth
      const { error: pwdError } = await supabase.auth.updateUser({
        password: newPassword.trim()
      });
      if (pwdError) throw pwdError;

      // 3. 更新本地保存的账号密文
      const saved = await getSavedAccounts();
      const match = saved.find((a) => a.email.toLowerCase() === user.email?.toLowerCase());
      const inviteCode = match?.inviteCode || `gk-${user.id.slice(0, 6).toUpperCase()}`;

      await saveAccountToList({
        userId: user.id,
        email: user.email || "",
        password: newPassword.trim(),
        username: username.trim(),
        avatarUrl: avatarUrl,
        inviteCode: inviteCode
      });

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("修改成功", "登录密码已安全同步！");
      setAccountSubSection("menu");
    } catch (e) {
      Alert.alert("修改失败", e instanceof Error ? e.message : "未知错误");
    } finally {
      setIsSavingPassword(false);
    }
  };

  const loadInvitationData = async () => {
    // 1. 缓存与静默加载优化：如果本地已有邀请码（如首屏秒开的备用码），不再展示全屏菊花转圈，实现无感加载
    const hasCached = !!myInviteCode;
    if (!hasCached) {
      setIsLoadingInviteData(true);
    }
    
    try {
      // 2. 超时快速失败设计：由于移动端网络复杂或电脑开发服务器未开启，设置 2.5 秒的极速超时，防止请求无限挂起
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const config = await getApiConfig();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`${config.apiUrl}/api/auth/invitation`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const resData = await response.json();
        if (resData && resData.ok) {
          setMyInviteCode(resData.data.my_invite_code);
          setInvitedBy(resData.data.invited_by);
          setInvitedPeople(resData.data.invited_people || []);
        }
      }
    } catch (err) {
      console.warn("加载邀请系统数据超时或失败，已自动使用本地算力生成的备用专属邀请码", err);
    } finally {
      setIsLoadingInviteData(false);
    }
  };

  const handleBindInviter = async () => {
    const code = inputInviteCode.trim();
    if (!code) {
      Alert.alert("提示", "请输入专属邀请码");
      return;
    }

    setIsSubmittingInvite(true);
    try {
      const res = await apiPost("/api/auth/invitation", { inviteCode: code });
      const data = await res.json();
      if (data && data.ok) {
        Alert.alert("绑定成功", "已成功绑定邀请人！");
        setInputInviteCode("");
        await loadInvitationData();
      } else {
        Alert.alert("绑定失败", data?.error || "专属邀请码无效或已被绑定");
      }
    } catch (err) {
      Alert.alert("绑定出错", err instanceof Error ? err.message : "请求失败，请检查网络");
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleOpenSwitchModal = async () => {
    try {
      const list = await getSavedAccounts();
      setSavedAccountsList(list);
      setShowSwitchModal(true);
    } catch (e) {
      console.warn("加载保存的账号列表失败", e);
    }
  };

  const handleSwitchAccount = async (account: SavedAccount) => {
    if (account.email.toLowerCase() === user?.email?.toLowerCase()) {
      Alert.alert("提示", "您目前已经登录该账号。");
      return;
    }

    if (!account.password) {
      Alert.alert("提示", "该账号未保存密码，请退出当前账号后手动输入密码登录。");
      return;
    }

    setShowSwitchModal(false);
    setIsSavingProfile(true);

    try {
      // 直接登录新账号，这会自动覆盖当前 Session，避免频繁的注销和页面重定向抖动
      await login(account.email, account.password);

      // 更新在本地保存账号列表中的最后使用时间
      await saveAccountToList({
        userId: account.userId,
        email: account.email,
        password: account.password,
        username: account.username || account.email.split("@")[0],
        avatarUrl: account.avatarUrl || "gradient:0",
        inviteCode: account.inviteCode || `gk-${account.userId.slice(0, 6).toUpperCase()}`
      });

      Alert.alert("切换成功", `欢迎回来，${account.username || account.email}！`);
    } catch (err) {
      Alert.alert("切换失败", err instanceof Error ? err.message : "自动登录失败，请手动登录。");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSwitchToNewAccount = async () => {
    setShowSwitchModal(false);
    Alert.alert("登录新账号", "即将退出当前账号以登录新账户，是否确定？", [
      { text: "取消", style: "cancel" },
      {
        text: "确定",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
          } catch (err) {
            console.warn("登出失败", err);
          }
        }
      }
    ]);
  };

  const handleDeleteSavedAccount = async (email: string) => {
    try {
      await removeAccountFromList(email);
      const list = await getSavedAccounts();
      setSavedAccountsList(list);
    } catch (e) {
      console.warn("删除保存账号失败", e);
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "危险操作：注销并彻底删除账户",
      "此操作将永久注销当前账户并抹去所有保存在本机的专属日记、封面照片和录音文件！该操作不可撤销，确定要彻底删除吗？",
      [
        { text: "取消", style: "cancel" },
        {
          text: "确定彻底删除",
          style: "destructive",
          onPress: async () => {
            setIsSavingProfile(true);
            try {
              if (!user) throw new Error("用户未登录");
              const userEmail = user.email || "";

              // 1. 擦除本地沙盒中的全部日记、图片、音频文件
              await purgeUserDiaries();

              // 2. 从本地已存账号列表中移除
              await removeAccountFromList(userEmail);

              // 3. 注销 Supabase Session 退出登录
              await logout();

              Alert.alert("注销成功", "该账户的本地数据及照片录音已安全抹除，会话已安全退出。");
            } catch (err) {
              Alert.alert("注销失败", err instanceof Error ? err.message : "未知错误");
            } finally {
              setIsSavingProfile(false);
            }
          }
        }
      ]
    );
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
        if (accountSubSection === "edit_profile") {
          setEditAvatarUrl(base64Data);
        } else {
          setAvatarUrl(base64Data);
        }
        setShowAvatarModal(false);
      }
    } catch (err) {
      Alert.alert("错误", "图片读取失败，请重试。");
    }
  };

  const handleCopyInviteCode = () => {
    const inviteCode = `gk-${(user?.id || "USER").slice(0, 6).toUpperCase()}`;
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
      {
        text: "退出",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
          } catch (e) {
            console.warn("退出注销遇到报错已安全吞掉:", e);
          }
        }
      }
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

  const isEditGradient = editAvatarUrl?.startsWith("gradient:");
  const editGradientIndex = isEditGradient ? parseInt(editAvatarUrl.split(":")[1], 10) : 0;
  const editGradientColor = gradients[editGradientIndex] || gradients[0];

  const isStellar = theme === "stellar";

  const renderContent = () => (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: isStellar ? "transparent" : "#f5f0e8" }]}>
      <View style={styles.header}>
        {activeSection !== null && (
          <TouchableOpacity
            style={styles.backHeaderButton}
            onPress={() => {
              if (activeSection === "account" && accountSubSection !== "menu") {
                setAccountSubSection("menu");
              } else {
                setActiveSection(null);
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#c6604a" />
            <Text style={styles.backHeaderText}>
              {activeSection === "account" && accountSubSection !== "menu" ? "返回资料卡" : "返回主页"}
            </Text>
          </TouchableOpacity>
        )}
        <View>
          <Text style={styles.appTitle}>
            {activeSection === "account" && (
              accountSubSection === "edit_profile" ? "修改个人信息" :
              accountSubSection === "change_password" ? "修改登录密码" :
              accountSubSection === "invitation" ? "邀请管理系统" : "账户与个人中心"
            )}
            {activeSection === "tags" && "日记标签预设"}
            {activeSection === "backup" && "数据备份导出"}
            {activeSection === "preferences" && "应用优先偏好"}
            {activeSection === "ai" && "AI 密钥与直连配置"}
            {activeSection === null && "系统设置"}
          </Text>
          <Text style={styles.tagline}>
            {activeSection === "account" && (
              accountSubSection === "edit_profile" ? "更新您的头像、个性昵称以及登录密码" :
              accountSubSection === "change_password" ? "设置您的登录新密码，此密码将同步到云端数据库" :
              accountSubSection === "invitation" ? "查看我的专属邀请码、已成功邀请的好友及绑定邀请人" : "管理您的头像、昵称、密码及专属邀请码"
            )}
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
            {accountSubSection === "menu" && (
              <View style={styles.accountCard}>
                <View style={styles.accountInfo}>
                  <View
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
                  </View>
 
                  <View style={styles.profileInputs}>
                    <Text style={styles.emailText}>
                      {username || user?.email?.split("@")[0] || "未设置昵称"}
                    </Text>
                    <Text style={[styles.inviteText, { color: "#8b7355", marginTop: 4 }]}>
                      邮箱: {user?.email}
                    </Text>
                  </View>
                </View>

                {/* Sub Menu Tabs List */}
                <View style={{ marginTop: 8, gap: 10 }}>
                  <TouchableOpacity
                    style={styles.subOptionTab}
                    onPress={() => {
                      setEditUsername(username);
                      setEditAvatarUrl(avatarUrl);
                      setAccountSubSection("edit_profile");
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.subOptionLeft}>
                      <Ionicons name="person-circle-outline" size={20} color="#c6604a" />
                      <Text style={styles.subOptionTitle}>修改个人信息</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#8b7355" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.subOptionTab}
                    onPress={() => setAccountSubSection("change_password")}
                    activeOpacity={0.7}
                  >
                    <View style={styles.subOptionLeft}>
                      <Ionicons name="key-outline" size={20} color="#8b7355" />
                      <Text style={styles.subOptionTitle}>修改密码</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#8b7355" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.subOptionTab}
                    onPress={() => setAccountSubSection("invitation")}
                    activeOpacity={0.7}
                  >
                    <View style={styles.subOptionLeft}>
                      <Ionicons name="gift-outline" size={20} color="#9370db" />
                      <Text style={styles.subOptionTitle}>邀请系统</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#8b7355" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.subOptionTab}
                    onPress={handleDeleteAccount}
                    activeOpacity={0.7}
                  >
                    <View style={styles.subOptionLeft}>
                      <Ionicons name="trash-outline" size={20} color="#c6604a" />
                      <Text style={[styles.subOptionTitle, { color: "#c6604a" }]}>注销并删除账户</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#c6604a" />
                  </TouchableOpacity>
                </View>

                {/* Theme Selector Row */}
                <View style={styles.themeSelectorContainer}>
                  <Text style={styles.themeLabel}>手账空间主题</Text>
                  <View style={styles.themeButtonRow}>
                    <TouchableOpacity
                      style={[
                        styles.themeSelectBtn,
                        theme === "kraft" ? styles.activeThemeBtnKraft : styles.inactiveThemeBtn
                      ]}
                      onPress={() => setTheme("kraft")}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="journal-outline" size={14} color={theme === "kraft" ? "#faf6ef" : "#8b7355"} />
                      <Text style={[styles.themeBtnText, theme === "kraft" ? styles.activeThemeTextKraft : styles.inactiveThemeText]}>
                        羊皮纸
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.themeSelectBtn,
                        theme === "stellar" ? styles.activeThemeBtnStellar : styles.inactiveThemeBtn
                      ]}
                      onPress={() => setTheme("stellar")}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="sparkles-outline" size={14} color={theme === "stellar" ? "#ffdfa9" : "#8b7355"} />
                      <Text style={[styles.themeBtnText, theme === "stellar" ? styles.activeThemeTextStellar : styles.inactiveThemeText]}>
                        星夜
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Actions Row */}
                <View style={[styles.profileActionRow, { marginTop: 12 }]}>
                  <TouchableOpacity
                    style={[styles.saveProfileButton, { backgroundColor: "#8b7355" }]}
                    onPress={handleOpenSwitchModal}
                  >
                    <Ionicons name="swap-horizontal-outline" size={18} color="#faf6ef" />
                    <Text style={styles.saveProfileText}>切换账户</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={18} color="#c6604a" />
                    <Text style={styles.logoutText}>退出登录</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Sub-section 1: Edit Profile */}
            {accountSubSection === "edit_profile" && (
              <View style={styles.accountCard}>
                <View style={{ alignItems: "center", marginVertical: 8 }}>
                  <TouchableOpacity
                    onPress={() => setShowAvatarModal(true)}
                    activeOpacity={0.8}
                    style={[
                      styles.avatar,
                      { width: 80, height: 80, borderRadius: 40 },
                      isEditGradient ? { backgroundColor: editGradientColor } : null
                    ]}
                  >
                    {isEditGradient ? (
                      <Text style={[styles.avatarText, { fontSize: 32 }]}>
                        {(editUsername || user?.email || "U").slice(0, 1).toUpperCase()}
                      </Text>
                    ) : (
                      <Image source={{ uri: editAvatarUrl }} style={[styles.avatarImage, { borderRadius: 38 }]} />
                    )}
                    <View style={[styles.avatarEditOverlay, { right: 2, bottom: 2 }]}>
                      <Ionicons name="camera" size={14} color="#faf6ef" />
                    </View>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 11, color: "#8b7355", marginTop: 6, fontWeight: "600" }}>
                    点击更换头像
                  </Text>
                </View>

                <View style={styles.inputField}>
                  <Text style={styles.inputLabel}>昵称</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editUsername}
                    onChangeText={setEditUsername}
                    placeholder="设置您的个性昵称"
                    placeholderTextColor="#a09078"
                    maxLength={16}
                  />
                </View>



                <View style={[styles.profileActionRow, { marginTop: 12 }]}>
                  <TouchableOpacity
                    style={styles.saveProfileButton}
                    onPress={handleSaveCombinedProfile}
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? (
                      <ActivityIndicator color="#faf6ef" size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color="#faf6ef" />
                        <Text style={styles.saveProfileText}>保存修改</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.logoutButton, { borderColor: "#8b7355" }]}
                    onPress={() => setAccountSubSection("menu")}
                  >
                    <Text style={[styles.logoutText, { color: "#8b7355" }]}>取消</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Sub-section 2: Change Password Only */}
            {accountSubSection === "change_password" && (
              <View style={styles.accountCard}>
                <View style={styles.inputField}>
                  <Text style={styles.inputLabel}>原密码</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      value={oldPassword}
                      onChangeText={setOldPassword}
                      placeholder="请输入当前的原密码"
                      placeholderTextColor="#a09078"
                      secureTextEntry={!showOldPassword}
                      maxLength={32}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowOldPassword(!showOldPassword)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showOldPassword ? "eye-outline" : "eye-off-outline"}
                        size={18}
                        color="#8b7355"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputField}>
                  <Text style={styles.inputLabel}>新密码</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="请输入新密码，至少6位"
                      placeholderTextColor="#a09078"
                      secureTextEntry={!showNewPassword}
                      maxLength={32}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowNewPassword(!showNewPassword)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showNewPassword ? "eye-outline" : "eye-off-outline"}
                        size={18}
                        color="#8b7355"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputField}>
                  <Text style={styles.inputLabel}>确认新密码</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="请再次输入新密码"
                      placeholderTextColor="#a09078"
                      secureTextEntry={!showConfirmPasswordState}
                      maxLength={32}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowConfirmPasswordState(!showConfirmPasswordState)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showConfirmPasswordState ? "eye-outline" : "eye-off-outline"}
                        size={18}
                        color="#8b7355"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={[styles.profileActionRow, { marginTop: 12 }]}>
                  <TouchableOpacity
                    style={styles.saveProfileButton}
                    onPress={handleSaveOnlyPassword}
                    disabled={isSavingPassword}
                  >
                    {isSavingPassword ? (
                      <ActivityIndicator color="#faf6ef" size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color="#faf6ef" />
                        <Text style={styles.saveProfileText}>修改密码</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.logoutButton, { borderColor: "#8b7355" }]}
                    onPress={() => setAccountSubSection("menu")}
                  >
                    <Text style={[styles.logoutText, { color: "#8b7355" }]}>取消</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Sub-section 3: Invitation System */}
            {accountSubSection === "invitation" && (
              <View style={styles.accountCard}>
                {isLoadingInviteData ? (
                  <View style={{ padding: 24, alignItems: "center" }}>
                    <ActivityIndicator size="small" color="#c6604a" />
                    <Text style={{ fontSize: 12, color: "#8b7355", marginTop: 8 }}>加载邀请数据中...</Text>
                  </View>
                ) : (
                  <View style={{ gap: 16 }}>
                    {/* Part 1: My Invitation Code */}
                    <View style={styles.inviteBox}>
                      <Text style={styles.inviteBoxLabel}>我的专属邀请码</Text>
                      <TouchableOpacity
                        style={styles.inviteCodeCard}
                        onPress={() => {
                          Clipboard.setString(myInviteCode);
                          Alert.alert("复制成功", "您的专属邀请码已复制！");
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.inviteCodeText}>{myInviteCode}</Text>
                        <View style={styles.copyBtn}>
                          <Ionicons name="copy-outline" size={14} color="#faf6ef" />
                          <Text style={styles.copyBtnText}>复制</Text>
                        </View>
                      </TouchableOpacity>
                      <Text style={{ fontSize: 10, color: "#8b7355", opacity: 0.8, marginTop: 4 }}>
                        分享专属邀请码给好友，邀请更多朋友加入！
                      </Text>
                    </View>

                    {/* Part 2: Invited By */}
                    <View style={styles.inviteBox}>
                      <Text style={styles.inviteBoxLabel}>我被谁邀请</Text>
                      {invitedBy ? (
                        <View style={styles.invitedBySuccessCard}>
                          <Ionicons name="checkmark-circle" size={16} color="#20b2aa" />
                          <Text style={styles.invitedBySuccessText}>由 {invitedBy} 邀请入驻</Text>
                        </View>
                      ) : (
                        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                          <TextInput
                            style={[styles.textInput, { flex: 1, paddingVertical: 8, fontSize: 13 }]}
                            value={inputInviteCode}
                            onChangeText={setInputInviteCode}
                            placeholder="输入对方的专属邀请码"
                            placeholderTextColor="#a09078"
                            autoCapitalize="characters"
                            maxLength={10}
                          />
                          <TouchableOpacity
                            style={[styles.saveProfileButton, { flex: 0, paddingHorizontal: 16, height: 42, justifyContent: "center", alignItems: "center" }]}
                            onPress={handleBindInviter}
                            disabled={isSubmittingInvite}
                          >
                            {isSubmittingInvite ? (
                              <ActivityIndicator color="#faf6ef" size="small" />
                            ) : (
                              <Text style={styles.saveProfileText}>确认绑定</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {/* Part 3: Invited People */}
                    <View style={styles.inviteBox}>
                      <Text style={styles.inviteBoxLabel}>我邀请的人 ({invitedPeople.length}人)</Text>
                      {invitedPeople.length === 0 ? (
                        <View style={styles.emptyInviteesCard}>
                          <Text style={{ fontSize: 11, color: "#8b7355", fontStyle: "italic", textAlign: "center" }}>
                            暂未邀请好友，快去分享你的邀请码吧！
                          </Text>
                        </View>
                      ) : (
                        <ScrollView style={{ maxHeight: 120, marginTop: 4 }} nestedScrollEnabled={true}>
                          <View style={{ gap: 6 }}>
                            {invitedPeople.map((item, idx) => (
                              <View key={idx} style={styles.inviteeRow}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                                  <Ionicons name="person-outline" size={12} color="#c6604a" />
                                  <Text style={styles.inviteeEmail} numberOfLines={1}>{item.email}</Text>
                                </View>
                                <Text style={styles.inviteeDate}>
                                  {new Date(item.createdAt).toLocaleDateString()}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </ScrollView>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[styles.logoutButton, { width: "100%", borderColor: "#8b7355", marginTop: 4 }]}
                      onPress={() => setAccountSubSection("menu")}
                    >
                      <Text style={[styles.logoutText, { color: "#8b7355" }]}>返回账户中心</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
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
                      if (accountSubSection === "edit_profile") {
                        setEditAvatarUrl(`gradient:${i}`);
                      } else {
                        setAvatarUrl(`gradient:${i}`);
                      }
                      setShowAvatarModal(false);
                    }}
                    style={[
                      styles.presetBubble,
                      { backgroundColor: grad },
                      (accountSubSection === "edit_profile" ? editAvatarUrl : avatarUrl) === `gradient:${i}` ? styles.presetBubbleSelected : null
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

      {/* 切换账户 Modal */}
      <Modal
        visible={showSwitchModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSwitchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "80%" }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={styles.modalTitle}>切换账户</Text>
              <TouchableOpacity onPress={() => setShowSwitchModal(false)}>
                <Ionicons name="close" size={24} color="#8b7355" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled={true}>
              {savedAccountsList.length === 0 ? (
                <View style={{ paddingVertical: 20, alignItems: "center" }}>
                  <Text style={{ fontSize: 13, color: "#8b7355", fontStyle: "italic" }}>
                    没有其他已保存的账户
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {savedAccountsList.map((account) => {
                    const isCurrent = account.email.toLowerCase() === user?.email?.toLowerCase();
                    const isGrad = account.avatarUrl?.startsWith("gradient:");
                    const gradIdx = isGrad ? parseInt(account.avatarUrl!.split(":")[1], 10) : 0;
                    const gradColors = [
                      "#ff7f50",
                      "#20b2aa",
                      "#9370db",
                      "#6395ee",
                      "#e06666",
                      "#b5a642"
                    ];
                    const gradCol = gradColors[gradIdx] || gradColors[0];

                    return (
                      <View key={account.email} style={[styles.savedCard, isCurrent && { borderColor: "#c6604a", borderWidth: 1.5 }]}>
                        <TouchableOpacity
                          style={styles.savedCardPress}
                          onPress={() => handleSwitchAccount(account)}
                          disabled={isSavingProfile}
                        >
                          {isGrad ? (
                            <View style={[styles.savedAvatar, { backgroundColor: gradCol }]}>
                              <Text style={styles.savedAvatarText}>
                                {(account.username || account.email).slice(0, 1).toUpperCase()}
                              </Text>
                            </View>
                          ) : (
                            <Image source={{ uri: account.avatarUrl }} style={styles.savedAvatarImage} />
                          )}
                          <View style={styles.savedInfo}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text style={styles.savedUsername}>{account.username || account.email.split("@")[0]}</Text>
                              {isCurrent && (
                                <View style={styles.currentTag}>
                                  <Text style={styles.currentTagText}>当前登录</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.savedEmail}>{account.email}</Text>
                          </View>
                        </TouchableOpacity>
                        
                        {!isCurrent && (
                          <TouchableOpacity
                            style={styles.savedDeleteBtn}
                            onPress={() => handleDeleteSavedAccount(account.email)}
                          >
                            <Ionicons name="trash-outline" size={16} color="#c6604a" />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalDivider}>
              <View style={styles.modalDividerLine} />
            </View>

            <TouchableOpacity
              style={[styles.modalPickerButton, { backgroundColor: "#c6604a", marginTop: 8 }]}
              onPress={handleSwitchToNewAccount}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={20} color="#faf6ef" />
              <Text style={styles.modalPickerText}>使用新账户登录</Text>
            </TouchableOpacity>

            <View style={styles.modalCancelRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowSwitchModal(false)}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Global Loading Overlay */}
      {isSavingProfile && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={isStellar ? "#ffdfa9" : "#c6604a"} />
          <Text style={styles.loadingText}>正在处理中，请稍后...</Text>
        </View>
      )}

      {/* Custom Hand-crafted Theme Alert Modal */}
      <Modal
        visible={customAlert.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            <Text style={styles.alertTitle}>{customAlert.title}</Text>
            <Text style={styles.alertMessage}>{customAlert.message}</Text>
            <View style={[styles.alertButtonRow, customAlert.buttons.length > 2 ? { flexDirection: "column" } : { flexDirection: "row" }]}>
              {customAlert.buttons.map((btn, index) => {
                const isDestructive = btn.style === "destructive";
                const isCancel = btn.style === "cancel";
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.alertButton,
                      isDestructive ? styles.alertButtonDestructive : isCancel ? styles.alertButtonCancel : styles.alertButtonDefault,
                      customAlert.buttons.length > 2 ? { width: "100%", marginTop: 8 } : { flex: 1 }
                    ]}
                    onPress={() => {
                      setCustomAlert(prev => ({ ...prev, visible: false }));
                      if (btn.onPress) {
                        btn.onPress();
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.alertButtonText,
                        isDestructive ? styles.alertButtonTextDestructive : isCancel ? styles.alertButtonTextCancel : styles.alertButtonTextDefault
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  if (isStellar) {
    return (
      <View style={{ flex: 1, backgroundColor: "#070a18" }}>
        <StellarBackground>{renderContent()}</StellarBackground>
      </View>
    );
  }
  return renderContent();
}

const staticStyles = StyleSheet.create({
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
  passwordInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ede4d5",
    borderColor: "#d4c5a9",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: "#2c1810",
    height: "100%",
    padding: 0,
  },
  eyeButton: {
    padding: 8,
    marginRight: -6,
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
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: "#d4c5a9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  tagText: {
    fontSize: 12,
    color: "#8b7355",
    fontWeight: "600",
    paddingHorizontal: 3, // 为 Android 粗体渲染预留额外测算宽度，彻底解决尾部截断 bug
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
  /* New multi-account & invitation styling rules */
  subOptionTab: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ede4d5",
    borderWidth: 1,
    borderColor: "#d4c5a9",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  subOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  subOptionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2c1810",
  },
  inviteBox: {
    backgroundColor: "#ede4d5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d4c5a9",
    padding: 12,
    gap: 8,
  },
  inviteBoxLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8b7355",
  },
  inviteCodeCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#faf6ef",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d4c5a9",
    padding: 10,
  },
  inviteCodeText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2c1810",
    letterSpacing: 1,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#c6604a",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  copyBtnText: {
    color: "#faf6ef",
    fontSize: 12,
    fontWeight: "700",
  },
  invitedBySuccessCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#faf6ef",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d4c5a9",
    padding: 10,
    gap: 8,
  },
  invitedBySuccessText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2c1810",
  },
  emptyInviteesCard: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#faf6ef",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d4c5a9",
  },
  inviteeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#faf6ef",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d4c5a9",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  inviteeEmail: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2c1810",
  },
  inviteeDate: {
    fontSize: 10,
    color: "#8b7355",
    fontWeight: "600",
  },
  savedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ede4d5",
    borderColor: "#d4c5a9",
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    gap: 10,
  },
  savedCardPress: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  savedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  savedAvatarText: {
    color: "#faf6ef",
    fontSize: 14,
    fontWeight: "800",
  },
  savedAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d4c5a9",
  },
  savedInfo: {
    flex: 1,
  },
  savedUsername: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2c1810",
  },
  savedEmail: {
    fontSize: 11,
    color: "#8b7355",
    marginTop: 1,
  },
  savedDeleteBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#faf6ef",
    borderWidth: 1,
    borderColor: "#d4c5a9",
  },
  currentTag: {
    backgroundColor: "#c6604a",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  currentTagText: {
    fontSize: 9,
    color: "#faf6ef",
    fontWeight: "700",
  },
  // Custom Kraft-Paper Alert & Loading Styles
  loadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(245, 240, 232, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#8b7355",
    fontWeight: "700",
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  alertContainer: {
    width: "85%",
    backgroundColor: "#faf6ef",
    borderWidth: 2,
    borderColor: "#d4c5a9",
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    shadowColor: "#2c1810",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2c1810",
    textAlign: "center",
    marginBottom: 8,
  },
  alertMessage: {
    fontSize: 14,
    color: "#5c4a37",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    fontWeight: "500",
  },
  alertButtonRow: {
    gap: 10,
    width: "100%",
    justifyContent: "center",
  },
  alertButton: {
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  alertButtonDefault: {
    backgroundColor: "#8b7355",
    borderWidth: 1,
    borderColor: "#8b7355",
  },
  alertButtonCancel: {
    backgroundColor: "#ede4d5",
    borderWidth: 1,
    borderColor: "#d4c5a9",
  },
  alertButtonDestructive: {
    backgroundColor: "#c6604a",
    borderWidth: 1,
    borderColor: "#c6604a",
  },
  alertButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  alertButtonTextDefault: {
    color: "#faf6ef",
  },
  alertButtonTextCancel: {
    color: "#8b7355",
  },
  alertButtonTextDestructive: {
    color: "#faf6ef",
  },
  themeSelectorContainer: {
    marginVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#ede4d5",
    paddingTop: 12,
    gap: 8,
  },
  themeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8b7355",
    paddingLeft: 4,
  },
  themeButtonRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  themeSelectBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  inactiveThemeBtn: {
    backgroundColor: "#ede4d5",
    borderColor: "#d4c5a9",
  },
  activeThemeBtnKraft: {
    backgroundColor: "#c6604a",
    borderColor: "#c6604a",
  },
  activeThemeBtnStellar: {
    backgroundColor: "rgba(255, 223, 169, 0.18)",
    borderColor: "rgba(255, 223, 169, 0.45)",
  },
  themeBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  inactiveThemeText: {
    color: "#8b7355",
  },
  activeThemeTextKraft: {
    color: "#faf6ef",
  },
  activeThemeTextStellar: {
    color: "#ffdfa9",
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
    },
    appTitle: {
      ...staticStyles.appTitle,
      color: isStellar ? "#ffdfa9" : "#2c1810",
      fontFamily: isStellar ? (Platform.OS === "ios" ? "Georgia" : "serif") : "System",
    },
    tagline: {
      ...staticStyles.tagline,
      color: isStellar ? "rgba(255, 223, 169, 0.5)" : "#8b7355",
    },
    sectionHeader: {
      ...staticStyles.sectionHeader,
      color: isStellar ? "rgba(255, 223, 169, 0.6)" : "#8b7355",
    },
    accountCard: {
      ...staticStyles.accountCard,
      backgroundColor: isStellar ? "rgba(12, 19, 36, 0.8)" : "#faf6ef",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.18)" : "#d4c5a9",
      borderRadius: isStellar ? 16 : 14,
    },
    emailText: {
      ...staticStyles.emailText,
      color: isStellar ? "#f8fafc" : "#2c1810",
    },
    inviteText: {
      ...staticStyles.inviteText,
      color: isStellar ? "rgba(255, 223, 169, 0.5)" : "#8b7355",
    },
    copyHint: {
      ...staticStyles.copyHint,
      color: isStellar ? "#ffdfa9" : "#c6604a",
    },
    inputLabel: {
      ...staticStyles.inputLabel,
      color: isStellar ? "rgba(255, 223, 169, 0.6)" : "#8b7355",
    },
    textInput: {
      ...staticStyles.textInput,
      backgroundColor: isStellar ? "rgba(7, 10, 24, 0.6)" : "#ede4d5",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.15)" : "#d4c5a9",
      color: isStellar ? "#f8fafc" : "#2c1810",
    },
    menuItem: {
      ...staticStyles.menuItem,
      backgroundColor: isStellar ? "rgba(12, 19, 36, 0.8)" : "#faf6ef",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.18)" : "#d4c5a9",
      borderRadius: isStellar ? 16 : 12,
    },
    menuItemTitle: {
      ...staticStyles.menuItemTitle,
      color: isStellar ? "#f8fafc" : "#2c1810",
    },
    menuItemSubtitle: {
      ...staticStyles.menuItemSubtitle,
      color: isStellar ? "rgba(255, 223, 169, 0.5)" : "#8b7355",
    },
    backHeaderButton: {
      ...staticStyles.backHeaderButton,
      ...(isStellar ? {
        backgroundColor: "rgba(255, 223, 169, 0.08)",
        borderColor: "rgba(255, 223, 169, 0.12)",
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 18,
      } : {}),
    },
    backHeaderText: {
      ...staticStyles.backHeaderText,
      color: isStellar ? "#ffdfa9" : "#c6604a",
    },
    subOptionTab: {
      ...staticStyles.subOptionTab,
      backgroundColor: isStellar ? "rgba(12, 19, 36, 0.8)" : "#faf6ef",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.18)" : "#d4c5a9",
    },
    subOptionTitle: {
      ...staticStyles.subOptionTitle,
      color: isStellar ? "#f8fafc" : "#2c1810",
    },
    alertContainer: {
      ...staticStyles.alertContainer,
      backgroundColor: isStellar ? "rgba(12, 19, 36, 0.95)" : "#faf6ef",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.25)" : "#d4c5a9",
      borderWidth: 1.5,
    },
    alertTitle: {
      ...staticStyles.alertTitle,
      color: isStellar ? "#ffdfa9" : "#2c1810",
    },
    alertMessage: {
      ...staticStyles.alertMessage,
      color: isStellar ? "rgba(255, 223, 169, 0.75)" : "#8b7355",
    },
    loadingOverlay: {
      ...staticStyles.loadingOverlay,
      backgroundColor: isStellar ? "rgba(7, 10, 24, 0.85)" : "rgba(245, 240, 232, 0.8)",
    },
    loadingText: {
      ...staticStyles.loadingText,
      color: isStellar ? "#ffdfa9" : "#8b7355",
    },
  };
};

