import { fail, ok } from "@/lib/api-response";
import { generateAssistantReply } from "@/lib/ai/assistant";
import { synthesizeAssistantSpeech } from "@/lib/ai/speech";
import type { DiaryMessage } from "@/lib/types";
import { verifyAuth } from "@/lib/auth";
import { handleCors } from "@/lib/cors";

export async function OPTIONS(request: Request) {
  return handleCors(request) || new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) return fail("content is required", 400);

  try {
    const userMessage: DiaryMessage = {
      id: crypto.randomUUID(),
      role: "user",
      inputType: "text",
      text: content,
      createdAt: new Date().toISOString()
    };
    const history = [...normalizeHistory(body?.history), { role: "user" as const, text: content }];
    const reply = await generateAssistantReply(history);
    const transcript = reply.transcript;
    const { assistantMessage, voiceNotice } = await buildAssistantMessage(transcript);

    return ok({
      user_message: userMessage,
      assistant_message: assistantMessage,
      voice_notice: combineNotices(reply.notice, voiceNotice)
    });
  } catch (error) {
    return fail("AI text reply failed", 502, error instanceof Error ? error.message : "unknown error");
  }
}

function normalizeHistory(value: unknown): Array<{ role: "user" | "assistant"; text: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = item as Partial<DiaryMessage>;
    const role = record.role === "assistant" ? "assistant" : record.role === "user" ? "user" : null;
    const text = typeof record.text === "string" ? record.text.trim() : typeof record.transcript === "string" ? record.transcript.trim() : "";
    return role && text ? [{ role, text }] : [];
  });
}

function toAudioDataUrl(audio: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${audio.toString("base64")}`;
}

async function buildAssistantMessage(transcript: string): Promise<{ assistantMessage: DiaryMessage; voiceNotice?: string }> {
  const speech = await synthesizeAssistantSpeech(transcript);
  return {
    assistantMessage: {
      id: crypto.randomUUID(),
      role: "assistant",
      inputType: "ai_voice",
      transcript,
      audioUrl: toAudioDataUrl(speech.audio, speech.mimeType),
      audioMimeType: speech.mimeType,
      createdAt: new Date().toISOString()
    },
    voiceNotice: speech.notice
  };
}

function combineNotices(...notices: Array<string | undefined>) {
  return notices.filter(Boolean).join(" ");
}
