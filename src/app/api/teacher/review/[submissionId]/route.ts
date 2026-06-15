import { z } from "zod";
import { authErrorResponse, requireApiRole } from "@/lib/auth";
import { getTeacherReviewDetail } from "@/lib/supabase/submission-data";

export async function GET(_: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  try {
    const { user } = await requireApiRole(["teacher"]);
    const { submissionId } = z.object({ submissionId: z.string().uuid() }).parse(await params);
    return Response.json(await getTeacherReviewDetail(user.id, submissionId));
  } catch (error) {
    return authErrorResponse(error);
  }
}
