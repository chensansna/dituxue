import { NextResponse } from "next/server";
import { z } from "zod";
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
    return NextResponse.json({ assignments: await listAssignments() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load assignments." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await createAssignment(assignmentSchema.parse(await request.json()));
    return NextResponse.json({ ok: true, assignments: await listAssignments() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create assignment." }, { status: 400 });
  }
}
