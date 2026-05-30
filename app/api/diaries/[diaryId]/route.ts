import { demoDiary } from "@/lib/demo-data";
import { fail, ok } from "@/lib/api-response";
import { decryptText } from "@/lib/crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { DiarySummary } from "@/lib/types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ diaryId: string }> }) {
  const { diaryId } = await params;
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") ?? "";
  const databaseId = toDatabaseId(diaryId);

  if (userId && databaseId) {
    if (!uuidPattern.test(userId)) return fail("valid userId is required", 400);
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("diaries")
        .select("id, diary_date, title_encrypted, summary_encrypted, content_encrypted, created_at")
        .eq("id", databaseId)
        .eq("user_id", userId)
        .neq("status", "deleted")
        .maybeSingle();
      if (error) throw error;
      const diary = data ? readDiary(data as CloudDiaryRow) : null;
      if (diary) return ok(diary);
    } catch (error) {
      return fail("diary load failed", 500, error instanceof Error ? error.message : "unknown error");
    }
  }

  return ok(demoDiary);
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.title || !body?.summary || !body?.content) {
    return fail("title, summary and content are required", 400);
  }
  return ok({ success: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ diaryId: string }> }) {
  const { diaryId } = await params;
  const databaseId = toDatabaseId(diaryId);
  if (!databaseId) return fail("invalid diary id", 400);

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") ?? "";
  if (!uuidPattern.test(userId)) return fail("valid userId is required", 400);

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("diaries").delete().eq("id", databaseId).eq("user_id", userId);
    if (error) throw error;
    return ok({ success: true });
  } catch (error) {
    return fail("diary delete failed", 500, error instanceof Error ? error.message : "unknown error");
  }
}

type CloudDiaryRow = {
  id: string;
  diary_date: string;
  title_encrypted?: string | null;
  summary_encrypted?: string | null;
  content_encrypted?: string | null;
  created_at: string;
};

function readDiary(row: CloudDiaryRow): DiarySummary | null {
  if (row.content_encrypted) {
    try {
      return JSON.parse(decryptText(row.content_encrypted)) as DiarySummary;
    } catch (error) {
      console.error(`[diary-detail] Failed to decrypt content for diary ${row.id}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  try {
    return {
      id: `diary-${row.id}`,
      title: row.title_encrypted ? decryptText(row.title_encrypted) : "未命名日记",
      summary: row.summary_encrypted ? decryptText(row.summary_encrypted) : "",
      content: "",
      date: row.diary_date,
      createdAt: row.created_at,
      status: "generated",
      messages: []
    };
  } catch (error) {
    console.error(`[diary-detail] Failed to decrypt title/summary for diary ${row.id}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

function toDatabaseId(value: string) {
  if (uuidPattern.test(value)) return value;
  const match = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return match?.[0] ?? null;
}
