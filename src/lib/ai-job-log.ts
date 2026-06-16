import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createSupabaseAdminClient } from "./supabase/admin";

export type AiJobLog = {
  id: string;
  type: "connection_check" | "map_review" | "roster_parse" | "batch_review";
  status: "queued" | "processing" | "completed" | "failed" | "partial";
  model: string;
  durationMs: number;
  itemCount: number;
  completedCount?: number;
  requestedBy?: string | null;
  error?: string;
  createdAt: string;
};

const dataDirectory = path.join(process.cwd(), ".data");
const logPath = path.join(dataDirectory, "qwen-jobs.jsonl");

export async function recordAiJob(job: Omit<AiJobLog, "id" | "createdAt">) {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("ai_jobs").insert({
      kind: job.type,
      model: job.model,
      status: job.status,
      requested_by: job.requestedBy ?? null,
      item_count: job.itemCount,
      completed_count: job.completedCount ?? (job.status === "completed" ? job.itemCount : 0),
      duration_ms: job.durationMs,
      error_message: job.error ?? null,
    });
    if (!error) return;
    console.warn("Supabase AI job logging failed, falling back to local log", error.message);
  } catch (error) {
    console.warn("Supabase AI job logging unavailable, falling back to local log", safeErrorMessage(error));
  }

  const record: AiJobLog = {
    ...job,
    id: `qwen_${job.type}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
  };
  try {
    await mkdir(dataDirectory, { recursive: true });
    await appendFile(logPath, `${JSON.stringify(record)}\n`, "utf8");
  } catch (error) {
    console.warn("Local AI job logging failed", safeErrorMessage(error));
  }
  return record;
}

export async function readAiJobs() {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("ai_jobs")
      .select("id,kind,status,model,item_count,completed_count,duration_ms,error_message,requested_by,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []).map((job) => ({
      id: job.id,
      type: job.kind as AiJobLog["type"],
      status: job.status as AiJobLog["status"],
      model: job.model,
      durationMs: Number(job.duration_ms ?? 0),
      itemCount: Number(job.item_count ?? 1),
      completedCount: Number(job.completed_count ?? 0),
      requestedBy: job.requested_by,
      error: job.error_message ?? undefined,
      createdAt: job.created_at,
    }));
  } catch (error) {
    console.warn("Supabase AI job reading unavailable, falling back to local log", safeErrorMessage(error));
  }

  try {
    const content = await readFile(logPath, "utf8");
    return content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AiJobLog)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "未知错误";
  return message.replace(/sk-[A-Za-z0-9._-]+/g, "[REDACTED]").slice(0, 500);
}
