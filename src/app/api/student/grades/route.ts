import { authErrorResponse, requireApiRole } from "@/lib/auth";
import { listPublishedGrades } from "@/lib/supabase/submission-data";

export async function GET() {
  try {
    const { user } = await requireApiRole(["student"]);
    return Response.json({ grades: await listPublishedGrades(user.id) });
  } catch (error) {
    return authErrorResponse(error);
  }
}
