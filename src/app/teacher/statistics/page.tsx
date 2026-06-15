import { AppShell } from "@/components/app-shell";
import { TeacherStatisticsDashboard } from "@/components/teacher-statistics-dashboard";

export default function Page() {
  return (
    <AppShell role="teacher" title="成绩统计" subtitle="教师工作台">
      <TeacherStatisticsDashboard />
    </AppShell>
  );
}
