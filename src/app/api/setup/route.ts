import { NextResponse } from "next/server";
import { z } from "zod";
import { createInitialAdmin, hasAnyAdmin } from "@/lib/supabase/admin-users";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1),
});

export async function GET() {
  try {
    return NextResponse.json({ available: !(await hasAnyAdmin()) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "初始化状态检查失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await createInitialAdmin(schema.parse(await request.json()));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "创建管理员失败" }, { status: 400 });
  }
}
