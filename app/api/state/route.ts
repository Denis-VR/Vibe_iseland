import { z } from "zod";
import { identity, database, failure } from "@/lib/server";
import { initialState } from "@/app/course";
const str = z.string();
const schema = z.object({
  revision: z.number().int().min(0),
  state: z.object({
    playlists: z
      .array(
        z.object({
          id: str.min(1).max(80),
          name: str.trim().min(1).max(100),
          tracks: z.array(str.max(80)).max(300),
        }),
      )
      .max(100),
  }),
});
export async function GET(r: Request) {
  try {
    const owner = await identity(r),
      db = database();
    await db
      .prepare(
        "INSERT OR IGNORE INTO study (owner,value,revision) VALUES (?,?,0)",
      )
      .bind(owner, JSON.stringify(initialState))
      .run();
    const row = await db
      .prepare("SELECT value,revision FROM study WHERE owner=?")
      .bind(owner)
      .first<{ value: string; revision: number }>();
    return Response.json(
      { state: JSON.parse(row!.value), revision: row!.revision },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(r: Request) {
  try {
    const owner = await identity(r);
    const raw = await r.text();
    if (raw.length > 500000)
      return Response.json({ error: "Слишком много данных" }, { status: 413 });
    const data = schema.safeParse(JSON.parse(raw));
    if (!data.success)
      return Response.json({ error: "Проверь данные" }, { status: 400 });
    const { state, revision } = data.data;
    const result = await database()
      .prepare(
        "UPDATE study SET value=?,revision=revision+1 WHERE owner=? AND revision=?",
      )
      .bind(JSON.stringify(state), owner, revision)
      .run();
    if (!result.meta.changes)
      return Response.json(
        {
          error:
            "Данные изменились на другом устройстве. Обнови страницу перед сохранением; скопируй несохранённую заметку.",
        },
        { status: 409 },
      );
    return Response.json({ revision: revision + 1 });
  } catch (e) {
    if (e instanceof SyntaxError)
      return Response.json({ error: "Некорректный JSON" }, { status: 400 });
    return failure(e);
  }
}
