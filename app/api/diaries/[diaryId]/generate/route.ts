import { fail, ok } from "@/lib/api-response";
import { generateSummary } from "@/lib/ai/assistant";
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
  const messages: Array<{ role: "user" | "assistant"; text: string }> = Array.isArray(body?.messages) ? body.messages : [];

  if (messages.length === 0) return fail("messages are required", 400);

  try {
    const summary = await generateSummary(messages);
    return ok({ summary });
  } catch (error) {
    return fail("AI summary generation failed", 502, error instanceof Error ? error.message : "unknown error");
  }
}
