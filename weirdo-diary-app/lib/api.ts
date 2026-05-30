import { Platform } from "react-native";
import { supabase } from "./supabase";
import {
  documentDirectory,
  readAsStringAsync,
  writeAsStringAsync,
  getInfoAsync
} from "expo-file-system/legacy";
import {
  localAiStart,
  localAiText,
  localAiVoice,
  localAiGenerate,
} from "./localAi";

const API_CONFIG_FILE = `${documentDirectory || ""}api-config.json`;

export interface ApiConfig {
  apiUrl: string;
  useLocalAi: boolean;
  glmApiKey: string;
}

const DEFAULT_CONFIG: ApiConfig = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",
  useLocalAi: false,
  glmApiKey: "",
};

let cachedConfig: ApiConfig | null = null;

export async function getApiConfig(): Promise<ApiConfig> {
  if (cachedConfig) return cachedConfig;

  if (Platform.OS === "web") {
    try {
      const stored = window.localStorage.getItem("unified_api_config");
      if (stored) {
        cachedConfig = JSON.parse(stored);
        return cachedConfig!;
      }
    } catch {}
  } else {
    try {
      const info = await getInfoAsync(API_CONFIG_FILE);
      if (info.exists) {
        const raw = await readAsStringAsync(API_CONFIG_FILE);
        const config = JSON.parse(raw);
        cachedConfig = {
          apiUrl: config.apiUrl || DEFAULT_CONFIG.apiUrl,
          useLocalAi: !!config.useLocalAi,
          glmApiKey: config.glmApiKey || "",
        };
        return cachedConfig;
      }
    } catch (e) {
      console.warn("读取本地 API 配置失败:", e);
    }
  }

  return DEFAULT_CONFIG;
}

export async function saveApiConfig(config: Partial<ApiConfig>): Promise<void> {
  const current = await getApiConfig();
  const next: ApiConfig = {
    apiUrl: (config.apiUrl !== undefined ? config.apiUrl.trim().replace(/\/$/, "") : current.apiUrl),
    useLocalAi: config.useLocalAi !== undefined ? config.useLocalAi : current.useLocalAi,
    glmApiKey: config.glmApiKey !== undefined ? config.glmApiKey.trim() : current.glmApiKey,
  };

  cachedConfig = next;

  if (Platform.OS === "web") {
    try {
      window.localStorage.setItem("unified_api_config", JSON.stringify(next));
    } catch {}
  } else {
    try {
      await writeAsStringAsync(API_CONFIG_FILE, JSON.stringify(next));
    } catch (e) {
      console.warn("保存本地 API 配置失败:", e);
      throw new Error("无法保存 API 配置到本地存储");
    }
  }
}

// 保持向下兼容的旧版读取接口
export async function getApiBaseUrl(): Promise<string> {
  const config = await getApiConfig();
  return config.apiUrl;
}

export async function apiPost(path: string, body?: FormData | object): Promise<Response> {
  const config = await getApiConfig();

  // 如果启用了本地直连 AI，且配置了 API Key，拦截 AI 请求
  if (config.useLocalAi && config.glmApiKey) {
    if (path.endsWith("/start")) {
      const payload = body as { imageDataUrl: string };
      const resData = await localAiStart(payload.imageDataUrl, config.glmApiKey);
      const pathParts = path.split("/");
      const diaryId = pathParts[pathParts.length - 2] || "";
      const fullResData = {
        diary_id: diaryId,
        status: "chatting",
        ...resData
      };
      return {
        ok: true,
        status: 200,
        json: async () => fullResData,
      } as Response;
    }

    if (path.endsWith("/messages/text")) {
      const payload = body as { content: string; history: Array<{ role: "user" | "assistant"; text: string }> };
      const resData = await localAiText(payload.content, payload.history, config.glmApiKey);
      return {
        ok: true,
        status: 200,
        json: async () => resData,
      } as Response;
    }

    if (path.endsWith("/messages/voice")) {
      const fd = body as FormData;
      let audioUri = "";
      let history: Array<{ role: "user" | "assistant"; text: string }> = [];

      // 提取 React Native FormData 内部的字段值
      const parts = (fd as any)._parts || [];
      for (const [key, value] of parts) {
        if (key === "audio") {
          audioUri = value.uri;
        } else if (key === "history") {
          try {
            history = JSON.parse(value);
          } catch {}
        }
      }

      const resData = await localAiVoice(audioUri, history, config.glmApiKey);
      return {
        ok: true,
        status: 200,
        json: async () => resData,
      } as Response;
    }

    if (path.endsWith("/generate")) {
      const payload = body as { messages: Array<{ role: "user" | "assistant"; text: string }> };
      const resData = await localAiGenerate(payload.messages, config.glmApiKey);
      return {
        ok: true,
        status: 200,
        json: async () => resData,
      } as Response;
    }
  }

  // 默认请求 Next.js 服务端代理
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const isFormData = body instanceof FormData;
  if (!isFormData) headers["Content-Type"] = "application/json";

  const response = await fetch(`${config.apiUrl}${path}`, {
    method: "POST",
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "请求失败" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response;
}
