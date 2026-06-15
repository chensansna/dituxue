import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireApiRole } from "@/lib/auth";
import { createAssignment, listAssignments } from "@/lib/supabase/teacher-data";

const assignmentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  classIds: z.array(z.string().uuid()).min(1),
  status: z.enum(["draft", "published"]).default("published"),
  deadline: z.string().datetime().nullable().optional(),
});

export async function GET() {
  try {
    const { user } = await requireApiRole(["teacher"]);
    return NextResponse.json({ assignments: await listAssignments(user.id) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireApiRole(["teacher"]);
    await createAssignment({ teacherId: user.id, ...assignmentSchema.parse(await request.json()) });
    return NextResponse.json({ ok: true, assignments: await listAssignments(user.id) });
  } catch (error) {
    return authErrorResponse(error);
  }
}
