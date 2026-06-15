import { AppShell } from "@/components/app-shell";
import { TeacherAssignmentsManager } from "@/components/teacher-assignments-manager";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  const { profile } = await requireRole(["teacher"], "/teacher/assignments");

  return (
    <AppShell role="teacher" title="作业管理" subtitle="创建、发布和管理地图学作业" userName={profile.display_name}>
      <TeacherAssignmentsManager />
    </AppShell>
  );
}
