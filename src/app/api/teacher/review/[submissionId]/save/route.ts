import { z } from "zod";
import { authErrorResponse, requireApiRole } from "@/lib/auth";
import { saveTeacherReview } from "@/lib/supabase/submission-data";

const schema = z.object({
  action: z.enum(["draft", "returned", "reviewed", "graded"]),
  score: z.number().min(0).max(100).nullable().optional(),
  feedback: z.string().max(5000).default(""),
  returnedReason: z.string().max(5000).optional(),
  items: z.array(z.object({
    rubricId: z.string(),
    present: z.boolean(),
    evidence: z.string(),
  })),
});

export async function POST(request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  try {
    const { user } = await requireApiRole(["teacher"]);
    const { submissionId } = z.object({ submissionId: z.string().uuid() }).parse(await params);
    return Response.json(await saveTeacherReview(user.id, submissionId, schema.parse(await request.json())));
  } catch (error) {
    return authErrorResponse(error);
  }
}
