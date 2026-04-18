import { submitGuestReview } from "@/lib/staff-backend/guest";
import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: { tableId: string };
};

export async function POST(request: Request, { params }: Params) {
  try {
    const body = (await request.json()) as { rating?: number; comment?: string };
    const rating = Number(body.rating ?? 0);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return noStoreJson({ error: "Оценка должна быть от 1 до 5" }, 400);
    }

    const review = await submitGuestReview({
      tableId: Number(params.tableId),
      rating,
      comment: body.comment,
    });

    return noStoreJson({ review });
  } catch (error) {
    return toErrorResponse(error);
  }
}
