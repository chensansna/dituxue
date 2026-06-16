import { AppShell } from "@/components/app-shell";
import { UserSettings } from "@/components/user-settings";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  const { profile } = await requireRole(["teacher"], "/teacher/settings");

  return (
    <AppShell role="teacher" title="个人设置" subtitle="账号安全、头像和主题" userName={profile.display_name}>
      <UserSettings role="teacher" />
    </AppShell>
  );
}
