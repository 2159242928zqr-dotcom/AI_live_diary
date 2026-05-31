import { fail, ok } from "@/lib/api-response";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { verifyAuth } from "@/lib/auth";
import { handleCors } from "@/lib/cors";

export async function OPTIONS(request: Request) {
  return handleCors(request) || new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.userId;

  const body = await request.json().catch(() => null);
  const inviteCode = typeof body?.inviteCode === "string" ? body.inviteCode.trim().toUpperCase() : "";

  const supabase = getSupabaseAdmin();

  // CASE 1: 绑定邀请码 (如果提供了 inviteCode)
  if (inviteCode) {
    try {
      // 1. 检测此邀请码是否存在，并获取邀请人
      const { data: inviter, error: inviterError } = await supabase
        .from("profiles")
        .select("user_id, qq_email")
        .eq("invite_code", inviteCode)
        .maybeSingle();

      if (inviterError) throw inviterError;
      if (!inviter) {
        return fail("该专属邀请码不存在，请核对后重试", 404);
      }

      if (inviter.user_id === userId) {
        return fail("不能填写您自己的邀请码", 400);
      }

      // 2. 检查用户当前是否已经绑定了邀请人 (固定一次，不可更改)
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, invited_by_user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileError) throw profileError;
      if (profile?.invited_by_user_id) {
        return fail("您已经绑定过邀请人，无法重复绑定", 400);
      }

      // 3. 更新用户的 profiles，设置被谁邀请
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ invited_by_user_id: inviter.user_id, updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      // 4. 将绑定记录插入 referrals 表
      await supabase.from("referrals").insert({
        inviter_user_id: inviter.user_id,
        invitee_user_id: userId,
        invite_code: inviteCode,
      });

      return ok({
        success: true,
        invited_by: inviter.qq_email,
      });
    } catch (error) {
      return fail("绑定邀请人失败", 500, error instanceof Error ? error.message : "未知错误");
    }
  }

  // CASE 2: 查询邀请系统状态 (如果 inviteCode 为空，统一使用 POST 轮询以契合前端 apiPost 方法)
  try {
    // 1. 获取当前用户 profile，以获取我被谁邀请和我的邀请码
    const { data: profile, error: selectError } = await supabase
      .from("profiles")
      .select("invite_code, invited_by_user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (selectError) throw selectError;

    let invitedByEmail: string | null = null;
    if (profile?.invited_by_user_id) {
      // 2. 如果存在邀请人，获取邀请人的 QQ 邮箱
      const { data: inviter } = await supabase
        .from("profiles")
        .select("qq_email")
        .eq("user_id", profile.invited_by_user_id)
        .maybeSingle();
      
      invitedByEmail = inviter?.qq_email || "未知账户";
    }

    // 3. 获取我邀请的人的列表 (被邀请人 profiles 中，invited_by_user_id 为我的 user_id)
    const { data: invitees, error: inviteesError } = await supabase
      .from("profiles")
      .select("qq_email, created_at")
      .eq("invited_by_user_id", userId);

    if (inviteesError) throw inviteesError;

    return ok({
      my_invite_code: profile?.invite_code || `gk-${userId.slice(0, 6).toUpperCase()}`,
      invited_by: invitedByEmail,
      invited_people: (invitees || []).map((i) => ({
        email: i.qq_email,
        createdAt: i.created_at,
      })),
    });
  } catch (error) {
    return fail("获取邀请数据失败", 500, error instanceof Error ? error.message : "未知错误");
  }
}
