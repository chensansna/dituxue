import { randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "./admin";

export type TeacherAccount = {
  id: string;
  email: string;
  displayName: string;
  disabledAt: string | null;
  createdAt: string;
};

function initialPassword() {
  return `Teacher@${randomBytes(6).toString("base64url")}`;
}

async function listAuthUsersById(ids: string[]) {
  const admin = createSupabaseAdminClient();
  const result = new Map<string, string>();
  if (!ids.length) return result;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    for (const user of data.users) {
      if (ids.includes(user.id)) result.set(user.id, user.email ?? "");
    }
    if (data.users.length < 100 || result.size === ids.length) break;
  }
  return result;
}

async function findAuthUserByEmail(email: string) {
  const admin = createSupabaseAdminClient();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 100) return null;
  }
  return null;
}

export async function hasAnyAdmin() {
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
  if (error) throw error;
  return Boolean(count);
}

export async function createInitialAdmin(input: { email: string; password: string; displayName: string }) {
  if (await hasAnyAdmin()) throw new Error("系统已存在管理员");
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { display_name: input.displayName },
  });
  if (error || !data.user) throw error ?? new Error("管理员创建失败");
  const profile = await admin.from("profiles").insert({
    id: data.user.id,
    role: "admin",
    display_name: input.displayName,
    must_change_password: false,
  });
  if (profile.error) throw profile.error;
}

export async function listTeachers(): Promise<TeacherAccount[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id,display_name,disabled_at,created_at")
    .eq("role", "teacher")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const emails = await listAuthUsersById((data ?? []).map((item) => item.id));
  return (data ?? []).map((item) => ({
    id: item.id,
    email: emails.get(item.id) ?? "",
    displayName: item.display_name,
    disabledAt: item.disabled_at,
    createdAt: item.created_at,
  }));
}

export async function createTeacher(input: { email: string; displayName: string }) {
  const admin = createSupabaseAdminClient();
  const password = initialPassword();
  let user = await findAuthUserByEmail(input.email);
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email: input.email,
      password,
      email_confirm: true,
      user_metadata: { display_name: input.displayName },
    });
    if (created.error || !created.data.user) throw created.error ?? new Error("教师账号创建失败");
    user = created.data.user;
  } else {
    const updated = await admin.auth.admin.updateUserById(user.id, { password, user_metadata: { display_name: input.displayName } });
    if (updated.error) throw updated.error;
  }
  const profile = await admin.from("profiles").upsert({
    id: user.id,
    role: "teacher",
    display_name: input.displayName,
    must_change_password: true,
    disabled_at: null,
  });
  if (profile.error) throw profile.error;
  return { email: input.email, displayName: input.displayName, password };
}

export async function disableTeacher(id: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("profiles").update({ disabled_at: new Date().toISOString() }).eq("id", id).eq("role", "teacher");
  if (error) throw error;
}
