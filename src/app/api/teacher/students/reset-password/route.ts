import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireApiRole } from "@/lib/auth";
import { resetStudentPassword } from "@/lib/supabase/teacher-data";

const schema = z.object({
  studentId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const { user } = await requireApiRole(["teacher"]);
    const { studentId } = schema.parse(await request.json());
    const credential = await resetStudentPassword(user.id, studentId);
    return NextResponse.json({ ok: true, credential });
  } catch (error) {
    return authErrorResponse(error);
  }
}
