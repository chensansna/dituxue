import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireApiRole } from "@/lib/auth";
import { archiveClass, createClass, listClasses } from "@/lib/supabase/teacher-data";

const createSchema = z.object({
  name: z.string().min(1),
  term: z.string().optional(),
});

export async function GET() {
  try {
    const { user } = await requireApiRole(["teacher"]);
    return NextResponse.json({ classes: await listClasses(user.id) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireApiRole(["teacher"]);
    await createClass(user.id, createSchema.parse(await request.json()));
    return NextResponse.json({ ok: true, classes: await listClasses(user.id) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireApiRole(["teacher"]);
    const { id } = z.object({ id: z.string().uuid() }).parse(await request.json());
    await archiveClass(user.id, id);
    return NextResponse.json({ ok: true, classes: await listClasses(user.id) });
  } catch (error) {
    return authErrorResponse(error);
  }
}
