import { NextResponse } from "next/server";
import { authErrorResponse, requireApiRole } from "@/lib/auth";
import { listStatistics } from "@/lib/supabase/teacher-data";

export async function GET() {
  try {
    const { user } = await requireApiRole(["teacher"]);
    return NextResponse.json(await listStatistics(user.id));
  } catch (error) {
    return authErrorResponse(error);
  }
}
