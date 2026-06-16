import { NextResponse } from "next/server";
import { checkQwenConnection } from "@/lib/qwen";
import { recordAiJob, safeErrorMessage } from "@/lib/ai-job-log";
import { authErrorResponse, HttpError, requireApiRole } from "@/lib/auth";

export async function GET() {
  const startedAt = Date.now();
  try {
    const session = await requireApiRole(["admin"]);
    const result = await checkQwenConnection();
    await recordAiJob({ type: "connection_check", status: "completed", model: result.model, durationMs: Date.now() - startedAt, itemCount: 1, requestedBy: session.user.id });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof HttpError) {
      return authErrorResponse(error);
    }
    await recordAiJob({ type: "connection_check", status: "failed", model: process.env.QWEN_VISION_MODEL ?? "qwen3-vl-plus", durationMs: Date.now() - startedAt, itemCount: 1, error: safeErrorMessage(error) });
    return NextResponse.json(
      { ok: false, error: safeErrorMessage(error) },
      { status: 502 },
    );
  }
}
