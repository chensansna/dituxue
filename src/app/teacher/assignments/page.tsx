import { AppShell } from "@/components/app-shell";
import { TeacherAssignmentsManager } from "@/components/teacher-assignments-manager";

export default function Page() {
  return (
    <AppShell role="teacher" title="作业管理" subtitle="教师工作台">
      <TeacherAssignmentsManager />
    </AppShell>
  );
}
