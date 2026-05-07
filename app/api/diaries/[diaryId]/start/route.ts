import { ok } from "@/lib/api-response";

export async function POST(_request: Request, { params }: { params: Promise<{ diaryId: string }> }) {
  const { diaryId } = await params;
  return ok({
    diary_id: diaryId,
    message_id: crypto.randomUUID(),
    audio_url: "",
    status: "chatting",
    note: "Supabase/Gemini configured 后这里会生成真实开场语音。"
  });
}
