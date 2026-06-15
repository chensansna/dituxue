import { AppShell } from "@/components/app-shell";
import { TeacherDashboard } from "@/components/teacher-dashboard";
import { requireRole } from "@/lib/auth";
import { getTeacherOverview } from "@/lib/supabase/teacher-data";

export default async function Page() {
  const { profile, user } = await requireRole(["teacher"], "/teacher");
  const data = await getTeacherOverview(user.id);

  return (
    <AppShell role="teacher" title="教学概览" subtitle="当前教师真实教学数据" userName={profile.display_name}>
      <TeacherDashboard data={data} />
    </AppShell>
  );
}
