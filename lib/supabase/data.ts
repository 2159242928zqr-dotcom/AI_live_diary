import crypto from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { decryptText, encryptText } from "@/lib/crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { DiaryMessage, DiarySummary } from "@/lib/types";

const imageBucket = "diary-images-private";
const defaultEventTags = ["旅游", "看电影", "聚会", "工作", "散步", "独处"];
const defaultMoodTags = ["开心", "高兴", "平静", "疲惫", "期待", "难过"];
const aiReplies = [
  "我听到了。这个片段里似乎有一些值得慢慢整理的感受，你愿意再多讲一点当时发生了什么吗？",
  "这张照片像是替你留住了一个停顿。那个瞬间里，你最想记住的是什么？",
  "我会把这些细节先收好。还有没有一个人、一句话，或者一种气味，是和这张照片绑在一起的？"
];

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function admin() {
  return getSupabaseAdmin();
}

export async function requireUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new ApiError("请先登录。", 401);
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) throw new ApiError("登录已过期，请重新登录。", 401);
  return data.user;
}

function encryptOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? encryptText(trimmed) : null;
}

function decryptOptional(value?: string | null) {
  if (!value) return "";
  try {
    return decryptText(value);
  } catch {
    return "";
  }
}

function normalizeTags(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const tags = value
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.length > 0 ? Array.from(new Set(tags)) : fallback;
}

function makeInviteCode() {
  return `MV-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function generateInviteCode() {
  const db = admin();
  for (let index = 0; index < 8; index += 1) {
    const code = makeInviteCode();
    const { data, error } = await db.from("profiles").select("id").eq("invite_code", code).maybeSingle();
    if (error) throw new ApiError("邀请码生成失败。", 500, error.message);
    if (!data) return code;
  }
  throw new ApiError("邀请码生成失败，请稍后重试。", 500);
}

export async function ensureProfile(user: User, inviteCode?: string) {
  const db = admin();
  const { data: existing, error: existingError } = await db
    .from("profiles")
    .select("id,user_id,qq_email,invite_code,invited_by_user_id,event_tags,mood_tags")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingError) throw new ApiError("读取用户资料失败。", 500, existingError.message);
  if (existing) return existing;

  let invitedByUserId: string | null = null;
  const cleanInviteCode = inviteCode?.trim().toUpperCase();
  if (cleanInviteCode) {
    const { data: inviter, error } = await db
      .from("profiles")
      .select("user_id,invite_code")
      .eq("invite_code", cleanInviteCode)
      .maybeSingle();
    if (error) throw new ApiError("校验邀请码失败。", 500, error.message);
    if (inviter?.user_id && inviter.user_id !== user.id) invitedByUserId = inviter.user_id;
  }

  const profile = {
    user_id: user.id,
    qq_email: user.email ?? "",
    invite_code: await generateInviteCode(),
    invited_by_user_id: invitedByUserId,
    event_tags: defaultEventTags,
    mood_tags: defaultMoodTags
  };
  const { data, error } = await db.from("profiles").insert(profile).select("*").single();
  if (error) throw new ApiError("创建用户资料失败。", 500, error.message);

  if (invitedByUserId && cleanInviteCode) {
    await db.from("referrals").insert({
      inviter_user_id: invitedByUserId,
      invitee_user_id: user.id,
      invite_code: cleanInviteCode
    });
  }
  return data;
}

export async function getProfile(user: User) {
  const profile = await ensureProfile(user);
  return {
    email: profile.qq_email,
    inviteCode: profile.invite_code,
    eventTags: normalizeTags(profile.event_tags, defaultEventTags),
    moodTags: normalizeTags(profile.mood_tags, defaultMoodTags)
  };
}

export async function updateProfileTags(user: User, eventTags: string[], moodTags: string[]) {
  const nextEventTags = normalizeTags(eventTags, defaultEventTags);
  const nextMoodTags = normalizeTags(moodTags, defaultMoodTags);
  const { data, error } = await admin()
    .from("profiles")
    .update({ event_tags: nextEventTags, mood_tags: nextMoodTags, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .select("event_tags,mood_tags,invite_code,qq_email")
    .single();
  if (error) throw new ApiError("保存标签失败。", 500, error.message);
  return {
    email: data.qq_email,
    inviteCode: data.invite_code,
    eventTags: normalizeTags(data.event_tags, defaultEventTags),
    moodTags: normalizeTags(data.mood_tags, defaultMoodTags)
  };
}

async function signedImageUrl(pathEncrypted?: string | null) {
  if (!pathEncrypted) return "";
  const path = decryptOptional(pathEncrypted);
  if (!path) return "";
  const { data, error } = await admin().storage.from(imageBucket).createSignedUrl(path, 60 * 60);
  if (error) return "";
  return data.signedUrl;
}

async function getCoverPathEncrypted(diary: { cover_image_id?: string | null; id: string }) {
  if (!diary.cover_image_id) return null;
  const { data } = await admin()
    .from("diary_images")
    .select("storage_path_encrypted")
    .eq("id", diary.cover_image_id)
    .eq("diary_id", diary.id)
    .maybeSingle();
  return data?.storage_path_encrypted ?? null;
}

function mapMessage(row: any): DiaryMessage {
  const text = decryptOptional(row.text_encrypted);
  const inputType = row.input_type as DiaryMessage["inputType"];
  return {
    id: row.id,
    role: row.role,
    inputType,
    text: inputType === "text" ? text : undefined,
    transcript: inputType !== "text" ? text : undefined,
    audioUrl: "",
    createdAt: row.created_at
  };
}

async function mapDiary(row: any, includeMessages = true): Promise<DiarySummary> {
  const coverPath = await getCoverPathEncrypted(row);
  const imageUrl = await signedImageUrl(coverPath);
  const messages = includeMessages ? await listMessages(row.user_id, row.id) : [];
  return {
    id: row.id,
    title: decryptOptional(row.title_encrypted) || "未命名日记",
    summary: decryptOptional(row.summary_encrypted),
    content: decryptOptional(row.content_encrypted),
    date: row.diary_date,
    createdAt: row.created_at,
    imageUrl,
    eventTag: row.event_tag ?? undefined,
    moodTag: row.mood_tag ?? undefined,
    status: row.status,
    messages
  };
}

async function listMessages(userId: string, diaryId: string) {
  const { data, error } = await admin()
    .from("diary_messages")
    .select("*")
    .eq("user_id", userId)
    .eq("diary_id", diaryId)
    .is("deleted_at", null)
    .order("sequence", { ascending: true });
  if (error) throw new ApiError("读取聊天记录失败。", 500, error.message);
  return (data ?? []).map(mapMessage);
}

async function getDiaryRow(userId: string, diaryId: string) {
  const { data, error } = await admin()
    .from("diaries")
    .select("*")
    .eq("id", diaryId)
    .eq("user_id", userId)
    .neq("status", "deleted")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new ApiError("读取日记失败。", 500, error.message);
  if (!data) throw new ApiError("日记不存在。", 404);
  return data;
}

export async function getDiary(user: User, diaryId: string) {
  return mapDiary(await getDiaryRow(user.id, diaryId));
}

export async function listRecentDiaries(user: User, limit = 12) {
  const { data, error } = await admin()
    .from("diaries")
    .select("*")
    .eq("user_id", user.id)
    .neq("status", "deleted")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new ApiError("读取日记列表失败。", 500, error.message);
  return Promise.all((data ?? []).map((row) => mapDiary(row, false)));
}

export async function listCalendar(user: User, month: string) {
  const from = `${month}-01`;
  const toDate = new Date(`${from}T00:00:00.000Z`);
  toDate.setUTCMonth(toDate.getUTCMonth() + 1);
  const to = toDate.toISOString().slice(0, 10);
  const { data, error } = await admin()
    .from("diaries")
    .select("*")
    .eq("user_id", user.id)
    .neq("status", "deleted")
    .is("deleted_at", null)
    .gte("diary_date", from)
    .lt("diary_date", to)
    .order("created_at", { ascending: false });
  if (error) throw new ApiError("读取日历失败。", 500, error.message);
  const diaries = await Promise.all((data ?? []).map((row) => mapDiary(row, false)));
  const grouped = diaries.reduce<Record<string, DiarySummary[]>>((acc, diary) => {
    acc[diary.date] = [...(acc[diary.date] ?? []), diary];
    return acc;
  }, {});
  return {
    month,
    days: Object.entries(grouped).map(([date, items]) => ({
      date,
      count: items.length,
      items: items.map((diary) => ({
        diary_id: diary.id,
        title: diary.title,
        summary: diary.summary,
        cover_image_url: diary.imageUrl,
        created_at: diary.createdAt,
        event_tag: diary.eventTag,
        mood_tag: diary.moodTag
      }))
    }))
  };
}

export async function createDraftDiary(user: User, body: any) {
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const eventTag = typeof body?.eventTag === "string" ? body.eventTag.trim() : null;
  const moodTag = typeof body?.moodTag === "string" ? body.moodTag.trim() : null;
  const now = new Date();
  const { data, error } = await admin()
    .from("diaries")
    .insert({
      user_id: user.id,
      diary_date: now.toISOString().slice(0, 10),
      title_encrypted: encryptOptional(title || "从一张照片开始"),
      event_tag: eventTag || null,
      mood_tag: moodTag || null,
      status: "draft"
    })
    .select("id,status")
    .single();
  if (error) throw new ApiError("创建日记失败。", 500, error.message);
  return { diary_id: data.id, status: data.status };
}

function extensionForMime(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export async function uploadDiaryImage(user: User, diaryId: string, file: File) {
  const diary = await getDiaryRow(user.id, diaryId);
  if (!["draft", "image_uploaded"].includes(diary.status)) {
    throw new ApiError("当前日记状态不能上传图片。", 409);
  }
  const imageId = crypto.randomUUID();
  const path = `${user.id}/${diaryId}/${imageId}.${extensionForMime(file.type)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin().storage.from(imageBucket).upload(path, buffer, {
    contentType: file.type,
    upsert: false
  });
  if (uploadError) throw new ApiError("图片上传失败。", 500, uploadError.message);

  const { data: image, error: imageError } = await admin()
    .from("diary_images")
    .insert({
      id: imageId,
      user_id: user.id,
      diary_id: diaryId,
      storage_path_encrypted: encryptText(path),
      mime_type: file.type,
      size_bytes: file.size
    })
    .select("id")
    .single();
  if (imageError) throw new ApiError("保存图片记录失败。", 500, imageError.message);

  const { error: diaryError } = await admin()
    .from("diaries")
    .update({ cover_image_id: image.id, status: "image_uploaded", updated_at: new Date().toISOString() })
    .eq("id", diaryId)
    .eq("user_id", user.id);
  if (diaryError) throw new ApiError("更新日记图片失败。", 500, diaryError.message);
  return { diary_id: diaryId, image_id: image.id, status: "image_uploaded" };
}

async function nextSequence(userId: string, diaryId: string) {
  const { data, error } = await admin()
    .from("diary_messages")
    .select("sequence")
    .eq("user_id", userId)
    .eq("diary_id", diaryId)
    .order("sequence", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new ApiError("读取消息序号失败。", 500, error.message);
  return typeof data?.sequence === "number" ? data.sequence + 1 : 0;
}

export async function startDiary(user: User, diaryId: string) {
  const diary = await getDiaryRow(user.id, diaryId);
  if (!["image_uploaded", "chatting", "generated"].includes(diary.status)) {
    throw new ApiError("请先上传图片。", 409);
  }
  const existing = await listMessages(user.id, diaryId);
  if (existing.length > 0) {
    return { diary_id: diaryId, status: diary.status, image_url: (await mapDiary(diary, false)).imageUrl, messages: existing };
  }

  const message = {
    user_id: user.id,
    diary_id: diaryId,
    role: "assistant",
    input_type: "ai_voice",
    text_encrypted: encryptText("我注意到这张照片里有一些值得记录的细节。你想从哪里开始讲起？"),
    sequence: 0
  };
  const { data, error } = await admin().from("diary_messages").insert(message).select("*").single();
  if (error) throw new ApiError("创建开场消息失败。", 500, error.message);
  await admin()
    .from("diaries")
    .update({ status: "chatting", started_at: diary.started_at ?? new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", diaryId)
    .eq("user_id", user.id);
  return {
    diary_id: diaryId,
    status: "chatting",
    image_url: (await mapDiary(diary, false)).imageUrl,
    messages: [mapMessage(data)]
  };
}

export async function addTextMessage(user: User, diaryId: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed) throw new ApiError("content is required", 400);
  const diary = await getDiaryRow(user.id, diaryId);
  if (!["chatting", "image_uploaded"].includes(diary.status)) throw new ApiError("当前日记状态不能继续聊天。", 409);
  const sequence = await nextSequence(user.id, diaryId);
  const assistantText = aiReplies[sequence % aiReplies.length];
  const { data, error } = await admin()
    .from("diary_messages")
    .insert([
      {
        user_id: user.id,
        diary_id: diaryId,
        role: "user",
        input_type: "text",
        text_encrypted: encryptText(trimmed),
        sequence
      },
      {
        user_id: user.id,
        diary_id: diaryId,
        role: "assistant",
        input_type: "ai_voice",
        text_encrypted: encryptText(assistantText),
        sequence: sequence + 1
      }
    ])
    .select("*")
    .order("sequence", { ascending: true });
  if (error) throw new ApiError("保存消息失败。", 500, error.message);
  await admin()
    .from("diaries")
    .update({ status: "chatting", updated_at: new Date().toISOString() })
    .eq("id", diaryId)
    .eq("user_id", user.id);
  const messages = (data ?? []).map(mapMessage);
  return {
    user_message_id: messages[0]?.id,
    assistant_message_id: messages[1]?.id,
    assistant_audio_url: "",
    assistant_transcript_saved: true,
    messages
  };
}

function buildSummary(messages: DiaryMessage[], eventTag?: string, moodTag?: string) {
  const userTexts = messages.map((message) => message.text || message.transcript).filter(Boolean);
  const tags = [eventTag, moodTag].filter(Boolean).join(" · ");
  const title = userTexts.length > 0 ? "今天留下的一段怪咖记忆" : "从一张照片开始";
  const summary =
    userTexts[0] ?? (tags ? `${tags}。一次围绕照片展开的语音日记。` : "一次围绕照片展开的语音日记，记录当下看见的画面和心里的感受。");
  const content =
    userTexts.length > 0
      ? `今天我从一张照片开始记录。${tags ? `这篇日记被标记为${tags}。` : ""}${userTexts.join(" ")} 这些片段被慢慢收拢成一篇日记，也像是给今天留下一枚安静的书签。`
      : `今天我从一张照片开始记录。${tags ? `这篇日记被标记为${tags}。` : ""}画面本身像一个入口，让我慢慢靠近此刻的心情，也把这段小小的时间保存下来。`;
  return { title, summary, content };
}

export async function generateDiary(user: User, diaryId: string) {
  const diary = await getDiaryRow(user.id, diaryId);
  if (!["chatting", "image_uploaded", "generated"].includes(diary.status)) throw new ApiError("当前日记状态不能生成。", 409);
  const messages = await listMessages(user.id, diaryId);
  const summary = buildSummary(messages.filter((message) => message.role === "user"), diary.event_tag, diary.mood_tag);
  const existingTitle = decryptOptional(diary.title_encrypted).trim();
  const title = existingTitle && existingTitle !== "从一张照片开始" ? existingTitle : summary.title;
  const { error } = await admin()
    .from("diaries")
    .update({
      title_encrypted: encryptText(title),
      summary_encrypted: encryptText(summary.summary),
      content_encrypted: encryptText(summary.content),
      status: "generated",
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", diaryId)
    .eq("user_id", user.id);
  if (error) throw new ApiError("生成日记失败。", 500, error.message);
  return { diary_id: diaryId, status: "generated" };
}

export async function updateDiary(user: User, diaryId: string, body: any) {
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const summary = typeof body?.summary === "string" ? body.summary.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!title || !summary || !content) throw new ApiError("title, summary and content are required", 400);
  await getDiaryRow(user.id, diaryId);
  const { error } = await admin()
    .from("diaries")
    .update({
      title_encrypted: encryptText(title),
      summary_encrypted: encryptText(summary),
      content_encrypted: encryptText(content),
      event_tag: typeof body?.eventTag === "string" ? body.eventTag.trim() || null : null,
      mood_tag: typeof body?.moodTag === "string" ? body.moodTag.trim() || null : null,
      updated_at: new Date().toISOString()
    })
    .eq("id", diaryId)
    .eq("user_id", user.id);
  if (error) throw new ApiError("保存日记失败。", 500, error.message);
  return { success: true };
}

export async function softDeleteDiary(user: User, diaryId: string) {
  await getDiaryRow(user.id, diaryId);
  const now = new Date().toISOString();
  const { error } = await admin()
    .from("diaries")
    .update({ status: "deleted", deleted_at: now, updated_at: now })
    .eq("id", diaryId)
    .eq("user_id", user.id);
  if (error) throw new ApiError("删除日记失败。", 500, error.message);
  return { success: true };
}
