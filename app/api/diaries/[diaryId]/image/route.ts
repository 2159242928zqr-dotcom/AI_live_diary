import { fail, ok } from "@/lib/api-response";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 10 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ diaryId: string }> }) {
  const { diaryId } = await params;
  const form = await request.formData() as any;
  const file = form.get("image");
  if (!(file instanceof File)) return fail("image file is required", 400);
  if (!allowed.has(file.type)) return fail("unsupported image type", 415);
  if (file.size > maxBytes) return fail("image is larger than 10MB", 413);
  return ok({
    diary_id: diaryId,
    image_id: crypto.randomUUID(),
    status: "image_uploaded"
  });
}
