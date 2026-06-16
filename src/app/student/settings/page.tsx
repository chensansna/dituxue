import { AppShell } from "@/components/app-shell";
import { UserSettings } from "@/components/user-settings";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  const { profile } = await requireRole(["student"], "/student/settings");

  return (
    <AppShell role="student" title="个人设置" subtitle="账号安全、头像和主题" userName={profile.display_name}>
      <UserSettings role="student" />
    </AppShell>
  );
}
