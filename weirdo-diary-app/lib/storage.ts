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
export type { TagSettings };

const DATA_FILE = `${documentDirectory}diary-data.json`;
const PHOTOS_DIR = `${documentDirectory}photos/`;
const AUDIOS_DIR = `${documentDirectory}audios/`;
const TAGS_FILE = `${documentDirectory}tag-settings.json`;
const ACCOUNTS_FILE = `${documentDirectory}saved-accounts.json`;

export const defaultTagSettings = {
  eventTags: ["旅游", "看电影", "聚会", "工作", "散步", "独处"],
  moodTags: ["开心", "高兴", "平静", "疲惫", "期待", "难过"]
};

// --- CRUD ---

export async function initStorage(): Promise<void> {
  await Promise.all([
    ensureFile(DATA_FILE, "[]"),
    ensureFile(TAGS_FILE, JSON.stringify(defaultTagSettings)),
    ensureFile(ACCOUNTS_FILE, "[]"),
    ensureDir(PHOTOS_DIR),
    ensureDir(AUDIOS_DIR),
  ]);
}

export async function loadAllDiaries(): Promise<LocalDiary[]> {
  try {
    const raw = await readAsStringAsync(DATA_FILE);
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
  await writeAsStringAsync(DATA_FILE, JSON.stringify(diaries, null, 2));
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
  await writeAsStringAsync(DATA_FILE, JSON.stringify(remaining, null, 2));
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
