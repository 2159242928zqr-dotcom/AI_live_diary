import { fail, ok } from "@/lib/api-response";
import { generateAssistantReply, transcribeAudio } from "@/lib/ai/assistant";
import { synthesizeAssistantSpeech } from "@/lib/ai/speech";
import type { DiaryMessage } from "@/lib/types";
import { verifyAuth } from "@/lib/auth";
import { handleCors } from "@/lib/cors";

const maxBytes = 25 * 1024 * 1024;
const minBytes = 1200;

export async function OPTIONS(request: Request) {
  return handleCors(request) || new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;

  const form = await request.formData() as any;
  const file = form.get("audio");
  if (!(file instanceof File)) return fail("audio file is required", 400);
  if (file.size < minBytes) return fail("audio is too short", 400);
  if (file.size > maxBytes) return fail("audio is larger than 25MB", 413);

  const historyRaw = form.get("history");
  const history = normalizeHistory(typeof historyRaw === "string" ? parseJson(historyRaw) : null);
  const audio = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "audio/wav";

  try {
    const transcription = await transcribeAudio(audio, mimeType);
    const transcript = transcription.transcript;
    if (!transcript) return fail("audio transcript is empty", 422);

    const userMessage: DiaryMessage = {
      id: crypto.randomUUID(),
      role: "user",
      inputType: "voice",
      transcript,
      audioMimeType: mimeType,
      createdAt: new Date().toISOString()
    };
    const reply = await generateAssistantReply([...history, { role: "user", text: transcript }]);
    const assistantTranscript = reply.transcript;
    const { assistantMessage, voiceNotice } = await buildAssistantMessage(assistantTranscript);

    return ok({
      user_message: userMessage,
      assistant_message: assistantMessage,
      voice_notice: combineNotices(transcription.notice, reply.notice, voiceNotice)
    });
  } catch (error) {
    return fail("AI voice reply failed", 502, error instanceof Error ? error.message : "unknown error");
  }
}

function parseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
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
