import { fail, ok } from "@/lib/api-response";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) return fail("content is required", 400);
  return ok({
    user_message_id: crypto.randomUUID(),
    assistant_message_id: crypto.randomUUID(),
    assistant_audio_url: "",
    assistant_transcript_saved: true
  });
}
