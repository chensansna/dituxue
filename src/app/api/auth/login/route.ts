import { NextResponse } from "next/server";
import { z } from "zod";
import { roleHome, studentEmail } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const { identifier, password } = schema.parse(await request.json());
    const email = identifier.includes("@") ? identifier.trim() : studentEmail(identifier);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return NextResponse.json({ error: "账号或密码不正确" }, { status: 401 });
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role,display_name,must_change_password,disabled_at")
      .eq("id", data.user.id)
      .single();
    if (profileError || !profile) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: "账号资料不存在，请联系管理员" }, { status: 403 });
    }
    if (profile.disabled_at) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: "账号已停用" }, { status: 403 });
    }
    const home = roleHome(profile.role);
    return NextResponse.json({
      ok: true,
      role: profile.role,
      displayName: profile.display_name,
      redirectTo: profile.must_change_password ? `/change-password?next=${encodeURIComponent(home)}` : home,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "登录失败" }, { status: 400 });
  }
}
