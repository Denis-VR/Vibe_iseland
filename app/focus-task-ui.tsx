"use client";
import { useEffect, useState } from "react";
import { Check, GripVertical, ListTodo, Plus, X } from "lucide-react";
import { useWindowDrag } from "./use-window-drag";
import { useTaskSort } from "./use-task-sort";
import { newId } from "./id";
import { currentTask, localDay, readTaskDay, reorderTasks, type TaskDay } from "./focus-tasks";
const storageKey = "quiet-height-tasks";
export function useFocusTasks() {
  const [day, setDay] = useState<TaskDay>({ date: localDay(), tasks: [], activeId: null });
  const [loaded, setLoaded] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  useEffect(() => {
    Promise.resolve().then(() => {
      try { setDay(readTaskDay(localStorage.getItem(storageKey))); } catch { setStorageFailed(true); }
      setLoaded(true);
    });
    const refresh = () => setDay(previous => previous.date === localDay() ? previous : { date: localDay(), tasks: [], activeId: null });
    const interval = setInterval(refresh, 1000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(storageKey, JSON.stringify(day)); } catch { Promise.resolve().then(() => setStorageFailed(true)); }
  }, [day, loaded]);
  return {
    day, loaded, storageFailed, active: currentTask(day),
    add(text: string) { if (!text.trim() || day.tasks.length >= 50) return; setDay(previous => ({ ...previous, tasks: [...previous.tasks, { id: newId(), text: text.trim().slice(0, 180), done: false }] })); },
    toggle(id: string) { setDay(previous => ({ ...previous, tasks: previous.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t) })); },
    remove(id: string) { setDay(previous => ({ ...previous, tasks: previous.tasks.filter(t => t.id !== id) })); },
    move(from: string, to: string) { setDay(previous => reorderTasks(previous, from, to)); },
    select(id: string) { setDay(previous => ({ ...previous, activeId: id })); },
  };
}
type Tasks = ReturnType<typeof useFocusTasks>;
function TaskRows({ model }: { model: Tasks }) {
  const { list, dragging, start, update, drop, cancel } = useTaskSort(model.day.tasks.map(task => task.id), model.move);
  return <ul ref={list} className="task-list">{model.day.tasks.map((task, index) => <li key={task.id} data-task-id={task.id} className={`${task.done ? "task-done" : ""} ${model.active?.id === task.id ? "task-active" : ""} ${dragging === task.id ? "task-dragging" : ""}`}>
    <button className="task-grip" aria-label={`Переместить задачу: ${task.text}`} title="Перетащи или используй стрелки ↑ ↓" onKeyDown={event => {
      if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const next = model.day.tasks[index + (event.key === "ArrowUp" ? -1 : 1)];
      if (next) model.move(task.id, next.id);
    }} onPointerDown={event => start(event, task.id)} onPointerMove={update} onPointerUp={drop} onPointerCancel={cancel} onLostPointerCapture={cancel}><GripVertical /></button>
    <button className="task-check" aria-label={`${task.done ? "Вернуть задачу" : "Завершить задачу"}: ${task.text}`} aria-pressed={task.done} onClick={() => model.toggle(task.id)}>{task.done && <Check />}</button>
    <button className="task-text" disabled={task.done} aria-label={`Текущая задача: ${task.text}`} aria-pressed={model.active?.id === task.id} onClick={() => model.select(task.id)}>{task.text}{model.active?.id === task.id && <small>Сейчас в фокусе</small>}</button>
    <button className="task-delete" aria-label={`Удалить задачу: ${task.text}`} title="Удалить задачу" onClick={() => model.remove(task.id)}><X /></button>
  </li>)}</ul>;
}
export function TaskCard({ model, zen, onClose }: { model: Tasks; zen: boolean; onClose: () => void }) {
  const { card, handle } = useWindowDrag();
  const [draft, setDraft] = useState("");
  const [closing, setClosing] = useState(false);
  const done = model.day.tasks.filter(t => t.done).length;
  return <section ref={card} inert={closing} onAnimationEnd={event => { if (event.target === event.currentTarget && event.animationName === "floating-depart") onClose(); }} className={`task-card floating-card ${closing ? "is-closing" : ""} ${zen ? "task-card-quiet" : ""}`} aria-label="Задачи на сегодня" onKeyDown={event => { if (event.key === "Escape" && !zen) { event.stopPropagation(); setClosing(true); } }}>
    <div className="task-card-heading window-drag-handle" {...handle} title="Перетащи окно за заголовок · двойной щелчок возвращает на место"><span><ListTodo />{zen ? "Сейчас в фокусе" : "Задачи на сегодня"}</span><span className="task-count">{done} / {model.day.tasks.length}</span><button className="floating-close" onClick={() => setClosing(true)} aria-label="Закрыть задачи"><X /></button></div>
    <div className="task-overview" inert={zen}><div className="task-expanded">
      <form className="task-form" onSubmit={event => { event.preventDefault(); if (!draft.trim()) return; model.add(draft); setDraft(""); }}>
        <input aria-label="Новая задача на сегодня" placeholder="Один небольшой шаг…" maxLength={180} value={draft} onChange={event => setDraft(event.target.value)} disabled={!model.loaded || model.day.tasks.length >= 50} />
        <button type="submit" aria-label="Добавить задачу" disabled={!model.loaded || !draft.trim() || model.day.tasks.length >= 50}><Plus /></button>
      </form>
      <div className="task-scroll"><TaskRows model={model} />{!model.day.tasks.length && <p className="task-empty">Что хочется сделать сегодня?</p>}</div>
      {(model.storageFailed || model.day.tasks.length >= 50) && <p className="task-hint">{model.storageFailed ? "Задачи сохранятся только до закрытия страницы." : "На сегодня уже 50 задач."}</p>}
    </div></div>
    <div className="task-current" inert={!zen}><div>{model.active ? <div className="current-task-row" key={model.active.id}><button className="task-check" aria-label={`Завершить задачу: ${model.active.text}`} onClick={() => model.toggle(model.active!.id)} /><p>{model.active.text}</p><button className="task-delete" aria-label={`Удалить задачу: ${model.active.text}`} onClick={() => model.remove(model.active!.id)}><X /></button></div> : <p>{model.day.tasks.length ? "На сегодня всё. Можно просто побыть здесь." : "Можно просто побыть здесь."}</p>}</div></div>
  </section>;
}
