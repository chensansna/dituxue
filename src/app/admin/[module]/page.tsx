import { AppShell } from "@/components/app-shell";
import { AdminSettings } from "@/components/admin-settings";
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
      {module === "settings" ? <AdminSettings status={{
        supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        supabaseServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        qwenApiKey: Boolean(process.env.QWEN_API_KEY),
        qwenBaseUrl: process.env.QWEN_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
        qwenModel: process.env.QWEN_VISION_MODEL ?? "qwen3-vl-plus",
        maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 50),
      }} /> : <ModulePlaceholder title={title} description={desc} role="管理员" />}
    </AppShell>
  );
}
