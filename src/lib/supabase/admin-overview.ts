import { createSupabaseAdminClient } from "./admin";

export type AdminOverviewJob = {
  id: string;
  type: string;
  owner: string;
  count: string;
  duration: string;
  state: string;
};

export type AdminOverviewData = {
  teacherCount: number;
  studentCount: number;
  classCount: number;
  todayAiCount: number;
  todayAiSuccessRate: string;
  storageUsage: string;
  recentJobs: AdminOverviewJob[];
};

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}

function formatDuration(value: number | null) {
  if (value === null) return "处理中";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} 秒`;
}

function jobTypeName(kind: string) {
  if (kind === "map_review") return "地图形式审查";
  if (kind === "roster_parse") return "名单识别";
  if (kind === "connection_check") return "Qwen 连接检查";
  return kind;
}

function jobStateName(status: string) {
  if (status === "completed") return "已完成";
  if (status === "failed") return "失败";
  if (status === "partial") return "部分完成";
  if (status === "processing") return "处理中";
  return "排队中";
}

export async function getAdminOverview(): Promise<AdminOverviewData> {
  const admin = createSupabaseAdminClient();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [teachers, students, classes, todayJobs, files, recentJobs] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "teacher").is("disabled_at", null),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student").is("disabled_at", null),
    admin.from("classes").select("id", { count: "exact", head: true }).is("deleted_at", null),
    admin.from("ai_jobs").select("status").gte("created_at", startOfToday.toISOString()),
    admin.from("files").select("size_bytes"),
    admin
      .from("ai_jobs")
      .select("id,kind,status,item_count,completed_count,duration_ms,profiles!ai_jobs_requested_by_fkey(display_name)")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  for (const result of [teachers, students, classes, todayJobs, files, recentJobs]) {
    if (result.error) throw result.error;
  }

  const successfulToday = (todayJobs.data ?? []).filter((job) => job.status === "completed").length;
  const todayCount = todayJobs.data?.length ?? 0;
  const storageBytes = (files.data ?? []).reduce((sum, file) => sum + Number(file.size_bytes ?? 0), 0);

  return {
    teacherCount: teachers.count ?? 0,
    studentCount: students.count ?? 0,
    classCount: classes.count ?? 0,
    todayAiCount: todayCount,
    todayAiSuccessRate: todayCount ? `${(successfulToday / todayCount * 100).toFixed(1)}%` : "暂无调用",
    storageUsage: formatBytes(storageBytes),
    recentJobs: (recentJobs.data ?? []).map((job) => {
      const profile = Array.isArray(job.profiles) ? job.profiles[0] : job.profiles;
      return {
        id: job.id,
        type: jobTypeName(job.kind),
        owner: profile?.display_name ?? "系统",
        count: `${job.completed_count} / ${job.item_count}`,
        duration: formatDuration(job.duration_ms),
        state: jobStateName(job.status),
      };
    }),
  };
}
