import { authErrorResponse, requireApiRole } from "@/lib/auth";
import { listTeacherReviewQueue } from "@/lib/supabase/submission-data";

export async function GET() {
  try {
    const { user } = await requireApiRole(["teacher"]);
    return Response.json({ submissions: await listTeacherReviewQueue(user.id) });
  } catch (error) {
    return authErrorResponse(error);
  }
}
