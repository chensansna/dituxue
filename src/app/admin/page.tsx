import { AdminDashboard } from "@/components/admin-dashboard";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  const { profile } = await requireRole(["admin"], "/admin");

  return (
    <AppShell role="admin" title="系统运行概览" subtitle="服务状态与账号管理" userName={profile.display_name}>
      <AdminDashboard />
    </AppShell>
  );
}
