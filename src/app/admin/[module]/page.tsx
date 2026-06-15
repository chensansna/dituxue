import { AppShell } from "@/components/app-shell";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { requireRole } from "@/lib/auth";

const names: Record<string, [string, string]> = {
  settings: ["系统设置", "查看服务配置与文件限制，密钥通过环境变量管理。"],
};

export default async function Page({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const { profile } = await requireRole(["admin"], `/admin/${module}`);
  const [title, desc] = names[module] ?? ["管理模块", "维护系统运行配置。"];

  return (
    <AppShell role="admin" title={title} subtitle="管理员工作台" userName={profile.display_name}>
      <ModulePlaceholder title={title} description={desc} role="管理员" />
    </AppShell>
  );
}
