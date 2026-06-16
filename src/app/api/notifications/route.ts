import { authErrorResponse, requireApiRole } from "@/lib/auth";
import { listNotifications } from "@/lib/supabase/notifications";

export async function GET() {
  try {
    const { profile } = await requireApiRole(["admin", "teacher", "student"]);
    return Response.json(await listNotifications(profile));
  } catch (error) {
    return authErrorResponse(error);
  }
}
