import { AppShell } from "@/components/app-shell";
import { TeacherDashboard } from "@/components/teacher-dashboard";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  const { profile } = await requireRole(["teacher"], "/teacher");

  return (
    <AppShell role="teacher" title="教学概览" subtitle="2025-2026 学年第二学期" userName={profile.display_name}>
      <TeacherDashboard />
    </AppShell>
  );
}
