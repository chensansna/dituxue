import { authErrorResponse, requireApiRole } from "@/lib/auth";
import { listStudentSubmissions } from "@/lib/supabase/submission-data";

export async function GET() {
  try {
    const { user } = await requireApiRole(["student"]);
    return Response.json({ submissions: await listStudentSubmissions(user.id) });
  } catch (error) {
    return authErrorResponse(error);
  }
}
