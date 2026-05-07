import { failFromError, ok } from "@/lib/api-response";
import { ensureProfile, getProfile, requireUser, updateProfileTags } from "@/lib/supabase/data";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return ok(await getProfile(user));
  } catch (error) {
    return failFromError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => null);
    await ensureProfile(user, body?.inviteCode);
    return ok(await getProfile(user));
  } catch (error) {
    return failFromError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => null);
    return ok(await updateProfileTags(user, body?.eventTags ?? [], body?.moodTags ?? []));
  } catch (error) {
    return failFromError(error);
  }
}
