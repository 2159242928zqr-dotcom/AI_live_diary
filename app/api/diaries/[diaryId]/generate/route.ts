import { failFromError, ok } from "@/lib/api-response";
import { generateDiary, requireUser } from "@/lib/supabase/data";

export async function POST(request: Request, { params }: { params: Promise<{ diaryId: string }> }) {
  try {
    const user = await requireUser(request);
    const { diaryId } = await params;
    return ok(await generateDiary(user, diaryId));
  } catch (error) {
    return failFromError(error);
  }
}
