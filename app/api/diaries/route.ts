import { failFromError, ok } from "@/lib/api-response";
import { createDraftDiary, listRecentDiaries, requireUser } from "@/lib/supabase/data";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "12");
    return ok({ items: await listRecentDiaries(user, Number.isFinite(limit) ? limit : 12) });
  } catch (error) {
    return failFromError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => null);
    return ok(await createDraftDiary(user, body));
  } catch (error) {
    return failFromError(error);
  }
}
