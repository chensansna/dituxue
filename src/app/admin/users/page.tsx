import { AdminTeachersManager } from "@/components/admin-teachers-manager";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  const { profile } = await requireRole(["admin"], "/admin/users");

  return (
    <AppShell role="admin" title="教师账号" subtitle="创建、停用和查看教师账号" userName={profile.display_name}>
      <AdminTeachersManager />
    </AppShell>
  );
}
