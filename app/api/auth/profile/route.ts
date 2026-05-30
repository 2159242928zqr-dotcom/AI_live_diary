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
  const authUserId = auth.userId;

  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const inviteCode = typeof body?.inviteCode === "string" ? body.inviteCode.trim() : "";
  const usedInviteCode = typeof body?.usedInviteCode === "string" ? body.usedInviteCode.trim() : "";

  if (userId !== authUserId) {
    return fail("forbidden", 403);
  }

  if (!userId || !email || !inviteCode) return fail("userId, email and inviteCode are required", 400);

  try {
    const supabase = getSupabaseAdmin();
    const { data: existing, error: selectError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (selectError) throw selectError;

    if (existing?.id) {
      const { error } = await supabase
        .from("profiles")
        .update({ qq_email: email, invite_code: inviteCode, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("profiles").insert({
        user_id: userId,
        qq_email: email,
        invite_code: inviteCode
      });
      if (error) throw error;
    }

    if (usedInviteCode) {
      const { data: inviter } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("invite_code", usedInviteCode)
        .maybeSingle();
      if (inviter?.user_id && inviter.user_id !== userId) {
        await supabase.from("referrals").insert({
          inviter_user_id: inviter.user_id,
          invitee_user_id: userId,
          invite_code: usedInviteCode
        });
      }
    }

    return ok({ success: true });
  } catch (error) {
    return fail("profile sync failed", 500, error instanceof Error ? error.message : "unknown error");
  }
}
