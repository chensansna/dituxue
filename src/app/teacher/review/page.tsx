import { AppShell } from "@/components/app-shell";
import { ReviewWorkspace } from "@/components/review-workspace";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  const { profile } = await requireRole(["teacher"], "/teacher/review");

  return (
    <AppShell role="teacher" title="AI 审查与人工复评" subtitle="形式审查与教师复评工作台" userName={profile.display_name}>
      <ReviewWorkspace />
    </AppShell>
  );
}
