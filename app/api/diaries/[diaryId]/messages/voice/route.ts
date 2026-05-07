import { fail, failFromError, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/supabase/data";

const maxBytes = 25 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    await requireUser(request);
    const form = await request.formData();
    const file = form.get("audio");
    if (!(file instanceof File)) return fail("audio file is required", 400);
    if (file.size > maxBytes) return fail("audio is larger than 25MB", 413);
    return fail("语音持久化将在下一阶段接入，请先使用文字输入。", 501);
  } catch (error) {
    return failFromError(error);
  }
}
