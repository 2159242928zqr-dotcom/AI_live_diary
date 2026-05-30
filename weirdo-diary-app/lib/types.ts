export type DiaryStatus = "draft" | "image_uploaded" | "chatting" | "generating" | "generated" | "deleted";

export interface LocalDiary {
  id: string;
  title: string;
  summary: string;
  content: string;
  date: string;
  createdAt: string;
  imagePath?: string;       // 本地文件路径
  eventTag?: string;
  moodTag?: string;
  status: DiaryStatus;
  messages: LocalMessage[];
}

export interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  inputType: "text" | "voice" | "ai_voice";
  text?: string;
  transcript?: string;
  audioPath?: string;
  createdAt: string;
}

export type DiaryMessage = {
  id: string;
  role: "user" | "assistant";
  inputType: "text" | "voice" | "ai_voice";
  text?: string;
  transcript?: string;
  audioId?: string;
  audioMimeType?: string;
  audioUrl?: string;
  createdAt: string;
};

export type DiarySummary = {
  id: string;
  title: string;
  summary: string;
  content: string;
  date: string;
  createdAt: string;
  imageUrl?: string;
  eventTag?: string;
  moodTag?: string;
  status: DiaryStatus;
  messages: DiaryMessage[];
};

export interface TagSettings {
  eventTags: string[];
  moodTags: string[];
}
