import { demoDiary } from "@/lib/demo-data";
import type { DiaryMessage, DiarySummary } from "@/lib/types";

const diaryListKey = "weirdoDiary:diaries:v1";
const draftKey = "weirdoDiary:currentDraft:v1";
const deletedDemoKey = "weirdoDiary:deletedDemo:v1";
const userKey = "weirdoDiary:user:v1";
const tagSettingsKey = "weirdoDiary:tagSettings:v1";
const maxStoredImageChars = 1_200_000;
const defaultTagSettings = {
  eventTags: ["旅游", "看电影", "聚会", "工作", "散步", "独处"],
  moodTags: ["开心", "高兴", "平静", "疲惫", "期待", "难过"]
};

export type DiaryDraft = {
  id: string;
  imageUrl: string;
  title?: string;
  eventTag?: string;
  moodTag?: string;
  createdAt: string;
  status: "image_uploaded" | "chatting";
};

export type LocalUser = {
  email: string;
  inviteCode: string;
  usedInviteCode?: string;
  loggedInAt: string;
};

export type TagSettings = typeof defaultTagSettings;

function hasWindow() {
  return typeof window !== "undefined";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function withTodayDemo(): DiarySummary {
  if (!hasWindow()) return demoDiary;
  const now = new Date().toISOString();
  return {
    ...demoDiary,
    date: todayIso(),
    createdAt: now,
    messages: demoDiary.messages.map((message) => ({ ...message, createdAt: now }))
  };
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function validDateString(value: unknown) {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

function safeImageUrl(value: unknown) {
  if (typeof value !== "string" || value.length === 0) return demoDiary.imageUrl;
  if (value.startsWith("data:") && value.length > maxStoredImageChars) return demoDiary.imageUrl;
  return value;
}

function normalizeDiary(diary: Partial<DiarySummary>, index = 0): DiarySummary {
  const createdAt = validDateString(diary.createdAt) ? diary.createdAt as string : new Date().toISOString();
  return {
    ...demoDiary,
    ...diary,
    id: typeof diary.id === "string" && diary.id ? diary.id : `local-diary-${index}`,
    title: typeof diary.title === "string" && diary.title ? diary.title : demoDiary.title,
    summary: typeof diary.summary === "string" && diary.summary ? diary.summary : demoDiary.summary,
    content: typeof diary.content === "string" && diary.content ? diary.content : demoDiary.content,
    imageUrl: safeImageUrl(diary.imageUrl),
    messages: Array.isArray(diary.messages) ? diary.messages : demoDiary.messages,
    createdAt,
    date: typeof diary.date === "string" && diary.date ? diary.date : createdAt.slice(0, 10),
    status: diary.status ?? "generated"
  };
}

export function createLocalId(prefix = "diary") {
  const random = hasWindow() && "crypto" in window ? window.crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${prefix}-${random}`;
}

export function getLocalUser() {
  if (!hasWindow()) return null;
  return parseJson<LocalUser | null>(localStorage.getItem(userKey), null);
}

export function saveLocalUser(email: string, usedInviteCode?: string) {
  const user: LocalUser = {
    email,
    inviteCode: `MV-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    usedInviteCode: usedInviteCode?.trim() || undefined,
    loggedInAt: new Date().toISOString()
  };
  localStorage.setItem(userKey, JSON.stringify(user));
  return user;
}

function normalizeTags(tags: unknown, fallback: string[]) {
  if (!Array.isArray(tags)) return fallback;
  const next = tags
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return next.length > 0 ? Array.from(new Set(next)) : fallback;
}

export function getTagSettings(): TagSettings {
  if (!hasWindow()) return defaultTagSettings;
  const saved = parseJson<Partial<TagSettings>>(localStorage.getItem(tagSettingsKey), defaultTagSettings);
  return {
    eventTags: normalizeTags(saved.eventTags, defaultTagSettings.eventTags),
    moodTags: normalizeTags(saved.moodTags, defaultTagSettings.moodTags)
  };
}

export function saveTagSettings(settings: TagSettings) {
  if (!hasWindow()) return settings;
  const next = {
    eventTags: normalizeTags(settings.eventTags, defaultTagSettings.eventTags),
    moodTags: normalizeTags(settings.moodTags, defaultTagSettings.moodTags)
  };
  localStorage.setItem(tagSettingsKey, JSON.stringify(next));
  return next;
}

export function listDiaries() {
  if (!hasWindow()) return [demoDiary];
  const diaries = parseJson<Partial<DiarySummary>[]>(localStorage.getItem(diaryListKey), []);
  if (diaries.length > 0) {
    const normalized = diaries
      .map((diary, index) => normalizeDiary(diary, index))
      .filter((diary) => diary.status !== "deleted")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    try {
      localStorage.setItem(diaryListKey, JSON.stringify(normalized));
    } catch {
      localStorage.setItem(
        diaryListKey,
        JSON.stringify(normalized.map((diary) => ({ ...diary, imageUrl: safeImageUrl("") })))
      );
    }
    return normalized;
  }
  return localStorage.getItem(deletedDemoKey) === "1" ? [] : [withTodayDemo()];
}

export function loadSavedDiary(diaryId = "demo-diary") {
  const diaries = listDiaries();
  return diaries.find((diary) => diary.id === diaryId) ?? diaries[0] ?? withTodayDemo();
}

export function persistDiary(diary: DiarySummary) {
  if (!hasWindow()) return diary;
  const diaries = parseJson<DiarySummary[]>(localStorage.getItem(diaryListKey), []);
  const next = [diary, ...diaries.filter((item) => item.id !== diary.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  try {
    localStorage.setItem(diaryListKey, JSON.stringify(next));
  } catch {
    const fallback = next.map((item) => ({
      ...item,
      imageUrl: item.imageUrl?.startsWith("data:") ? demoDiary.imageUrl : item.imageUrl
    }));
    localStorage.setItem(diaryListKey, JSON.stringify(fallback));
  }
  return diary;
}

export function updateDiarySummary(
  diaryId: string,
  patch: Pick<DiarySummary, "title" | "summary" | "content"> & Pick<Partial<DiarySummary>, "eventTag" | "moodTag">
) {
  const diary = loadSavedDiary(diaryId);
  return persistDiary({ ...diary, ...patch });
}

export function deleteDiary(diaryId: string) {
  if (!hasWindow()) return;
  const diaries = parseJson<DiarySummary[]>(localStorage.getItem(diaryListKey), []);
  localStorage.setItem(diaryListKey, JSON.stringify(diaries.filter((diary) => diary.id !== diaryId)));
  if (diaryId === demoDiary.id) localStorage.setItem(deletedDemoKey, "1");
}

export function createDraft(imageUrl: string, meta?: Pick<DiaryDraft, "title" | "eventTag" | "moodTag">) {
  const draft: DiaryDraft = {
    id: createLocalId(),
    imageUrl,
    title: meta?.title?.trim() || undefined,
    eventTag: meta?.eventTag,
    moodTag: meta?.moodTag,
    createdAt: new Date().toISOString(),
    status: "image_uploaded"
  };
  sessionStorage.setItem(draftKey, JSON.stringify(draft));
  return draft;
}

export function getCurrentDraft() {
  if (!hasWindow()) return null;
  return parseJson<DiaryDraft | null>(sessionStorage.getItem(draftKey), null);
}

export function markDraftChatting() {
  const draft = getCurrentDraft();
  if (!draft) return null;
  const next = { ...draft, status: "chatting" as const };
  sessionStorage.setItem(draftKey, JSON.stringify(next));
  return next;
}

export function getCurrentDiaryImage() {
  return getCurrentDraft()?.imageUrl || loadSavedDiary().imageUrl || demoDiary.imageUrl || "";
}

export function saveCurrentDiary(messages: DiaryMessage[]) {
  const now = new Date().toISOString();
  const draft = getCurrentDraft();
  const userTexts = messages
    .filter((message) => message.role === "user")
    .map((message) => message.text || message.transcript)
    .filter(Boolean);
  const title = draft?.title || (userTexts.length > 0 ? "今天留下的一段怪咖记忆" : "从一张照片开始");
  const tags = [draft?.eventTag, draft?.moodTag].filter(Boolean).join(" · ");
  const summary =
    userTexts[0] ?? (tags ? `${tags}。一次围绕照片展开的语音日记。` : "一次围绕照片展开的语音日记，记录当下看见的画面和心里的感受。");
  const content =
    userTexts.length > 0
      ? `今天我从一张照片开始记录。${tags ? `这篇日记被标记为${tags}。` : ""}${userTexts.join(" ")} 这些片段被慢慢收拢成一篇日记，也像是给今天留下一枚安静的书签。`
      : `今天我从一张照片开始记录。${tags ? `这篇日记被标记为${tags}。` : ""}画面本身像一个入口，让我慢慢靠近此刻的心情，也把这段小小的时间保存下来。`;

  const diary: DiarySummary = {
    id: draft?.id ?? createLocalId(),
    title,
    summary,
    content,
    imageUrl: draft?.imageUrl || getCurrentDiaryImage(),
    eventTag: draft?.eventTag,
    moodTag: draft?.moodTag,
    messages,
    status: "generated",
    createdAt: now,
    date: now.slice(0, 10)
  };
  sessionStorage.removeItem(draftKey);
  return persistDiary(diary);
}
