import { NextResponse } from "next/server";
import { checkQwenConnection } from "@/lib/qwen";
import { recordAiJob, safeErrorMessage } from "@/lib/ai-job-log";

export async function GET() {
  const startedAt = Date.now();
  try {
    const result = await checkQwenConnection();
    await recordAiJob({ type: "connection_check", status: "completed", model: result.model, durationMs: Date.now() - startedAt, itemCount: 1 });
    return NextResponse.json(result);
  } catch (error) {
    await recordAiJob({ type: "connection_check", status: "failed", model: process.env.QWEN_VISION_MODEL ?? "qwen3-vl-plus", durationMs: Date.now() - startedAt, itemCount: 1, error: safeErrorMessage(error) });
    return NextResponse.json(
      { ok: false, error: safeErrorMessage(error) },
      { status: 502 },
    );
  }
}
