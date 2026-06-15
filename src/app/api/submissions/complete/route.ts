import { z } from "zod";
import { authErrorResponse, requireApiRole } from "@/lib/auth";
import { completeSubmission } from "@/lib/supabase/submission-data";

const schema = z.object({
  submissionId: z.string().uuid(),
  versionId: z.string().uuid(),
  originalPath: z.string().min(1),
  previewPath: z.string().nullable().optional(),
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

export async function POST(request: Request) {
  try {
    const { user, profile } = await requireApiRole(["student", "teacher"]);
    return Response.json(await completeSubmission({ id: user.id, role: profile.role }, schema.parse(await request.json())));
  } catch (error) {
    return authErrorResponse(error);
  }
}
