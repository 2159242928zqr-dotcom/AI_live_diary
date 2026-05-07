import { ok } from "@/lib/api-response";

export async function POST() {
  return ok({
    diary_id: crypto.randomUUID(),
    status: "draft",
    next: "Configure Supabase to persist this draft."
  });
}
