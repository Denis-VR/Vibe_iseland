import { test } from "node:test";
import assert from "node:assert/strict";
import { currentTask, localDay, readTaskDay } from "../app/focus-tasks.ts";
test("tasks expire by the local calendar day and malformed storage is safe", () => {
  assert.equal(localDay(new Date(2026, 8, 17, 23, 59)), "2026-09-17");
  for (const raw of ["{", "null", JSON.stringify({ date: "2026-09-16", tasks: [{id: "1", text: "Old", done: false}] })]) {
    assert.deepEqual(readTaskDay(raw, "2026-09-17").tasks, []);
  }
});
test("selected task is restored and completion advances to the next unfinished task", () => {
  const day = readTaskDay(JSON.stringify({ date: "2026-09-17", activeId: "b", tasks: [{id: "a", text: "First", done: false}, {id: "b", text: "Second", done: false}, null, {id: "x", text: "", done: false}] }), "2026-09-17");
  assert.equal(day.tasks.length, 2);
  assert.equal(currentTask(day)?.id, "b");
  day.tasks[1].done = true;
  assert.equal(currentTask(day)?.id, "a");
  day.tasks[0].done = true;
  assert.equal(currentTask(day), undefined);
});

test("reordering keeps the current task and persists the new order", async () => {
  const { reorderTasks } = await import("../app/focus-tasks.ts");
  const day = readTaskDay(JSON.stringify({ date: "2026-09-17", tasks: ["a", "b", "c"].map(id => ({ id, text: id, done: false })) }), "2026-09-17");
  const moved = reorderTasks(day, "c", "a");
  assert.deepEqual(moved.tasks.map(t => t.id), ["c", "a", "b"]);
  assert.equal(currentTask(moved)?.id, "a");
  assert.deepEqual(day.tasks.map(t => t.id), ["a", "b", "c"]);
  assert.deepEqual(readTaskDay(JSON.stringify(moved), day.date), moved);
  assert.equal(reorderTasks(day, "missing", "a"), day);
});
