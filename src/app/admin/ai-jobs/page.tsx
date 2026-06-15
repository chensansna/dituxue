import { AiJobsDashboard } from "@/components/ai-jobs-dashboard";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  const { profile } = await requireRole(["admin"], "/admin/ai-jobs");

  return (
    <AppShell role="admin" title="AI 调用记录" subtitle="Qwen 任务状态、耗时与脱敏错误" userName={profile.display_name}>
      <AiJobsDashboard />
    </AppShell>
  );
}
