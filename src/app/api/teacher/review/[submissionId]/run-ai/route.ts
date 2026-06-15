import { z } from "zod";
import { authErrorResponse, requireApiRole } from "@/lib/auth";
import { runTeacherAiReview } from "@/lib/supabase/submission-data";

export async function POST(_: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  try {
    const { user } = await requireApiRole(["teacher"]);
    const { submissionId } = z.object({ submissionId: z.string().uuid() }).parse(await params);
    return Response.json(await runTeacherAiReview(user.id, submissionId));
  } catch (error) {
    return authErrorResponse(error);
  }
}
