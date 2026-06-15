import { NextResponse } from "next/server";
import { z } from "zod";
import { archiveClass, createClass, listClasses } from "@/lib/supabase/teacher-data";

const createSchema = z.object({
  name: z.string().min(1),
  term: z.string().optional(),
});

export async function GET() {
  try {
    return NextResponse.json({ classes: await listClasses() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load classes." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await createClass(createSchema.parse(await request.json()));
    return NextResponse.json({ ok: true, classes: await listClasses() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create class." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id } = z.object({ id: z.string().uuid() }).parse(await request.json());
    await archiveClass(id);
    return NextResponse.json({ ok: true, classes: await listClasses() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to archive class." }, { status: 400 });
  }
}
