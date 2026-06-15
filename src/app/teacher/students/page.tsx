import { AppShell } from "@/components/app-shell";
import { TeacherStudentsManager } from "@/components/teacher-students-manager";

export default function Page() {
  return (
    <AppShell role="teacher" title="班级与学生" subtitle="教师工作台">
      <TeacherStudentsManager />
    </AppShell>
  );
}
