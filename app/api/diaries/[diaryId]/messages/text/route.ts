import { failFromError, ok } from "@/lib/api-response";
import { addTextMessage, requireUser } from "@/lib/supabase/data";

export async function POST(request: Request, { params }: { params: Promise<{ diaryId: string }> }) {
  try {
    const user = await requireUser(request);
    const { diaryId } = await params;
    const body = await request.json().catch(() => null);
    return ok(await addTextMessage(user, diaryId, typeof body?.content === "string" ? body.content : ""));
  } catch (error) {
    return failFromError(error);
  }
}
