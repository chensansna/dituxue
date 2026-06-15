import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireApiRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  password: z.string().min(8, "新密码至少 8 位"),
});

export async function POST(request: Request) {
  try {
    const { password } = schema.parse(await request.json());
    const { supabase, user } = await requireApiRole(["admin", "teacher", "student"]);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    // Profile updates are intentionally blocked by RLS for normal users.
    const updated = await createSupabaseAdminClient().from("profiles").update({ must_change_password: false }).eq("id", user.id);
    if (updated.error) throw updated.error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
