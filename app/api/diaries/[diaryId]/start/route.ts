import { failFromError, ok } from "@/lib/api-response";
import { requireUser, startDiary } from "@/lib/supabase/data";

export async function POST(request: Request, { params }: { params: Promise<{ diaryId: string }> }) {
  try {
    const user = await requireUser(request);
    const { diaryId } = await params;
    return ok(await startDiary(user, diaryId));
  } catch (error) {
    return failFromError(error);
  }
}
