import { AppShell } from "@/components/app-shell";
import { TeacherStatisticsDashboard } from "@/components/teacher-statistics-dashboard";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  const { profile } = await requireRole(["teacher"], "/teacher/statistics");

  return (
    <AppShell role="teacher" title="成绩统计" subtitle="查看成绩分布、排名并导出结果" userName={profile.display_name}>
      <TeacherStatisticsDashboard />
    </AppShell>
  );
}
