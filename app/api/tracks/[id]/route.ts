import { identity, database, bucket, failure } from "@/lib/server";
export async function GET(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const owner = await identity(r),
      { id } = await params;
    const row = await database()
      .prepare("SELECT mime FROM tracks WHERE id=? AND owner=?")
      .bind(id, owner)
      .first<{ mime: string }>();
    if (!row) return new Response("Не найдено", { status: 404 });
    const object = await bucket().get(owner + "/" + id, { range: r.headers });
    if (!object) return new Response("Не найдено", { status: 404 });
    const headers = new Headers({
      "Content-Type": row.mime,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    let status = 200;
    const range = object.range;
    if (
      range &&
      "offset" in range &&
      "length" in range &&
      range.offset !== undefined &&
      range.length !== undefined
    ) {
      status = 206;
      headers.set(
        "Content-Range",
        `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`,
      );
      headers.set("Content-Length", String(range.length));
    } else headers.set("Content-Length", String(object.size));
    return new Response(object.body, { status, headers });
  } catch (e) {
    return failure(e);
  }
}
