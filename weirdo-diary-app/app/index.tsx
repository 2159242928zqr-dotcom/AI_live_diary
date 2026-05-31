import React, { useState, useEffect } from "react";
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
  Alert as RNAlert
} from "react-native";
import { useAuth } from "@/lib/auth";
import { qqEmailIsValid } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { getSavedAccounts, saveAccountToList, removeAccountFromList, type SavedAccount } from "@/lib/storage";
import { apiPost } from "@/lib/api";

type AuthMode = "login" | "register";
type LoginSubMode = "password" | "otp";

export default function LoginPage() {
  const { login } = useAuth();
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
      // If the account has no password (e.g. logged in via OTP), fill email and switch to OTP mode
      if (!account.password) {
        setEmail(account.email);
        setMode("login");
        setLoginSubMode("otp");
        Alert.alert("提示", "该账号未保存密码，已为您自动填写邮箱，请获取邮箱验证码登录。");
        setLoading(false);
        return;
      }

      // First log out any existing session to clear local dirty state
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn("Sign out prior to saved login ignored:", e);
      }

      // Small delay for clean session state propagation
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Direct sign in using supabase client to get immediate response & user object
      const { data, error } = await supabase.auth.signInWithPassword({
        email: account.email,
        password: account.password
      });
      if (error) throw error;
      if (!data.user) throw new Error("登录失败");

      const user = data.user;
      const userMetadata = user.user_metadata;
      const username = userMetadata?.username || account.username || account.email.split("@")[0];
      const avatarUrl = userMetadata?.avatarUrl || account.avatarUrl || `gradient:${Math.floor(Math.random() * 6)}`;

      await saveAccountToList({
        userId: user.id,
        email: account.email,
        password: account.password,
        username: username,
        avatarUrl: avatarUrl,
        inviteCode: account.inviteCode || `gk-${user.id.slice(0, 6).toUpperCase()}`
      });

      // Redirection is handled automatically by the _layout listener
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

  // Send Register OTP (triggers signUp behind the scenes)
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
      // signUp will trigger Supabase to send OTP / email confirmation
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password
      });
      if (error) throw error;
      if (!data.user) throw new Error("发送验证码失败");

      // Handle preventable user enumeration cases
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
      // 1. Verify Recovery OTP
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: recoveryEmail.trim(),
        token: recoveryOtpToken.trim(),
        type: "recovery"
      });
      if (verifyError) throw verifyError;

      // 2. Set new password on cloud
      const { error: updateError } = await supabase.auth.updateUser({
        password: recoveryPassword
      });
      if (updateError) throw updateError;

      // 3. Save locally
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const userMetadata = user.user_metadata;
        const username = userMetadata?.username || recoveryEmail.trim().split("@")[0];
        const avatarUrl = userMetadata?.avatarUrl || `gradient:${Math.floor(Math.random() * 6)}`;
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
          // Password Login Flow
          if (password.length < 6) {
            Alert.alert("密码不符合要求", "密码长度至少需要 6 位。");
            setLoading(false);
            return;
          }
          
          // Direct sign-in using standard Supabase authentication
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password
          });
          if (error) throw error;
          if (!data.user) throw new Error("登录失败");

          const user = data.user;
          const userMetadata = user.user_metadata;
          const username = userMetadata?.username || email.trim().split("@")[0];
          const avatarUrl = userMetadata?.avatarUrl || `gradient:${Math.floor(Math.random() * 6)}`;

          await saveAccountToList({
            userId: user.id,
            email: email.trim(),
            password: password,
            username: username,
            avatarUrl: avatarUrl,
            inviteCode: `gk-${user.id.slice(0, 6).toUpperCase()}`
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
            const username = userMetadata?.username || email.trim().split("@")[0];
            const avatarUrl = userMetadata?.avatarUrl || `gradient:${Math.floor(Math.random() * 6)}`;

            await saveAccountToList({
              userId: user.id,
              email: email.trim(),
              password: "", // 邮箱验证码登录可不留存本地密码，或保留为空
              username: username,
              avatarUrl: avatarUrl,
              inviteCode: `gk-${user.id.slice(0, 6).toUpperCase()}`
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

        // Verify OTP to activate the signup
        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: regOtpToken.trim(),
          type: "signup"
        });
        if (verifyError) throw verifyError;
        if (!verifyData.user) throw new Error("激活失败，请确认验证码正确。");

        const user = verifyData.user;
        const generatedCode = `gk-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

        // Sync profile to backend Next.js API
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

        // Save account locally
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

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.bookCover}>
        <View style={styles.header}>
          <Image
            source={{ uri: "https://your-placeholder-logo.png" }}
            defaultSource={require("../assets/icon.png")}
            style={styles.logo}
          />
          <Text style={styles.title}>怪咖日记</Text>
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
                  placeholderTextColor="#8b7355"
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
                    <ActivityIndicator size="small" color="#8b7355" />
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
                placeholderTextColor="#8b7355"
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
                placeholderTextColor="#8b7355"
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
                placeholderTextColor="#8b7355"
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
                <ActivityIndicator color="#faf6ef" />
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
                      "#ff7f50",
                      "#20b2aa",
                      "#9370db",
                      "#6395ee",
                      "#e06666",
                      "#b5a642"
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
                          <Ionicons name="trash-outline" size={16} color="#c6604a" />
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
                      placeholderTextColor="#8b7355"
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
                          <ActivityIndicator size="small" color="#8b7355" />
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
                      placeholderTextColor="#8b7355"
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
                        <ActivityIndicator size="small" color="#8b7355" />
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
                    placeholderTextColor="#8b7355"
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
                    placeholderTextColor="#8b7355"
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
                      placeholderTextColor="#8b7355"
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
                      placeholderTextColor="#8b7355"
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
                      placeholderTextColor="#8b7355"
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
                      placeholderTextColor="#8b7355"
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
                  <ActivityIndicator color="#faf6ef" />
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f5f0e8", // 牛皮纸主色
    justifyContent: "center",
    padding: 24,
  },
  bookCover: {
    backgroundColor: "#faf6ef",
    borderWidth: 1.5,
    borderColor: "#d4c5a9",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#2c1810",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#d4c5a9",
  },
  title: {
    fontFamily: "System",
    fontSize: 28,
    fontWeight: "800",
    color: "#2c1810",
  },
  subtitle: {
    fontSize: 12,
    color: "#8b7355",
    marginTop: 6,
    fontWeight: "600",
  },
  forgotTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2c1810",
    textAlign: "center",
    marginBottom: 12,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#ede4d5",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#d4c5a9",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: "#faf6ef",
    shadowColor: "#2c1810",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8b7355",
  },
  activeTabText: {
    color: "#c6604a", // Clay Red active
  },
  subTabContainer: {
    flexDirection: "row",
    height: 40,
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: "#ede4d5",
  },
  subTabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  activeSubTabButton: {
    borderBottomWidth: 3,
    borderBottomColor: "#c6604a",
  },
  subTabText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8b7355",
  },
  activeSubTabText: {
    color: "#c6604a",
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
    fontSize: 12,
    fontWeight: "700",
    color: "#8b7355",
    paddingLeft: 4,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#c6604a",
  },
  input: {
    backgroundColor: "#ede4d5",
    borderColor: "#d4c5a9",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 46,
    fontSize: 15,
    color: "#2c1810",
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  compactCodeButton: {
    width: 80,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#ede4d5",
    borderWidth: 1.2,
    borderColor: "#d4c5a9",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    elevation: 0,
  },
  disabledCodeButton: {
    opacity: 0.6,
  },
  compactCodeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#8b7355",
  },
  submitButton: {
    backgroundColor: "#c6604a",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#c6604a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#faf6ef",
  },
  backToLoginBtn: {
    alignItems: "center",
    paddingVertical: 8,
    marginTop: 4,
  },
  backToLoginText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8b7355",
    textDecorationLine: "underline",
  },
  footerText: {
    fontSize: 10,
    color: "#8b7355",
    textAlign: "center",
    marginTop: 24,
    opacity: 0.7,
  },
  savedAccountsSection: {
    marginBottom: 20,
    gap: 8,
  },
  savedTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8b7355",
    paddingLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  savedScroll: {
    maxHeight: 180,
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
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
    paddingHorizontal: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#d4c5a9",
    opacity: 0.5,
  },
  dividerText: {
    fontSize: 10,
    color: "#8b7355",
    marginHorizontal: 10,
    fontWeight: "600",
    opacity: 0.7,
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
});
