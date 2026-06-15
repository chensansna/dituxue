import { authErrorResponse, requireApiRole } from "@/lib/auth";
import { listStudentAssignments } from "@/lib/supabase/submission-data";

export async function GET() {
  try {
    const { user } = await requireApiRole(["student"]);
    return Response.json({ assignments: await listStudentAssignments(user.id) });
  } catch (error) {
    return authErrorResponse(error);
  }
}
