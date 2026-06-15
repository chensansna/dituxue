import { authErrorResponse, requireApiRole } from "@/lib/auth";

export async function POST() {
  try {
    await requireApiRole(["teacher"]);
    return Response.json({ error: "请从教师审查工作区发起 Qwen 审查" }, { status: 410 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
