import { z } from "zod";
import { verifyQwenImageProxySignature } from "@/lib/qwen-image-proxy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAP_BUCKET = "map-submissions";
const imageQuerySchema = z.object({
  path: z.string().min(1),
  mime: z.enum(["image/png", "image/jpeg"]),
  expires: z.coerce.number().int().positive(),
  sig: z.string().min(32),
});

export async function GET(request: Request) {
  const parsed = imageQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return new Response("Invalid image request", { status: 400 });

  const { path, mime, expires, sig } = parsed.data;
  if (!verifyQwenImageProxySignature(path, mime, expires, sig)) {
    return new Response("Image link expired or invalid", { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(MAP_BUCKET).download(path);
  if (error || !data) return new Response("Image not found", { status: 404 });

  return new Response(data, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=300",
    },
  });
}
