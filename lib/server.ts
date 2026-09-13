import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
export async function identity(request: Request) {
  const u = await getChatGPTUser();
  if (!u) throw new Error("AUTH");
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new Error("ORIGIN");
  }
  return u.userId;
}
export function database() {
  if (!env.DB) throw new Error("STORAGE");
  return env.DB;
}
export function bucket() {
  if (!env.BUCKET) throw new Error("STORAGE");
  return env.BUCKET;
}
export function failure(e: unknown) {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "AUTH")
    return Response.json(
      { error: "Войди, чтобы сохранить музыку и прогресс." },
      { status: 401 },
    );
  if (msg === "ORIGIN")
    return Response.json({ error: "Запрос отклонён" }, { status: 403 });
  console.error("Storage request failed", msg);
  return Response.json(
    { error: "Не удалось обратиться к хранилищу. Попробуй ещё раз." },
    { status: 503 },
  );
}
