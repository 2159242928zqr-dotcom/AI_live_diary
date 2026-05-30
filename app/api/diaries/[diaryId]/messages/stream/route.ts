import { fail } from "@/lib/api-response";
import { generateAssistantReply } from "@/lib/ai/assistant";
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
  const history = Array.isArray(body?.history) ? body.history : [];

  if (history.length === 0) {
    return fail("history is required", 400);
  }

  try {
    // 1. Generate standard reply
    const reply = await generateAssistantReply(history);
    const transcript = reply.transcript;

    // 2. Sentence splitter for progressive streaming
    const sentences = splitIntoSentences(transcript);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (const sentence of sentences) {
            const trimmed = sentence.trim();
            if (!trimmed) continue;
            
            // Synthesize TTS for each sentence progressively
            const speech = await textToSpeech(trimmed);
            const base64Audio = speech.audio.toString("base64");

            const chunk = JSON.stringify({
              type: "audio",
              text: trimmed,
              data: base64Audio,
            }) + "\n";
            
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (err) {
          console.error("流式合成出错:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    return fail("AI streaming reply failed", 502, error instanceof Error ? error.message : "unknown error");
  }
}

function splitIntoSentences(text: string): string[] {
  // Split on Chinese and English sentence delimiters
  const list = text.split(/([。！？；…\n])/g);
  const result: string[] = [];
  let temp = "";
  
  for (const item of list) {
    if (item === "。" || item === "！" || item === "？" || item === "；" || item === "…" || item === "\n") {
      temp += item;
      result.push(temp.trim());
      temp = "";
    } else {
      temp += item;
    }
  }
  if (temp.trim()) {
    result.push(temp.trim());
  }
  return result.filter(Boolean);
}
