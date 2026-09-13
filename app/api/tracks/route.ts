import { identity, database, bucket, failure } from "@/lib/server";
export async function GET(r: Request) {
  try {
    const owner = await identity(r);
    const rows = await database()
      .prepare(
        "SELECT id,name,mime,size FROM tracks WHERE owner=? ORDER BY rowid DESC",
      )
      .bind(owner)
      .all();
    return Response.json(rows.results, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(r: Request) {
  try {
    const owner = await identity(r);
    if (Number(r.headers.get("content-length")) > 26 * 1024 * 1024)
      return Response.json(
        { error: "Максимум 25 МБ на трек" },
        { status: 413 },
      );
    const size = Number(r.headers.get("content-length")),
      name = decodeURIComponent(r.headers.get("x-file-name") || "");
    if (
      !Number.isFinite(size) ||
      size <= 0 ||
      size > 25 * 1024 * 1024 ||
      !r.body ||
      !name ||
      name.length > 200
    )
      return Response.json(
        { error: "Выбери аудиофайл до 25 МБ с названием до 200 символов" },
        { status: 400 },
      );
    const mime = (
      {
        mp3: "audio/mpeg",
        m4a: "audio/mp4",
        ogg: "audio/ogg",
        wav: "audio/wav",
        flac: "audio/flac",
        aac: "audio/aac",
      } as Record<string, string>
    )[name.split(".").pop()!.toLowerCase()];
    if (!mime)
      return Response.json(
        { error: "Поддерживаются MP3, M4A, OGG, WAV, FLAC и AAC" },
        { status: 400 },
      );
    const id = crypto.randomUUID(),
      key = owner + "/" + id;
    await bucket().put(key, r.body, { httpMetadata: { contentType: mime } });
    try {
      await database()
        .prepare(
          "INSERT INTO tracks (id,owner,name,mime,size) VALUES (?,?,?,?,?)",
        )
        .bind(id, owner, name, mime, size)
        .run();
    } catch (e) {
      await bucket().delete(key);
      throw e;
    }
    return Response.json({ id, name: name, mime, size: size }, { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
