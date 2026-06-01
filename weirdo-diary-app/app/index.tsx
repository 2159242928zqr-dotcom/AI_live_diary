import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Alert as RNAlert
} from "react-native";
import { useAuth } from "@/lib/auth";
import { qqEmailIsValid } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { getSavedAccounts, saveAccountToList, removeAccountFromList, type SavedAccount } from "@/lib/storage";
import { apiPost } from "@/lib/api";
import { StellarBackground } from "@/components/StellarBackground";
import { useThemeStore } from "@/lib/tabState";

const { width, height } = Dimensions.get("window");

type AuthMode = "login" | "register";
type LoginSubMode = "password" | "otp";

export default function LoginPage() {
  const { login } = useAuth();
  const { theme } = useThemeStore();
  const styles = getDynamicStyles(theme);
  const isStellar = theme === "stellar";
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginSubMode, setLoginSubMode] = useState<LoginSubMode>("password");
  
  // Credentials
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  // OTP Tokens
  const [otpToken, setOtpToken] = useState("");
  const [regOtpToken, setRegOtpToken] = useState("");

  // OTP Countdowns & loading
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [regCountdown, setRegCountdown] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isSendingRegOtp, setIsSendingRegOtp] = useState(false);

  // Recovery States (Forgot Password)
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryOtpToken, setRecoveryOtpToken] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState("");
  const [recoveryCountdown, setRecoveryCountdown] = useState(0);
  const [isSendingRecoveryOtp, setIsSendingRecoveryOtp] = useState(false);

  // --- NEW: Stellar Theme Onboarding States & Animated Values ---
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const onboardingAnim = useRef(new Animated.Value(0)).current; // 0 for welcome, 1 for auth form sliding in

  // Premium glassmorphic custom alert state & helper
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

  // Load Saved Accounts
  useEffect(() => {
    getSavedAccounts().then(setSavedAccounts).catch(console.warn);
  }, []);

  // Countdown timers
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (otpCountdown > 0) {
      interval = setInterval(() => {
        setOtpCountdown((c) => c - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [otpCountdown]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (regCountdown > 0) {
      interval = setInterval(() => {
        setRegCountdown((c) => c - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [regCountdown]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (recoveryCountdown > 0) {
      interval = setInterval(() => {
        setRecoveryCountdown((c) => c - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recoveryCountdown]);

  // Handle slide animations for Onboarding -> Auth Form
  const triggerTransitionToAuth = (open: boolean) => {
    if (open) {
      setShowAuthPanel(true);
      Animated.spring(onboardingAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(onboardingAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        setShowAuthPanel(false);
      });
    }
  };

  // Error translating helper
  const translateError = (error: any): string => {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Email not confirmed") || msg.includes("Email confirmation required") || msg.includes("email_not_confirmed")) {
      return "您的邮箱尚未验证，请登录您的 QQ 邮箱点击验证链接完成验证后再登录。";
    }
    if (msg.includes("User already exists") || msg.includes("already registered") || msg.includes("email_taken")) {
      return "该邮箱已注册，请直接登录。";
    }
    if (msg.includes("Invalid login credentials") || msg.includes("invalid_credentials")) {
      return "邮箱或密码错误，请重新输入。";
    }
    if (
      msg.includes("Token has expired") || 
      msg.includes("invalid token") || 
      msg.includes("invalid_grant") || 
      msg.includes("Invalid token") ||
      msg.includes("expired or is invalid")
    ) {
      return "验证码错误，请重新输入或获取新的验证码。";
    }
    return msg;
  };

  // Quick Login with Saved Accounts
  const handleLoginWithSaved = async (account: SavedAccount) => {
    setLoading(true);
    try {
      if (!account.password) {
        setEmail(account.email);
        setPassword("");
        setMode("login");
        setLoginSubMode("password");
        Alert.alert("提示", "该账号本地未保存密码，已自动为您填写邮箱，请输入密码进行登录。");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: account.email,
        password: account.password
      });
      if (error) throw error;
      if (!data.user) throw new Error("登录失败");

      const user = data.user;
      const userMetadata = user.user_metadata;
      const username = account.username || userMetadata?.username || account.email.split("@")[0];
      const avatarUrl = account.avatarUrl || userMetadata?.avatarUrl || `gradient:${Math.floor(Math.random() * 6)}`;

      await saveAccountToList({
        userId: user.id,
        email: account.email,
        password: account.password,
        username: username,
        avatarUrl: avatarUrl,
        inviteCode: account.inviteCode || `gk-${user.id.slice(0, 6).toUpperCase()}`
      });

    } catch (error) {
      Alert.alert("自动登录失败", translateError(error));
      setEmail(account.email);
      setMode("login");
      setLoginSubMode("password");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSaved = async (email: string) => {
    await removeAccountFromList(email);
    const updated = await getSavedAccounts();
    setSavedAccounts(updated);
  };

  // Send Login OTP
  const handleSendLoginOtp = async () => {
    if (!qqEmailIsValid(email)) {
      Alert.alert("邮箱格式错误", "请输入合法的 QQ 邮箱，如 123456@qq.com");
      return;
    }
    setIsSendingOtp(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false }
      });
      if (error) throw error;
      setOtpCountdown(60);
      Alert.alert("验证码已发送", "6位登录验证码已发送至您的邮箱，请注意查收。");
    } catch (error) {
      Alert.alert("发送失败", translateError(error));
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Send Register OTP (signUp behind the scenes)
  const handleSendRegOtp = async () => {
    if (!qqEmailIsValid(email)) {
      Alert.alert("邮箱格式错误", "请输入合法的 QQ 邮箱，如 123456@qq.com");
      return;
    }
    if (password.length < 6) {
      Alert.alert("密码不符合要求", "密码长度至少需要 6 位。");
      return;
    }
    setIsSendingRegOtp(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password
      });
      if (error) throw error;
      if (!data.user) throw new Error("发送验证码失败");

      if (data.user.identities && data.user.identities.length === 0) {
        throw new Error("User already exists");
      }

      setRegCountdown(60);
      Alert.alert("激活邮件已发送", "6位激活验证码已发至您的 QQ 邮箱，请查看邮件并填写下方验证码以激活账号。");
    } catch (error) {
      Alert.alert("发送失败", translateError(error));
    } finally {
      setIsSendingRegOtp(false);
    }
  };

  // Send Recovery OTP (Forgot password)
  const handleSendRecoveryOtp = async () => {
    if (!qqEmailIsValid(recoveryEmail)) {
      Alert.alert("邮箱格式错误", "请输入合法的 QQ 邮箱，如 123456@qq.com");
      return;
    }
    setIsSendingRecoveryOtp(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail.trim());
      if (error) throw error;
      setRecoveryCountdown(60);
      Alert.alert("验证码已发送", "6位重置验证码已发送至您的邮箱，请查看并填入下方。");
    } catch (error) {
      Alert.alert("发送失败", translateError(error));
    } finally {
      setIsSendingRecoveryOtp(false);
    }
  };

  // Perform OTP Recovery Reset Password
  const handleRecoveryReset = async () => {
    if (!qqEmailIsValid(recoveryEmail)) {
      Alert.alert("邮箱格式错误", "请输入合法的 QQ 邮箱，如 123456@qq.com");
      return;
    }
    if (recoveryOtpToken.trim().length !== 6) {
      Alert.alert("验证码错误", "请输入6位数字验证码。");
      return;
    }
    if (recoveryPassword.length < 6) {
      Alert.alert("密码不符合要求", "新密码长度至少需要 6 位。");
      return;
    }
    if (recoveryPassword !== recoveryConfirmPassword) {
      Alert.alert("密码不一致", "两次输入的密码不一致。");
      return;
    }

    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: recoveryEmail.trim(),
        token: recoveryOtpToken.trim(),
        type: "recovery"
      });
      if (verifyError) throw verifyError;

      const { error: updateError } = await supabase.auth.updateUser({
        password: recoveryPassword
      });
      if (updateError) throw updateError;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const userMetadata = user.user_metadata;
        const existingList = await getSavedAccounts();
        const match = existingList.find((a) => a.email.toLowerCase() === recoveryEmail.trim().toLowerCase());
        const username = match?.username || userMetadata?.username || recoveryEmail.trim().split("@")[0];
        const avatarUrl = match?.avatarUrl || userMetadata?.avatarUrl || `gradient:${Math.floor(Math.random() * 6)}`;
        const fallbackCode = `gk-${user.id.slice(0, 6).toUpperCase()}`;

        await saveAccountToList({
          userId: user.id,
          email: recoveryEmail.trim(),
          password: recoveryPassword,
          username: username,
          avatarUrl: avatarUrl,
          inviteCode: fallbackCode
        });
      }

      Alert.alert("重置成功", "您的密码已成功重置，正在进入日记本！");
      setForgotPasswordMode(false);
      setRecoveryEmail("");
      setRecoveryOtpToken("");
      setRecoveryPassword("");
      setRecoveryConfirmPassword("");
    } catch (error) {
      Alert.alert("重置失败", translateError(error));
    } finally {
      setLoading(false);
    }
  };

  // Handle Main Login or Register Forms Submissions
  const handleSubmit = async () => {
    if (!qqEmailIsValid(email)) {
      Alert.alert("邮箱格式错误", "请输入合法的 QQ 邮箱，如 123456@qq.com");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        if (loginSubMode === "password") {
          if (password.length < 6) {
            Alert.alert("密码不符合要求", "密码长度至少需要 6 位。");
            setLoading(false);
            return;
          }
          
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password
          });
          if (error) throw error;
          if (!data.user) throw new Error("登录失败");

          const user = data.user;
          const userMetadata = user.user_metadata;
          
          const existingList = await getSavedAccounts();
          const match = existingList.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());

          const username = match?.username || userMetadata?.username || email.trim().split("@")[0];
          const avatarUrl = match?.avatarUrl || userMetadata?.avatarUrl || `gradient:${Math.floor(Math.random() * 6)}`;

          await saveAccountToList({
            userId: user.id,
            email: email.trim(),
            password: password,
            username: username,
            avatarUrl: avatarUrl,
            inviteCode: match?.inviteCode || `gk-${user.id.slice(0, 6).toUpperCase()}`
          });
        } else {
          // OTP Login Flow
          if (otpToken.trim().length !== 6) {
            Alert.alert("验证码格式错误", "请输入6位数字验证码。");
            setLoading(false);
            return;
          }
          const { error } = await supabase.auth.verifyOtp({
            email: email.trim(),
            token: otpToken.trim(),
            type: "email"
          });
          if (error) throw error;

          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const userMetadata = user.user_metadata;
            const existingList = await getSavedAccounts();
            const match = existingList.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());

            const username = match?.username || userMetadata?.username || email.trim().split("@")[0];
            const avatarUrl = match?.avatarUrl || userMetadata?.avatarUrl || `gradient:${Math.floor(Math.random() * 6)}`;

            await saveAccountToList({
              userId: user.id,
              email: email.trim(),
              password: match?.password || "",
              username: username,
              avatarUrl: avatarUrl,
              inviteCode: match?.inviteCode || `gk-${user.id.slice(0, 6).toUpperCase()}`
            });
          }
        }
      } else {
        // Register Verify OTP Flow
        if (password.length < 6) {
          Alert.alert("密码不符合要求", "密码长度至少需要 6 位。");
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          Alert.alert("密码不一致", "两次输入的密码不一致。");
          setLoading(false);
          return;
        }
        if (regOtpToken.trim().length !== 6) {
          Alert.alert("验证码错误", "请输入您邮箱收到的6位验证码。");
          setLoading(false);
          return;
        }

        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: regOtpToken.trim(),
          type: "signup"
        });
        if (verifyError) throw verifyError;
        if (!verifyData.user) throw new Error("激活失败，请确认验证码正确。");

        const user = verifyData.user;
        const generatedCode = `gk-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

        try {
          await apiPost("/api/auth/profile", {
            userId: user.id,
            email: email.trim(),
            inviteCode: generatedCode,
            usedInviteCode: inviteCode.trim().toUpperCase() || undefined
          });
        } catch (syncError) {
          console.warn("Backend profile sync failed in index:", syncError);
        }

        await saveAccountToList({
          userId: user.id,
          email: email.trim(),
          password: password,
          username: email.trim().split("@")[0],
          avatarUrl: `gradient:${Math.floor(Math.random() * 6)}`,
          inviteCode: generatedCode
        });

        Alert.alert("注册成功", "验证成功！您的专属手账空间已开启！");
      }
    } catch (error) {
      Alert.alert("操作失败", translateError(error));
    } finally {
      setLoading(false);
    }
  };

  // Animated interpolations for fluid, premium welcome -> login screen transitions
  const welcomeY = onboardingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -100],
  });

  const welcomeOpacity = onboardingAnim.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [1, 0, 0],
  });

  const formY = onboardingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });

  const formOpacity = onboardingAnim.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0.4, 1],
  });

  const renderLoginContent = () => {
    const placeholderColor = isStellar ? "rgba(255, 223, 169, 0.4)" : "#8b7355";
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
          {/* Welcome Screen Cover Block (Ceremonial Entrance) */}
          {!showAuthPanel && (
            <Animated.View style={[styles.welcomeCover, { transform: [{ translateY: welcomeY }], opacity: welcomeOpacity }]}>
              <View style={styles.welcomeCenter}>
                <View style={styles.stellarLogoContainer}>
                  <Ionicons name="sparkles-outline" size={48} color="#ffd88f" style={styles.welcomeLogo} />
                  <View style={styles.welcomeLogoGlow} />
                </View>
                <Text style={styles.welcomeTitle}>Memory Vessel</Text>
                <Text style={styles.welcomeText}>“ 记忆正在流入今夜 ”</Text>
                <Text style={styles.welcomeSubtext}>您的专属数字记忆胶囊</Text>
              </View>

              <TouchableOpacity style={styles.journeyBtn} activeOpacity={0.8} onPress={() => triggerTransitionToAuth(true)}>
                <Text style={styles.journeyBtnText}>开启记忆之旅</Text>
                <Ionicons name="arrow-forward" size={16} color="#0c1324" style={{ marginLeft: 6 }} />
              </TouchableOpacity>

              <Text style={styles.welcomeFooter}>私密纯本地存储 · 捕获您内心的独白</Text>
            </Animated.View>
          )}

          {/* Glassmorphic Auth Panel (Login/Register/Reset Password Forms) */}
          {showAuthPanel && (
            <Animated.View style={[styles.authWrapper, { transform: [{ translateY: formY }], opacity: formOpacity }]}>
              <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <View style={styles.glassBookCover}>
                  <View style={styles.header}>
                    <TouchableOpacity style={styles.authBackBtn} onPress={() => triggerTransitionToAuth(false)}>
                      <Ionicons name="chevron-back" size={20} color={isStellar ? "#ffdfa9" : "#8b7355"} />
                      <Text style={styles.authBackText}>返回</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Memory Vessel</Text>
                    <Text style={styles.subtitle}>纯本地离线的专属 AI 语音手账</Text>
                  </View>

                  {forgotPasswordMode ? (
                    /* Forgot Password View */
                    <View style={styles.form}>
                      <Text style={styles.forgotTitle}>重置专属登录密码</Text>
                      
                      <View style={styles.field}>
                        <Text style={styles.label}>QQ 邮箱</Text>
                        <View style={styles.emailRow}>
                          <TextInput
                            style={[styles.input, { flex: 1 }]}
                            placeholder="请输入您的 QQ 邮箱"
                            placeholderTextColor={placeholderColor}
                            value={recoveryEmail}
                            onChangeText={setRecoveryEmail}
                            keyboardType="default"
                            autoCapitalize="none"
                            editable={!loading}
                          />
                          <TouchableOpacity
                            style={[styles.compactCodeButton, (isSendingRecoveryOtp || recoveryCountdown > 0) && styles.disabledCodeButton]}
                            onPress={handleSendRecoveryOtp}
                            disabled={isSendingRecoveryOtp || recoveryCountdown > 0 || loading}
                          >
                            {isSendingRecoveryOtp ? (
                              <ActivityIndicator size="small" color="#ffdfa9" />
                            ) : (
                              <Text style={styles.compactCodeText}>
                                {recoveryCountdown > 0 ? `${recoveryCountdown}s` : "获取验证码"}
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.field}>
                        <Text style={styles.label}>验证码</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="请输入邮箱收到的6位验证码"
                          placeholderTextColor={placeholderColor}
                          value={recoveryOtpToken}
                          onChangeText={setRecoveryOtpToken}
                          keyboardType="number-pad"
                          maxLength={6}
                          editable={!loading}
                        />
                      </View>

                      <View style={styles.field}>
                        <Text style={styles.label}>设置新密码</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="至少 6 位新密码"
                          placeholderTextColor={placeholderColor}
                          value={recoveryPassword}
                          onChangeText={setRecoveryPassword}
                          secureTextEntry
                          autoCapitalize="none"
                          editable={!loading}
                        />
                      </View>

                      <View style={styles.field}>
                        <Text style={styles.label}>确认新密码</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="再次输入新密码"
                          placeholderTextColor={placeholderColor}
                          value={recoveryConfirmPassword}
                          onChangeText={setRecoveryConfirmPassword}
                          secureTextEntry
                          autoCapitalize="none"
                          editable={!loading}
                        />
                      </View>

                      <TouchableOpacity
                        style={[styles.submitButton, loading && styles.disabledButton]}
                        onPress={handleRecoveryReset}
                        disabled={loading}
                      >
                        {loading ? (
                          <ActivityIndicator color="#0c1324" />
                        ) : (
                          <Text style={styles.submitText}>确认重置并开启日记</Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.backToLoginBtn}
                        onPress={() => setForgotPasswordMode(false)}
                        disabled={loading}
                      >
                        <Text style={styles.backToLoginText}>返回登录</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    /* Main Login / Register View */
                    <>
                      <View style={styles.tabContainer}>
                        <TouchableOpacity
                          style={[styles.tabButton, mode === "login" && styles.activeTabButton]}
                          onPress={() => setMode("login")}
                          disabled={loading}
                        >
                          <Text style={[styles.tabText, mode === "login" && styles.activeTabText]}>登录</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.tabButton, mode === "register" && styles.activeTabButton]}
                          onPress={() => setMode("register")}
                          disabled={loading}
                        >
                          <Text style={[styles.tabText, mode === "register" && styles.activeTabText]}>注册</Text>
                        </TouchableOpacity>
                      </View>

                      {mode === "login" && savedAccounts.length > 0 ? (
                        <View style={styles.savedAccountsSection}>
                          <Text style={styles.savedTitle}>快速切换已存账号</Text>
                          <ScrollView style={styles.savedScroll} nestedScrollEnabled={true}>
                            {savedAccounts.map((account) => {
                              const isGradient = account.avatarUrl?.startsWith("gradient:");
                              const gradientIndex = isGradient ? parseInt(account.avatarUrl!.split(":")[1], 10) : 0;
                              const gradients = [
                                "#7c3aed",
                                "#2563eb",
                                "#0891b2",
                                "#059669",
                                "#dc2626",
                                "#d97706"
                              ];
                              const gradientColor = gradients[gradientIndex] || gradients[0];

                              return (
                                <View key={account.email} style={styles.savedCard}>
                                  <TouchableOpacity
                                    style={styles.savedCardPress}
                                    onPress={() => handleLoginWithSaved(account)}
                                    disabled={loading}
                                  >
                                    {isGradient ? (
                                      <View style={[styles.savedAvatar, { backgroundColor: gradientColor }]}>
                                        <Text style={styles.savedAvatarText}>
                                          {(account.username || account.email).slice(0, 1).toUpperCase()}
                                        </Text>
                                      </View>
                                    ) : (
                                      <Image source={{ uri: account.avatarUrl }} style={styles.savedAvatarImage} />
                                    )}
                                    <View style={styles.savedInfo}>
                                      <Text style={styles.savedUsername}>{account.username || account.email.split("@")[0]}</Text>
                                      <Text style={styles.savedEmail}>{account.email}</Text>
                                    </View>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.savedDeleteBtn}
                                    onPress={() => handleDeleteSaved(account.email)}
                                  >
                                    <Ionicons name="trash-outline" size={15} color="#ffa5a5" />
                                  </TouchableOpacity>
                                </View>
                              );
                            })}
                          </ScrollView>
                          <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>或使用其他账号登录</Text>
                            <View style={styles.dividerLine} />
                          </View>
                        </View>
                      ) : null}

                      <View style={styles.form}>
                        {mode === "login" && (
                          /* Password vs OTP Login Sub Tabs Selector */
                          <View style={styles.subTabContainer}>
                            <TouchableOpacity
                              style={[styles.subTabButton, loginSubMode === "password" && styles.activeSubTabButton]}
                              onPress={() => setLoginSubMode("password")}
                              disabled={loading}
                            >
                              <Text style={[styles.subTabText, loginSubMode === "password" && styles.activeSubTabText]}>密码登录</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.subTabButton, loginSubMode === "otp" && styles.activeSubTabButton]}
                              onPress={() => setLoginSubMode("otp")}
                              disabled={loading}
                            >
                              <Text style={[styles.subTabText, loginSubMode === "otp" && styles.activeSubTabText]}>邮箱登录</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {/* QQ Email field */}
                        {mode === "login" ? (
                          <View style={styles.field}>
                            <Text style={styles.label}>QQ 邮箱</Text>
                            <View style={styles.emailRow}>
                              <TextInput
                                style={[styles.input, { flex: 1 }]}
                                placeholder="例如 123456@qq.com"
                                placeholderTextColor={placeholderColor}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="default"
                                autoCapitalize="none"
                                editable={!loading}
                              />
                              {loginSubMode === "otp" && (
                                <TouchableOpacity
                                  style={[styles.compactCodeButton, (isSendingOtp || otpCountdown > 0) && styles.disabledCodeButton]}
                                  onPress={handleSendLoginOtp}
                                  disabled={isSendingOtp || otpCountdown > 0 || loading}
                                >
                                  {isSendingOtp ? (
                                    <ActivityIndicator size="small" color="#ffdfa9" />
                                  ) : (
                                    <Text style={styles.compactCodeText}>
                                      {otpCountdown > 0 ? `${otpCountdown}s` : "获取验证码"}
                                    </Text>
                                  )}
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        ) : (
                          /* Registration Email Field with always integrated code button */
                          <View style={styles.field}>
                            <Text style={styles.label}>QQ 邮箱</Text>
                            <View style={styles.emailRow}>
                              <TextInput
                                style={[styles.input, { flex: 1 }]}
                                placeholder="例如 123456@qq.com"
                                placeholderTextColor={placeholderColor}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="default"
                                autoCapitalize="none"
                                editable={!loading}
                              />
                              <TouchableOpacity
                                style={[styles.compactCodeButton, (isSendingRegOtp || regCountdown > 0) && styles.disabledCodeButton]}
                                onPress={handleSendRegOtp}
                                disabled={isSendingRegOtp || regCountdown > 0 || loading}
                              >
                                {isSendingRegOtp ? (
                                  <ActivityIndicator size="small" color="#ffdfa9" />
                                ) : (
                                  <Text style={styles.compactCodeText}>
                                    {regCountdown > 0 ? `${regCountdown}s` : "获取验证码"}
                                  </Text>
                                )}
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}

                        {/* Password or OTP and fields */}
                        {mode === "login" && loginSubMode === "password" && (
                          <View style={styles.field}>
                            <View style={styles.labelRow}>
                              <Text style={styles.label}>密码</Text>
                              <TouchableOpacity onPress={() => setForgotPasswordMode(true)} disabled={loading}>
                                <Text style={styles.forgotText}>忘记密码？</Text>
                              </TouchableOpacity>
                            </View>
                            <TextInput
                              style={styles.input}
                              placeholder="至少 6 位"
                              placeholderTextColor={placeholderColor}
                              value={password}
                              onChangeText={setPassword}
                              secureTextEntry
                              autoCapitalize="none"
                              editable={!loading}
                            />
                          </View>
                        )}

                        {mode === "login" && loginSubMode === "otp" && (
                          <View style={styles.field}>
                            <Text style={styles.label}>验证码</Text>
                            <TextInput
                              style={styles.input}
                              placeholder="请输入邮箱收到的6位验证码"
                              placeholderTextColor={placeholderColor}
                              value={otpToken}
                              onChangeText={setOtpToken}
                              keyboardType="number-pad"
                              maxLength={6}
                              editable={!loading}
                            />
                          </View>
                        )}

                        {mode === "register" && (
                          <>
                            <View style={styles.field}>
                              <Text style={styles.label}>设置密码</Text>
                              <TextInput
                                style={styles.input}
                                placeholder="至少 6 位"
                                placeholderTextColor={placeholderColor}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                autoCapitalize="none"
                                editable={!loading}
                              />
                            </View>

                            <View style={styles.field}>
                              <Text style={styles.label}>确认密码</Text>
                              <TextInput
                                style={styles.input}
                                placeholder="再次输入密码"
                                placeholderTextColor={placeholderColor}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry
                                autoCapitalize="none"
                                editable={!loading}
                              />
                            </View>

                            <View style={styles.field}>
                              <Text style={styles.label}>6位激活验证码</Text>
                              <TextInput
                                style={styles.input}
                                placeholder="请输入 QQ 邮箱收到的6位验证码"
                                placeholderTextColor={placeholderColor}
                                value={regOtpToken}
                                onChangeText={setRegOtpToken}
                                keyboardType="number-pad"
                                maxLength={6}
                                editable={!loading}
                              />
                            </View>

                            <View style={styles.field}>
                              <Text style={styles.label}>邀请码 (选填)</Text>
                              <TextInput
                                style={styles.input}
                                placeholder="如有邀请码，请输入"
                                placeholderTextColor={placeholderColor}
                                value={inviteCode}
                                onChangeText={setInviteCode}
                                autoCapitalize="characters"
                                editable={!loading}
                              />
                            </View>
                          </>
                        )}

                        <TouchableOpacity
                          style={[styles.submitButton, loading && styles.disabledButton]}
                          onPress={handleSubmit}
                          disabled={loading}
                        >
                          {loading ? (
                            <ActivityIndicator color="#0c1324" />
                          ) : (
                            <Text style={styles.submitText}>
                              {mode === "login" ? "开启日记本" : "创建专属账号"}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  <Text style={styles.footerText}>
                    账号与数据完全私有 · 数据只保留在您当前设备的本地
                  </Text>
                </View>
              </ScrollView>
            </Animated.View>
          )}

      {/* Glassmorphic Premium Alert Modal */}
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
    </KeyboardAvoidingView>
    );
  };

  if (isStellar) {
    return (
      <View style={{ flex: 1, backgroundColor: "#070a18" }}>
        <StellarBackground>
          {renderLoginContent()}
        </StellarBackground>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: "#f5f0e8" }}>
      {renderLoginContent()}
    </View>
  );
}

const staticStyles = StyleSheet.create({
  // Welcome Screen Cover styles
  welcomeCover: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 64,
    paddingHorizontal: 24,
    zIndex: 10,
  },
  welcomeCenter: {
    alignItems: "center",
    marginTop: height * 0.12,
  },
  stellarLogoContainer: {
    position: "relative",
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  welcomeLogo: {
    zIndex: 2,
    textShadowColor: "rgba(255, 216, 143, 0.4)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  welcomeLogoGlow: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ffdfa9",
    opacity: 0.15,
    shadowColor: "#ffdfa9",
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 2,
    zIndex: 1,
  },
  welcomeTitle: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 36,
    fontWeight: "700",
    color: "#ffdfa9",
    letterSpacing: 2,
    textShadowColor: "rgba(255, 223, 169, 0.2)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  welcomeText: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 18,
    color: "#e2e8f0",
    marginTop: 24,
    fontStyle: "italic",
    letterSpacing: 1.5,
  },
  welcomeSubtext: {
    fontSize: 12,
    color: "rgba(255, 223, 169, 0.6)",
    marginTop: 12,
    letterSpacing: 1,
  },
  journeyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffdfa9",
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: "#ffdfa9",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  journeyBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#070a18",
    letterSpacing: 1.5,
  },
  welcomeFooter: {
    fontSize: 10,
    color: "rgba(255, 223, 169, 0.35)",
    letterSpacing: 0.8,
  },

  // Auth panel wrapper styles
  authWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    paddingTop: Platform.OS === "ios" ? 48 : 36,
    paddingBottom: 48,
  },
  glassBookCover: {
    backgroundColor: "rgba(12, 19, 36, 0.8)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 223, 169, 0.18)",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
    position: "relative",
  },
  authBackBtn: {
    position: "absolute",
    left: -4,
    top: 4,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
    padding: 4,
  },
  authBackText: {
    fontSize: 13,
    color: "#ffdfa9",
    fontWeight: "700",
    marginLeft: 2,
  },
  title: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 24,
    fontWeight: "800",
    color: "#ffdfa9",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 11,
    color: "rgba(255, 223, 169, 0.5)",
    marginTop: 6,
    fontWeight: "600",
  },
  forgotTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ffdfa9",
    textAlign: "center",
    marginBottom: 12,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 223, 169, 0.08)",
    borderRadius: 12,
    padding: 3,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 223, 169, 0.12)",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: "rgba(255, 223, 169, 0.15)",
    borderWidth: 0.8,
    borderColor: "rgba(255, 223, 169, 0.25)",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255, 223, 169, 0.5)",
  },
  activeTabText: {
    color: "#ffdfa9",
  },
  subTabContainer: {
    flexDirection: "row",
    height: 38,
    paddingBottom: 6,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 223, 169, 0.1)",
  },
  subTabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  activeSubTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: "#ffdfa9",
  },
  subTabText: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255, 223, 169, 0.4)",
  },
  activeSubTabText: {
    color: "#ffdfa9",
    fontWeight: "800",
  },
  form: {
    gap: 16,
  },
  field: {
    gap: 6,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255, 223, 169, 0.6)",
    paddingLeft: 4,
    letterSpacing: 0.5,
  },
  forgotText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffdfa9",
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
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  compactCodeButton: {
    width: 84,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255, 223, 169, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 223, 169, 0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  disabledCodeButton: {
    opacity: 0.45,
  },
  compactCodeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffdfa9",
  },
  submitButton: {
    backgroundColor: "#ffdfa9",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#ffdfa9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0c1324",
    letterSpacing: 0.5,
  },
  backToLoginBtn: {
    alignItems: "center",
    paddingVertical: 8,
    marginTop: 4,
  },
  backToLoginText: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255, 223, 169, 0.5)",
    textDecorationLine: "underline",
  },
  footerText: {
    fontSize: 9,
    color: "rgba(255, 223, 169, 0.35)",
    textAlign: "center",
    marginTop: 20,
    opacity: 0.7,
  },
  savedAccountsSection: {
    marginBottom: 20,
    gap: 8,
  },
  savedTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255, 223, 169, 0.5)",
    paddingLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  savedScroll: {
    maxHeight: 180,
  },
  savedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 223, 169, 0.05)",
    borderColor: "rgba(255, 223, 169, 0.12)",
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
    color: "#0c1324",
    fontSize: 14,
    fontWeight: "800",
  },
  savedAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 223, 169, 0.2)",
  },
  savedInfo: {
    flex: 1,
  },
  savedUsername: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f8fafc",
  },
  savedEmail: {
    fontSize: 11,
    color: "rgba(255, 223, 169, 0.5)",
    marginTop: 1,
  },
  savedDeleteBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 100, 100, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 100, 100, 0.2)",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
    paddingHorizontal: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 223, 169, 0.15)",
  },
  dividerText: {
    fontSize: 10,
    color: "rgba(255, 223, 169, 0.4)",
    marginHorizontal: 10,
    fontWeight: "600",
  },

  // Glassmorphic Modal Alert Styles
  alertOverlay: {
    flex: 1,
    backgroundColor: "rgba(3, 4, 10, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  alertContainer: {
    width: "85%",
    backgroundColor: "rgba(12, 19, 36, 0.95)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 223, 169, 0.2)",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 6,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ffdfa9",
    textAlign: "center",
    marginBottom: 8,
  },
  alertMessage: {
    fontSize: 13,
    color: "rgba(248, 250, 252, 0.85)",
    textAlign: "center",
    lineHeight: 18,
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
    backgroundColor: "#ffdfa9",
  },
  alertButtonCancel: {
    backgroundColor: "rgba(255, 223, 169, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 223, 169, 0.15)",
  },
  alertButtonDestructive: {
    backgroundColor: "rgba(220, 38, 38, 0.85)",
  },
  alertButtonText: {
    fontSize: 13,
    fontWeight: "800",
  },
  alertButtonTextDefault: {
    color: "#0c1324",
  },
  alertButtonTextCancel: {
    color: "#ffdfa9",
  },
  alertButtonTextDestructive: {
    color: "#f8fafc",
  },
});

const getDynamicStyles = (theme: "stellar" | "kraft") => {
  const isStellar = theme === "stellar";
  return {
    ...staticStyles,
    welcomeCover: {
      ...staticStyles.welcomeCover,
      backgroundColor: isStellar ? "transparent" : "#f5f0e8",
    },
    welcomeTitle: {
      ...staticStyles.welcomeTitle,
      color: isStellar ? "#ffdfa9" : "#2c1810",
      fontFamily: isStellar ? (Platform.OS === "ios" ? "Georgia" : "serif") : "System",
    },
    welcomeText: {
      ...staticStyles.welcomeText,
      color: isStellar ? "#ffd88f" : "#8b7355",
      fontFamily: isStellar ? (Platform.OS === "ios" ? "Georgia" : "serif") : "System",
    },
    welcomeSubtext: {
      ...staticStyles.welcomeSubtext,
      color: isStellar ? "rgba(255, 223, 169, 0.45)" : "#8b7355",
    },
    journeyBtn: {
      ...staticStyles.journeyBtn,
      backgroundColor: isStellar ? "#ffdfa9" : "#c6604a",
      shadowColor: isStellar ? "#ffdfa9" : "#c6604a",
    },
    journeyBtnText: {
      ...staticStyles.journeyBtnText,
      color: isStellar ? "#0c1324" : "#faf6ef",
    },
    welcomeFooter: {
      ...staticStyles.welcomeFooter,
      color: isStellar ? "rgba(255, 223, 169, 0.35)" : "#8b7355",
    },
    authWrapper: {
      ...staticStyles.authWrapper,
      backgroundColor: isStellar ? "transparent" : "#f5f0e8",
    },
    container: {
      ...staticStyles.container,
      backgroundColor: isStellar ? "transparent" : "#f5f0e8",
    },
    glassBookCover: {
      ...staticStyles.glassBookCover,
      backgroundColor: isStellar ? "rgba(12, 19, 36, 0.8)" : "#faf6ef",
      borderWidth: isStellar ? 1.2 : 1,
      borderColor: isStellar ? "rgba(255, 223, 169, 0.18)" : "#d4c5a9",
      borderRadius: isStellar ? 24 : 16,
      shadowColor: isStellar ? "#000" : "#2c1810",
      shadowOffset: isStellar ? { width: 0, height: 16 } : { width: 0, height: 2 },
      shadowOpacity: isStellar ? 0.35 : 0.05,
      shadowRadius: isStellar ? 24 : 6,
      elevation: isStellar ? 8 : 2,
    },
    header: {
      ...staticStyles.header,
      borderBottomColor: isStellar ? "rgba(255, 223, 169, 0.08)" : "#ede4d5",
      borderBottomWidth: isStellar ? 0.5 : 1.5,
    },
    authBackBtn: {
      ...staticStyles.authBackBtn,
    },
    authBackText: {
      ...staticStyles.authBackText,
      color: isStellar ? "#ffdfa9" : "#8b7355",
    },
    title: {
      ...staticStyles.title,
      color: isStellar ? "#ffdfa9" : "#2c1810",
      fontFamily: isStellar ? (Platform.OS === "ios" ? "Georgia" : "serif") : "System",
    },
    subtitle: {
      ...staticStyles.subtitle,
      color: isStellar ? "rgba(255, 223, 169, 0.5)" : "#8b7355",
    },
    tabText: {
      ...staticStyles.tabText,
      color: isStellar ? "rgba(255, 223, 169, 0.5)" : "#8b7355",
    },
    activeTabText: {
      ...staticStyles.activeTabText,
      color: isStellar ? "#ffdfa9" : "#c6604a",
    },
    subTabContainer: {
      ...staticStyles.subTabContainer,
      borderBottomColor: isStellar ? "rgba(255, 223, 169, 0.1)" : "#ede4d5",
    },
    activeSubTabButton: {
      ...staticStyles.activeSubTabButton,
      borderBottomColor: isStellar ? "#ffdfa9" : "#c6604a",
    },
    subTabText: {
      ...staticStyles.subTabText,
      color: isStellar ? "rgba(255, 223, 169, 0.4)" : "#8b7355",
    },
    activeSubTabText: {
      ...staticStyles.activeSubTabText,
      color: isStellar ? "#ffdfa9" : "#c6604a",
    },
    label: {
      ...staticStyles.label,
      color: isStellar ? "rgba(255, 223, 169, 0.6)" : "#8b7355",
    },
    forgotText: {
      ...staticStyles.forgotText,
      color: isStellar ? "#ffdfa9" : "#c6604a",
    },
    input: {
      ...staticStyles.input,
      backgroundColor: isStellar ? "rgba(7, 10, 24, 0.6)" : "#ede4d5",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.15)" : "#d4c5a9",
      color: isStellar ? "#f8fafc" : "#2c1810",
    },
    compactCodeButton: {
      ...staticStyles.compactCodeButton,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.08)" : "#ede4d5",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.18)" : "#d4c5a9",
    },
    compactCodeText: {
      ...staticStyles.compactCodeText,
      color: isStellar ? "#ffdfa9" : "#8b7355",
    },
    submitButton: {
      ...staticStyles.submitButton,
      backgroundColor: isStellar ? "#ffdfa9" : "#c6604a",
      shadowColor: isStellar ? "#ffdfa9" : "#c6604a",
    },
    submitText: {
      ...staticStyles.submitText,
      color: isStellar ? "#0c1324" : "#faf6ef",
    },
    backToLoginText: {
      ...staticStyles.backToLoginText,
      color: isStellar ? "rgba(255, 223, 169, 0.5)" : "#8b7355",
    },
    footerText: {
      ...staticStyles.footerText,
      color: isStellar ? "rgba(255, 223, 169, 0.35)" : "#8b7355",
    },
    savedTitle: {
      ...staticStyles.savedTitle,
      color: isStellar ? "rgba(255, 223, 169, 0.5)" : "#8b7355",
    },
    savedCard: {
      ...staticStyles.savedCard,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.05)" : "#ede4d5",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.12)" : "#d4c5a9",
    },
    savedAvatarText: {
      ...staticStyles.savedAvatarText,
      color: isStellar ? "#0c1324" : "#faf6ef",
    },
    savedAvatarImage: {
      ...staticStyles.savedAvatarImage,
      borderColor: isStellar ? "rgba(255, 223, 169, 0.2)" : "#d4c5a9",
    },
    savedUsername: {
      ...staticStyles.savedUsername,
      color: isStellar ? "#f8fafc" : "#2c1810",
    },
    savedEmail: {
      ...staticStyles.savedEmail,
      color: isStellar ? "rgba(255, 223, 169, 0.5)" : "#8b7355",
    },
    savedDeleteBtn: {
      ...staticStyles.savedDeleteBtn,
      backgroundColor: isStellar ? "rgba(255, 100, 100, 0.08)" : "#faf6ef",
      borderColor: isStellar ? "rgba(255, 100, 100, 0.2)" : "#d4c5a9",
    },
    dividerLine: {
      ...staticStyles.dividerLine,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.15)" : "#d4c5a9",
    },
    dividerText: {
      ...staticStyles.dividerText,
      color: isStellar ? "rgba(255, 223, 169, 0.4)" : "#8b7355",
    },
    alertOverlay: {
      ...staticStyles.alertOverlay,
      backgroundColor: isStellar ? "rgba(3, 4, 10, 0.75)" : "rgba(0, 0, 0, 0.45)",
    },
    alertContainer: {
      ...staticStyles.alertContainer,
      backgroundColor: isStellar ? "rgba(12, 19, 36, 0.95)" : "#faf6ef",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.2)" : "#d4c5a9",
    },
    alertTitle: {
      ...staticStyles.alertTitle,
      color: isStellar ? "#ffdfa9" : "#2c1810",
    },
    alertMessage: {
      ...staticStyles.alertMessage,
      color: isStellar ? "rgba(248, 250, 252, 0.85)" : "#5c4a37",
    },
    alertButtonDefault: {
      ...staticStyles.alertButtonDefault,
      backgroundColor: isStellar ? "#ffdfa9" : "#8b7355",
    },
    alertButtonCancel: {
      ...staticStyles.alertButtonCancel,
      backgroundColor: isStellar ? "rgba(255, 223, 169, 0.08)" : "#ede4d5",
      borderColor: isStellar ? "rgba(255, 223, 169, 0.15)" : "#d4c5a9",
    },
    alertButtonDestructive: {
      ...staticStyles.alertButtonDestructive,
      backgroundColor: isStellar ? "rgba(220, 38, 38, 0.85)" : "#c6604a",
    },
    alertButtonTextDefault: {
      ...staticStyles.alertButtonTextDefault,
      color: isStellar ? "#0c1324" : "#faf6ef",
    },
    alertButtonTextCancel: {
      ...staticStyles.alertButtonTextCancel,
      color: isStellar ? "#ffdfa9" : "#8b7355",
    },
    alertButtonTextDestructive: {
      ...staticStyles.alertButtonTextDestructive,
      color: isStellar ? "#f8fafc" : "#faf6ef",
    },
  };
};
