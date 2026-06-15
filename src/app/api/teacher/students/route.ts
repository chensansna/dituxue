import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireApiRole } from "@/lib/auth";
import { addStudent, disableStudent, listStudents } from "@/lib/supabase/teacher-data";

const studentSchema = z.object({
  classId: z.string().uuid(),
  studentNo: z.string().min(1),
  name: z.string().min(1),
});

export async function GET() {
  try {
    const { user } = await requireApiRole(["teacher"]);
    return NextResponse.json({ students: await listStudents(user.id) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireApiRole(["teacher"]);
    const body = await request.json();
    const students = z.array(studentSchema).min(1).max(200).parse(Array.isArray(body) ? body : [body]);
    const credentials = [];
    for (const student of students) {
      credentials.push(await addStudent(user.id, student));
    }
    return NextResponse.json({ ok: true, credentials, students: await listStudents(user.id) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireApiRole(["teacher"]);
    const { id } = z.object({ id: z.string().uuid() }).parse(await request.json());
    await disableStudent(user.id, id);
    return NextResponse.json({ ok: true, students: await listStudents(user.id) });
  } catch (error) {
    return authErrorResponse(error);
  }
}
