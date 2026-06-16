import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireApiRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  honorific: z.string().trim().max(40).nullable().optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  themeMode: z.enum(["light", "dark"]),
  themeColor: z.enum(["green", "blue", "purple", "slate"]),
});

export async function GET() {
  try {
    const { user } = await requireApiRole(["admin", "teacher", "student"]);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id,role,display_name,honorific,avatar_color,theme_mode,theme_color")
      .eq("id", user.id)
      .single();
    if (error) throw error;
    return NextResponse.json({
      profile: {
        id: data.id,
        role: data.role,
        displayName: data.display_name,
        honorific: data.honorific ?? "",
        avatarColor: data.avatar_color ?? "#176b4d",
        themeMode: data.theme_mode ?? "light",
        themeColor: data.theme_color ?? "green",
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireApiRole(["admin", "teacher", "student"]);
    const input = updateSchema.parse(await request.json());
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({
        display_name: input.displayName,
        honorific: input.honorific || null,
        avatar_color: input.avatarColor,
        theme_mode: input.themeMode,
        theme_color: input.themeColor,
      })
      .eq("id", user.id);
    if (error) throw error;
    const updated = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { display_name: input.displayName },
    });
    if (updated.error) throw updated.error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
