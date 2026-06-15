import { AppShell } from "@/components/app-shell";
import { StudentDashboard } from "@/components/student-dashboard";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  const { profile } = await requireRole(["student"], "/student");

  return (
    <AppShell role="student" title="我的作业" subtitle="只展示你的个人数据" userName={profile.display_name}>
      <StudentDashboard />
    </AppShell>
  );
}
