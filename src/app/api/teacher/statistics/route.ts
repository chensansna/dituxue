import { NextResponse } from "next/server";
import { listStatistics } from "@/lib/supabase/teacher-data";

export async function GET() {
  try {
    return NextResponse.json(await listStatistics());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load statistics." }, { status: 500 });
  }
}
