import { NextResponse } from "next/server";
import { z } from "zod";
import { addStudent, disableStudent, listStudents } from "@/lib/supabase/teacher-data";

const studentSchema = z.object({
  classId: z.string().uuid(),
  studentNo: z.string().min(1),
  name: z.string().min(1),
});

export async function GET() {
  try {
    return NextResponse.json({ students: await listStudents() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load students." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const students = z.array(studentSchema).min(1).max(200).parse(Array.isArray(body) ? body : [body]);
    const credentials = [];
    for (const student of students) {
      credentials.push(await addStudent(student));
    }
    return NextResponse.json({ ok: true, credentials, students: await listStudents() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to add student." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id } = z.object({ id: z.string().uuid() }).parse(await request.json());
    await disableStudent(id);
    return NextResponse.json({ ok: true, students: await listStudents() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to disable student." }, { status: 400 });
  }
}
