import { demoDiary } from "@/lib/demo-data";
import { ok } from "@/lib/api-response";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  return ok({
    month,
    days: [
      {
        date: demoDiary.date,
        count: 1,
        items: [
          {
            diary_id: demoDiary.id,
            title: demoDiary.title,
            summary: demoDiary.summary,
            cover_image_url: demoDiary.imageUrl,
            created_at: demoDiary.createdAt
          }
        ]
      }
    ]
  });
}
