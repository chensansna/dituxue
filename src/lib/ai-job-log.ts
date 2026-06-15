import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export type AiJobLog = {
  id: string;
  type: "connection_check" | "map_review" | "roster_parse" | "batch_review";
  status: "completed" | "failed";
  model: string;
  durationMs: number;
  itemCount: number;
  error?: string;
  createdAt: string;
};

const dataDirectory = path.join(process.cwd(), ".data");
const logPath = path.join(dataDirectory, "qwen-jobs.jsonl");

export async function recordAiJob(job: Omit<AiJobLog, "id" | "createdAt">) {
  const record: AiJobLog = {
    ...job,
    id: `qwen_${job.type}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
  };
  await mkdir(dataDirectory, { recursive: true });
  await appendFile(logPath, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export async function readAiJobs() {
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
