import { AppShell } from "@/components/app-shell";
import { TeacherStudentsManager } from "@/components/teacher-students-manager";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  const { profile } = await requireRole(["teacher"], "/teacher/students");

  return (
    <AppShell role="teacher" title="班级与学生" subtitle="创建班级、学生账号和批量导入名单" userName={profile.display_name}>
      <TeacherStudentsManager />
    </AppShell>
  );
}
