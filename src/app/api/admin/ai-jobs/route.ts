import { NextResponse } from "next/server";
import { readAiJobs } from "@/lib/ai-job-log";

export async function GET() {
  try {
    return NextResponse.json({ jobs: await readAiJobs() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取 AI 调用记录失败" },
      { status: 500 },
    );
  }
}
