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
  Alert
} from "react-native";
import { useAuth } from "@/lib/auth";
import { qqEmailIsValid } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { getSavedAccounts, saveAccountToList, removeAccountFromList, type SavedAccount } from "@/lib/storage";

type AuthMode = "login" | "register";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  useEffect(() => {
    getSavedAccounts().then(setSavedAccounts).catch(console.warn);
  }, []);

  const handleLoginWithSaved = async (account: SavedAccount) => {
    if (!account.password) return;
    setLoading(true);
    try {
      await login(account.email, account.password);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const userMetadata = user.user_metadata;
        const username = userMetadata?.username || account.username || account.email.split("@")[0];
        const avatarUrl = userMetadata?.avatarUrl || account.avatarUrl || `gradient:${Math.floor(Math.random() * 6)}`;

        await saveAccountToList({
          userId: user.id,
          email: account.email,
          password: account.password,
          username: username,
          avatarUrl: avatarUrl,
          inviteCode: account.inviteCode || `MV-${user.id.slice(0, 5).toUpperCase()}`
        });
      }
    } catch (error) {
      Alert.alert("自动登录失败", error instanceof Error ? error.message : "请手动输入密码。");
      setEmail(account.email);
      setMode("login");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSaved = async (email: string) => {
    await removeAccountFromList(email);
    const updated = await getSavedAccounts();
    setSavedAccounts(updated);
  };

  const handleSubmit = async () => {
    if (!qqEmailIsValid(email)) {
      Alert.alert("邮箱格式错误", "请输入合法的 QQ 邮箱，如 123456@qq.com");
      return;
    }
    if (password.length < 6) {
      Alert.alert("密码不符合要求", "密码长度至少需要 6 位。");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      Alert.alert("密码不一致", "两次输入的密码不一致。");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
        
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const userMetadata = user.user_metadata;
          const username = userMetadata?.username || email.trim().split("@")[0];
          const avatarUrl = userMetadata?.avatarUrl || `gradient:${Math.floor(Math.random() * 6)}`;

          await saveAccountToList({
            userId: user.id,
            email: email.trim(),
            password: password,
            username: username,
            avatarUrl: avatarUrl,
            inviteCode: `MV-${user.id.slice(0, 5).toUpperCase()}`
          });
        }
      } else {
        await register(email.trim(), password, inviteCode.trim().toUpperCase());
        Alert.alert("注册成功", "同步账号资料已完成，请直接登录！", [
          { text: "好", onPress: () => setMode("login") }
        ]);
      }
    } catch (error) {
      Alert.alert("操作失败", error instanceof Error ? error.message : "未知错误");
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
          <View style={styles.field}>
            <Text style={styles.label}>QQ 邮箱</Text>
            <TextInput
              style={styles.input}
              placeholder="例如 123456@qq.com"
              placeholderTextColor="#8b7355"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>密码</Text>
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

          {mode === "register" ? (
            <>
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
          ) : null}

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#faf6ef" />
            ) : (
              <Text style={styles.submitText}>{mode === "login" ? "开启日记本" : "创建专属账号"}</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>
          账号与数据完全私有 · 数据只保留在您当前设备的本地
        </Text>
      </View>
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
  form: {
    gap: 16,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8b7355",
    paddingLeft: 4,
  },
  input: {
    backgroundColor: "#ede4d5",
    borderColor: "#d4c5a9",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: "#2c1810",
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
});
