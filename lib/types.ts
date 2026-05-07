export type DiaryStatus = "draft" | "image_uploaded" | "chatting" | "generating" | "generated" | "deleted";

export type DiaryMessage = {
  id: string;
  role: "user" | "assistant";
  inputType: "text" | "voice" | "ai_voice";
  text?: string;
  transcript?: string;
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
