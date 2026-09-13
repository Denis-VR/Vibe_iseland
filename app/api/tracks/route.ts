import { identity, database, failure } from "@/lib/server";
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
export async function POST() {
  return Response.json(
    { error: "Загрузка своих треков отключена" },
    { status: 405 },
  );
}
