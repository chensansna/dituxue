import { AppShell } from "@/components/app-shell";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { requireRole } from "@/lib/auth";

const names: Record<string, [string, string]> = {
  assignments: ["作业管理", "创建、发布、关闭作业并配置审查要求。"],
  students: ["班级与学生", "导入名单、创建学生账号并管理班级。"],
  statistics: ["成绩统计", "查看成绩分布、排名并导出教学结果。"],
};

export default async function Page({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const { profile } = await requireRole(["teacher"], `/teacher/${module}`);
  const [title, desc] = names[module] ?? ["教师模块", "管理教学数据与工作流程。"];

  return (
    <AppShell role="teacher" title={title} subtitle="教师工作台" userName={profile.display_name}>
      <ModulePlaceholder title={title} description={desc} role="教师" />
    </AppShell>
  );
}
