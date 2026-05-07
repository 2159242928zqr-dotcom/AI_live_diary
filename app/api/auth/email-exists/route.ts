import { fail, ok } from "@/lib/api-response";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { qqEmailIsValid } from "@/lib/utils";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!qqEmailIsValid(email)) return fail("请输入合法的 QQ 邮箱，例如 123456@qq.com", 400);

  const supabase = getSupabaseAdmin();
  let page = 1;
  const perPage = 1000;

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) return fail("检查邮箱失败，请稍后再试。", 500, error.message);
    const users = data.users ?? [];
    if (users.some((user) => user.email?.toLowerCase() === email)) {
      return ok({ exists: true });
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return ok({ exists: false });
}
