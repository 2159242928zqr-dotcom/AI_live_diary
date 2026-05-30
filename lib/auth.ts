import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

export async function verifyAuth(request: Request): Promise<
  { userId: string; error: null } | { userId: null; error: Response }
> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { userId: null, error: Response.json({ error: "未授权" }, { status: 401 }) };
  }

  const token = authHeader.slice(7);
  const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { userId: null, error: Response.json({ error: "令牌无效" }, { status: 401 }) };
  }

  return { userId: user.id, error: null };
}
