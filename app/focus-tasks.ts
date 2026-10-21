export type FocusTask = { id: string; text: string; done: boolean };
export type TaskDay = { date: string; tasks: FocusTask[]; activeId: string | null };
export function localDay(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function readTaskDay(raw: string | null, date = localDay()): TaskDay {
  const empty: TaskDay = { date, tasks: [], activeId: null };
  try {
    const value = JSON.parse(raw || "null");
    if (value?.date !== date || !Array.isArray(value.tasks)) return empty;
    const tasks: FocusTask[] = value.tasks.filter((t: FocusTask) => t && typeof t.id === "string" && typeof t.text === "string" && t.text.trim() && t.text.length <= 180 && typeof t.done === "boolean").slice(0, 50);
    return { date, tasks, activeId: tasks.some(t => t.id === value.activeId && !t.done) ? value.activeId : null };
  } catch { return empty; }
}
export function currentTask(day: TaskDay) {
  return day.tasks.find(t => t.id === day.activeId && !t.done) ?? day.tasks.find(t => !t.done);
}

export function reorderTasks(day: TaskDay, fromId: string, toId: string): TaskDay {
  const from = day.tasks.findIndex(task => task.id === fromId);
  const to = day.tasks.findIndex(task => task.id === toId);
  if (from < 0 || to < 0 || from === to) return day;
  const tasks = [...day.tasks];
  const [task] = tasks.splice(from, 1);
  tasks.splice(to, 0, task);
  return { ...day, tasks, activeId: currentTask(day)?.id ?? null };
}
