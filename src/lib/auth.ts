import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";

export type AppRole = "admin" | "teacher" | "student";

export type SessionProfile = {
  id: string;
  role: AppRole;
  display_name: string;
  student_no: string | null;
  must_change_password: boolean;
  disabled_at: string | null;
};

export function roleHome(role: AppRole) {
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/teacher";
  return "/student";
}

export function studentEmail(studentNo: string) {
  return `${studentNo.trim()}@students.dituxue.local`;
}

export async function getCurrentSession() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,role,display_name,student_no,must_change_password,disabled_at")
    .eq("id", user.id)
    .single();
  if (error || !profile) return null;
  return { supabase, user, profile: profile as SessionProfile };
}

export async function requireRole(roles: AppRole[], nextPath: string) {
  const session = await getCurrentSession();
  if (!session) redirect(`/?next=${encodeURIComponent(nextPath)}`);
  if (session.profile.disabled_at) redirect("/?error=disabled");
  if (session.profile.must_change_password && nextPath !== "/change-password") {
    redirect(`/change-password?next=${encodeURIComponent(nextPath)}`);
  }
  if (!roles.includes(session.profile.role)) redirect(roleHome(session.profile.role));
  return session;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireApiRole(roles: AppRole[]) {
  const session = await getCurrentSession();
  if (!session) throw new HttpError(401, "未登录");
  if (session.profile.disabled_at) throw new HttpError(403, "账号已停用");
  if (!roles.includes(session.profile.role)) throw new HttpError(403, "无权限");
  return session;
}

export function authErrorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json({ error: error instanceof Error ? error.message : "请求失败" }, { status: 500 });
}
