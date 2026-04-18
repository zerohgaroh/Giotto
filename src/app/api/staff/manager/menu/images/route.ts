import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { saveManagerMenuImage } from "@/lib/staff-backend/menu-images";
import { requireManagerSession } from "@/lib/staff-backend/request-auth";
import { ApiError } from "@/lib/staff-backend/projections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireManagerSession(request);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "Image file is required");
    }

    return noStoreJson(await saveManagerMenuImage(file, request));
  } catch (error) {
    return toErrorResponse(error);
  }
}
