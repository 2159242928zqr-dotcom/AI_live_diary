import { fail, ok } from "@/lib/api-response";
import { generateOpeningFromImage } from "@/lib/ai/assistant";
import { synthesizeAssistantSpeech } from "@/lib/ai/speech";
import type { DiaryMessage } from "@/lib/types";
import { verifyAuth } from "@/lib/auth";
import { handleCors } from "@/lib/cors";

export async function OPTIONS(request: Request) {
  return handleCors(request) || new Response(null, { status: 204 });
}

export async function POST(request: Request, { params }: { params: Promise<{ diaryId: string }> }) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;

  const { diaryId } = await params;
  const body = await request.json().catch(() => null);
  const imageDataUrl = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : "";
  const parsed = parseImageDataUrl(imageDataUrl);

  if (!parsed) return fail("valid imageDataUrl is required", 400);

  try {
    const opening = await generateOpeningFromImage(parsed.bytes, parsed.mimeType);
    const transcript = opening.transcript;
    const { assistantMessage, voiceNotice } = await buildAssistantMessage(transcript);
    return ok({
      diary_id: diaryId,
      status: "chatting",
      assistant_message: assistantMessage,
      voice_notice: combineNotices(opening.notice, voiceNotice)
    });
  } catch (error) {
    return fail("AI opening voice failed", 502, error instanceof Error ? error.message : "unknown error");
  }
}

function parseImageDataUrl(value: string) {
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    bytes: Buffer.from(match[2], "base64")
  };
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
