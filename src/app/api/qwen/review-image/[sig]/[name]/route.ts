import { z } from "zod";
import { verifyQwenImageProxySignature } from "@/lib/qwen-image-proxy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAP_BUCKET = "map-submissions";
const imageQuerySchema = z.object({
  path: z.string().min(1),
  mime: z.enum(["image/png", "image/jpeg"]),
  expires: z.coerce.number().int().positive(),
});
const imageTokenSchema = z.object({
  path: z.string().min(1),
  mime: z.enum(["image/png", "image/jpeg"]),
  expires: z.number().int().positive(),
  sig: z.string().min(32),
});

function parseImageRequest(request: Request, tokenOrSignature: string) {
  const searchParams = new URL(request.url).searchParams;
  if (searchParams.has("path")) {
    const parsed = imageQuerySchema.safeParse(Object.fromEntries(searchParams));
    return parsed.success ? { ...parsed.data, sig: tokenOrSignature } : null;
  }
  try {
    const raw = JSON.parse(Buffer.from(tokenOrSignature, "base64url").toString("utf8"));
    const parsed = imageTokenSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ sig: string; name: string }> }) {
  const { sig, name } = await params;
  const parsed = parseImageRequest(request, sig);
  if (!parsed) return new Response("Invalid image request", { status: 400 });

  const { path, mime, expires } = parsed;
  const expectedExtension = mime === "image/jpeg" ? ".jpg" : ".png";
  if (!name.endsWith(expectedExtension)) return new Response("Invalid image extension", { status: 400 });
  if (!verifyQwenImageProxySignature(path, mime, expires, parsed.sig)) {
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
