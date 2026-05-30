import { textToSpeech } from "@/lib/ai/glm";
import { verifyAuth } from "@/lib/auth";
import { corsHeaders, handleCors } from "@/lib/cors";

export async function OPTIONS(request: Request) {
  return handleCors(request) || new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return new Response(JSON.stringify({ error: "text is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const speech = await textToSpeech(text);
    return new Response(speech.audio, {
      headers: {
        ...corsHeaders,
        "Content-Type": speech.mimeType || "audio/wav",
        "Content-Disposition": "attachment; filename=tts-debug.wav"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
