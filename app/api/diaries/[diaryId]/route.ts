import { failFromError, ok } from "@/lib/api-response";
import { getDiary, requireUser, softDeleteDiary, updateDiary } from "@/lib/supabase/data";

export async function GET(request: Request, { params }: { params: Promise<{ diaryId: string }> }) {
  try {
    const user = await requireUser(request);
    const { diaryId } = await params;
    return ok(await getDiary(user, diaryId));
  } catch (error) {
    return failFromError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ diaryId: string }> }) {
  try {
    const user = await requireUser(request);
    const { diaryId } = await params;
    const body = await request.json().catch(() => null);
    return ok(await updateDiary(user, diaryId, body));
  } catch (error) {
    return failFromError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ diaryId: string }> }) {
  try {
    const user = await requireUser(request);
    const { diaryId } = await params;
    return ok(await softDeleteDiary(user, diaryId));
  } catch (error) {
    return failFromError(error);
  }
}
