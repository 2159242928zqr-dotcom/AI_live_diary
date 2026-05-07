import { demoDiary } from "@/lib/demo-data";
import { fail, ok } from "@/lib/api-response";

export async function GET() {
  return ok(demoDiary);
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.title || !body?.summary || !body?.content) {
    return fail("title, summary and content are required", 400);
  }
  return ok({ success: true });
}

export async function DELETE() {
  return ok({ success: true });
}
