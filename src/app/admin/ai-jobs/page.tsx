import { AiJobsDashboard } from "@/components/ai-jobs-dashboard";
import { AppShell } from "@/components/app-shell";

export default function Page() {
  return <AppShell role="admin" title="AI 调用记录" subtitle="Qwen 任务状态、耗时与错误"><AiJobsDashboard /></AppShell>;
}
