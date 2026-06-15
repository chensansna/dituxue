import { Suspense } from "react";
import { ChangePasswordForm } from "@/components/change-password-form";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole(["admin", "teacher", "student"], "/change-password");

  return (
    <Suspense fallback={null}>
      <ChangePasswordForm />
    </Suspense>
  );
}
