export async function GET() {
  return Response.json({ error: "自动批量同步已停用" }, { status: 410 });
}
