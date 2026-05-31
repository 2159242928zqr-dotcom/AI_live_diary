import {
  documentDirectory,
  copyAsync,
  readAsStringAsync,
  writeAsStringAsync,
  getInfoAsync,
  makeDirectoryAsync,
  deleteAsync
} from "expo-file-system/legacy";
import { LocalDiary, LocalMessage, DiaryStatus, TagSettings } from "./types";
import { supabase } from "./supabase";
export type { TagSettings };

const PHOTOS_DIR = `${documentDirectory}photos/`;
const AUDIOS_DIR = `${documentDirectory}audios/`;
const TAGS_FILE = `${documentDirectory}tag-settings.json`;
const ACCOUNTS_FILE = `${documentDirectory}saved-accounts.json`;

// 获取当前登录用户 ID，作为沙盒多用户隔离键
async function getUserId(): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || "shared";
  } catch {
    return "shared";
  }
}

// 动态获取当前用户专属的日记数据库 JSON 文件路径，保障多账号数据完全独立与隐私安全
async function getDataFile(): Promise<string> {
  const userId = await getUserId();
  return `${documentDirectory}diary-data-${userId}.json`;
}

export const defaultTagSettings = {
  eventTags: ["旅游", "看电影", "聚会", "工作", "散步", "独处"],
  moodTags: ["开心", "高兴", "平静", "疲惫", "期待", "难过"]
};

// --- CRUD ---

export async function initStorage(): Promise<void> {
  const dataFile = await getDataFile();
  await Promise.all([
    ensureFile(dataFile, "[]"),
    ensureFile(TAGS_FILE, JSON.stringify(defaultTagSettings)),
    ensureFile(ACCOUNTS_FILE, "[]"),
    ensureDir(PHOTOS_DIR),
    ensureDir(AUDIOS_DIR),
  ]);
}

export async function loadAllDiaries(): Promise<LocalDiary[]> {
  try {
    const dataFile = await getDataFile();
    const info = await getInfoAsync(dataFile);
    if (!info.exists) {
      await writeAsStringAsync(dataFile, "[]");
      return [];
    }
    const raw = await readAsStringAsync(dataFile);
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveDiary(diary: LocalDiary): Promise<void> {
  const diaries = await loadAllDiaries();
  const index = diaries.findIndex((d) => d.id === diary.id);
  if (index >= 0) {
    diaries[index] = diary;
  } else {
    diaries.push(diary);
  }
  const dataFile = await getDataFile();
  await writeAsStringAsync(dataFile, JSON.stringify(diaries, null, 2));
}

export async function getDiary(id: string): Promise<LocalDiary | null> {
  const diaries = await loadAllDiaries();
  return diaries.find((d) => d.id === id) ?? null;
}

export async function deleteDiary(id: string): Promise<void> {
  const diaries = await loadAllDiaries();
  const diary = diaries.find((d) => d.id === id);
  if (!diary) return;

  // 删除关联文件
  const filesToDelete: string[] = [];
  if (diary.imagePath) filesToDelete.push(diary.imagePath);
  diary.messages.forEach((m) => {
    if (m.audioPath) filesToDelete.push(m.audioPath);
  });
  
  await Promise.allSettled(
    filesToDelete.map((f) => deleteAsync(f, { idempotent: true }))
  );

  // 更新数据文件
  const remaining = diaries.filter((d) => d.id !== id);
  const dataFile = await getDataFile();
  await writeAsStringAsync(dataFile, JSON.stringify(remaining, null, 2));
}

// 擦除当前账号所有本地数据与关联的物理照片和语音素材 (仅在注销删除账户时执行)
export async function purgeUserDiaries(): Promise<void> {
  try {
    const diaries = await loadAllDiaries();
    
    // 1. 清除物理文件
    const filesToDelete: string[] = [];
    diaries.forEach((d) => {
      if (d.imagePath) filesToDelete.push(d.imagePath);
      d.messages.forEach((m) => {
        if (m.audioPath) filesToDelete.push(m.audioPath);
      });
    });

    await Promise.allSettled(
      filesToDelete.map((f) => deleteAsync(f, { idempotent: true }))
    );

    // 2. 清除专属 json 文件
    const dataFile = await getDataFile();
    await deleteAsync(dataFile, { idempotent: true });
  } catch (err) {
    console.warn("擦除本地专属数据失败:", err);
  }
}

// 按日期查询
export async function getDiariesByMonth(year: number, month: number): Promise<LocalDiary[]> {
  const diaries = await loadAllDiaries();
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return diaries
    .filter((d) => d.date.startsWith(prefix) && d.status !== "deleted")
    .sort((a, b) => b.date.localeCompare(a.date));
}

// 保存照片文件
export async function savePhoto(sourceUri: string): Promise<string> {
  const id = `diary-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const dest = `${PHOTOS_DIR}${id}.jpg`;
  await copyAsync({ from: sourceUri, to: dest });
  return dest;
}

// 保存音频文件
export async function saveAudio(sourceUri: string, prefix: "user" | "ai"): Promise<string> {
  const id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  // 检测源文件的扩展名，保留真实后缀名（如 .m4a），防止把 aac/m4a 文件强行重命名为 wav 导致 ASR 报 1214 编码解析错误
  let ext = "wav";
  const match = sourceUri.match(/\.(\w+)$/);
  if (match && match[1]) {
    ext = match[1].toLowerCase();
  }
  const dest = `${AUDIOS_DIR}${id}.${ext}`;
  await copyAsync({ from: sourceUri, to: dest });
  return dest;
}

// --- 辅助 ---
async function ensureFile(path: string, content: string) {
  const info = await getInfoAsync(path);
  if (!info.exists) {
    await writeAsStringAsync(path, content);
  }
}

async function ensureDir(path: string) {
  const info = await getInfoAsync(path);
  if (!info.exists) {
    await makeDirectoryAsync(path, { intermediates: true });
  }
}

export async function getTagSettings(): Promise<TagSettings> {
  try {
    const raw = await readAsStringAsync(TAGS_FILE);
    return JSON.parse(raw);
  } catch {
    return defaultTagSettings;
  }
}

export async function saveTagSettings(settings: TagSettings): Promise<TagSettings> {
  await writeAsStringAsync(TAGS_FILE, JSON.stringify(settings, null, 2));
  return settings;
}

export type SavedAccount = {
  userId: string;
  email: string;
  password?: string;
  username?: string;
  avatarUrl?: string;
  inviteCode?: string;
  lastUsedAt: string;
};

export async function getSavedAccounts(): Promise<SavedAccount[]> {
  try {
    const raw = await readAsStringAsync(ACCOUNTS_FILE);
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveAccountToList(account: Omit<SavedAccount, "lastUsedAt">): Promise<void> {
  const accounts = await getSavedAccounts();
  const index = accounts.findIndex((a) => a.email.toLowerCase() === account.email.toLowerCase());
  
  const updatedAccount: SavedAccount = {
    ...account,
    lastUsedAt: new Date().toISOString()
  };

  if (index >= 0) {
    accounts[index] = {
      ...accounts[index],
      ...updatedAccount
    };
  } else {
    accounts.push(updatedAccount);
  }
  
  accounts.sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
  await writeAsStringAsync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

export async function removeAccountFromList(email: string): Promise<void> {
  const accounts = await getSavedAccounts();
  const next = accounts.filter((a) => a.email.toLowerCase() !== email.toLowerCase());
  await writeAsStringAsync(ACCOUNTS_FILE, JSON.stringify(next, null, 2));
}
