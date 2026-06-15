import { NextResponse } from "next/server";
import { authErrorResponse, requireApiRole } from "@/lib/auth";
import { readAiJobs } from "@/lib/ai-job-log";

export async function GET() {
  try {
    await requireApiRole(["admin"]);
    return NextResponse.json({ jobs: await readAiJobs() });
  } catch (error) {
    return authErrorResponse(error);
  }
}
