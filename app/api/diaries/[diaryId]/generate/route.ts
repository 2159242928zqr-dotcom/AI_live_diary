import { ok } from "@/lib/api-response";

export async function POST(_request: Request, { params }: { params: Promise<{ diaryId: string }> }) {
  const { diaryId } = await params;
  return ok({
    diary_id: diaryId,
    status: "generated"
  });
}
