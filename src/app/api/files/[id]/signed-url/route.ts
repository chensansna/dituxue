import { z } from "zod";
import { authErrorResponse, requireApiRole } from "@/lib/auth";
import { createFileSignedUrl } from "@/lib/supabase/submission-data";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, profile } = await requireApiRole(["student", "teacher", "admin"]);
    const { id } = z.object({ id: z.string().uuid() }).parse(await params);
    const preferPreview = new URL(request.url).searchParams.get("preview") === "1";
    return Response.json(await createFileSignedUrl({ id: user.id, role: profile.role }, id, preferPreview));
  } catch (error) {
    return authErrorResponse(error);
  }
}
