import { failFromError, ok } from "@/lib/api-response";
import { listCalendar, requireUser } from "@/lib/supabase/data";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    return ok(await listCalendar(user, month));
  } catch (error) {
    return failFromError(error);
  }
}
