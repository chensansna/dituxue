import { authErrorResponse, requireApiRole } from "@/lib/auth";

export async function POST() {
  try {
    await requireApiRole(["teacher"]);
    return Response.json({ error: "批量审查已改为教师页面内逐份执行" }, { status: 410 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
