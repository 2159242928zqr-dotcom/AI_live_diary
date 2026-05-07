import { fail, ok } from "@/lib/api-response";

const maxBytes = 25 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("audio");
  if (!(file instanceof File)) return fail("audio file is required", 400);
  if (file.size > maxBytes) return fail("audio is larger than 25MB", 413);
  return ok({
    user_audio_id: crypto.randomUUID(),
    user_message_id: crypto.randomUUID(),
    assistant_audio_id: crypto.randomUUID(),
    assistant_message_id: crypto.randomUUID(),
    assistant_audio_url: ""
  });
}
