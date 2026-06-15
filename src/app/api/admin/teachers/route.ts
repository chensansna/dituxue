import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireApiRole } from "@/lib/auth";
import { createTeacher, disableTeacher, listTeachers } from "@/lib/supabase/admin-users";

const createSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
});

export async function GET() {
  try {
    await requireApiRole(["admin"]);
    return NextResponse.json({ teachers: await listTeachers() });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireApiRole(["admin"]);
    const credential = await createTeacher(createSchema.parse(await request.json()));
    return NextResponse.json({ ok: true, credential, teachers: await listTeachers() });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireApiRole(["admin"]);
    const { id } = z.object({ id: z.string().uuid() }).parse(await request.json());
    await disableTeacher(id);
    return NextResponse.json({ ok: true, teachers: await listTeachers() });
  } catch (error) {
    return authErrorResponse(error);
  }
}
