import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import {
  documentDirectory,
  readAsStringAsync,
  writeAsStringAsync,
  deleteAsync,
  getInfoAsync
} from "expo-file-system/legacy";

const supabaseUrl = "https://ywhwgfsbfisqomrivqzq.supabase.co";
const supabaseAnonKey = "sb_publishable_HM0SZskHul3hIOAkKJnGNA_mGnwE5ih";

const SESSION_FILE = `${documentDirectory || ""}supabase-auth-session.json`;

// 本地沙盒文件存储（针对移动端原生环境）
const FileStorageAdapter = {
  getItem: async (key: string) => {
    try {
      const info = await getInfoAsync(SESSION_FILE);
      if (info.exists) {
        return await readAsStringAsync(SESSION_FILE);
      }
    } catch (e) {
      console.warn("读取本地 Session 失败:", e);
    }
    return null;
  },
  setItem: async (key: string, value: string) => {
    try {
      await writeAsStringAsync(SESSION_FILE, value);
    } catch (e) {
      console.warn("保存本地 Session 失败:", e);
    }
  },
  removeItem: async (key: string) => {
    try {
      await deleteAsync(SESSION_FILE, { idempotent: true });
    } catch (e) {
      console.warn("移除本地 Session 失败:", e);
    }
  },
};

// 浏览器 LocalStorage 存储（针对 Web 开发预览环境）
const BrowserStorageAdapter = {
  getItem: async (key: string) => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(key);
    }
    return null;
  },
  setItem: async (key: string, value: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, value);
    }
  },
  removeItem: async (key: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(key);
    }
  },
};

// 跨平台通用存储适配器：自动识别环境切换底层驱动
const UniversalStorageAdapter = Platform.OS === "web" ? BrowserStorageAdapter : FileStorageAdapter;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: UniversalStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// 自动刷新 Token（App 从后台切回前台时，仅在移动端原生环境监听）
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
