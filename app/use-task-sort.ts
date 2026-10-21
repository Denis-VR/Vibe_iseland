import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";

type Row = { element: HTMLElement; id: string; top: number; height: number };
type Drag = {
  rows: Row[]; from: number; to: number; startY: number; y: number;
  scroll: HTMLElement; scrollStart: number; frame: number; active: boolean; settling: boolean;
};

// Preview the new order with transforms. Commit once, after the drop animation.
export function useTaskSort(order: string[], move: (from: string, to: string) => void) {
  const orderKey = order.join("|");
  const list = useRef<HTMLUListElement>(null);
  const drag = useRef<Drag | null>(null);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const previous = useRef(new Map<string, number>());
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clear = () => {
    const current = drag.current;
    if (current) {
      cancelAnimationFrame(current.frame);
      for (const { element } of current.rows) {
        element.style.transform = "";
        element.style.transition = "";
      }
    }
    drag.current = null;
  };
  useEffect(() => () => {
    clear();
    if (endTimer.current) clearTimeout(endTimer.current);
  }, []);
  useLayoutEffect(() => {
    const positions = new Map<string, number>();
    for (const element of Array.from(list.current?.children ?? []) as HTMLElement[]) {
      const id = element.dataset.taskId!;
      const top = element.offsetTop;
      const before = previous.current.get(id);
      if (!drag.current && before !== undefined && before !== top && !reduced()) {
        element.animate([{ transform: `translateY(${before - top}px)` }, { transform: "translateY(0)" }], { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" });
      }
      positions.set(id, top);
    }
    previous.current = positions;
    if (drag.current?.settling) clear();
  }, [orderKey]);

  function start(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (event.button !== 0 || drag.current || !list.current) return;
    const scroll = list.current.closest<HTMLElement>(".task-scroll");
    if (!scroll) return;
    const rows = Array.from(list.current.children).map(element => {
      const row = element as HTMLElement;
      return { element: row, id: row.dataset.taskId!, top: row.offsetTop, height: row.offsetHeight };
    });
    const from = rows.findIndex(row => row.id === id);
    if (from < 0) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const current: Drag = { rows, from, to: from, startY: event.clientY, y: event.clientY, scroll, scrollStart: scroll.scrollTop, frame: 0, active: false, settling: false };
    drag.current = current;
    function update() {
      if (drag.current !== current || current.settling) return;
      if (!current.active && Math.abs(current.y - current.startY) > 5) {
        current.active = true;
        setDragging(id);
        rows.forEach((row, index) => { row.element.style.transition = index === from || reduced() ? "none" : "transform 220ms cubic-bezier(.2,.8,.2,1)"; });
      }
      if (current.active) {
        const bounds = scroll!.getBoundingClientRect();
        const edge = 36;
        const speed = current.y < bounds.top + edge ? -Math.min(7, (bounds.top + edge - current.y) / 5) : current.y > bounds.bottom - edge ? Math.min(7, (current.y - bounds.bottom + edge) / 5) : 0;
        scroll!.scrollTop += speed;
        const source = rows[from];
        const delta = Math.max(rows[0].top - source.top, Math.min(rows.at(-1)!.top + rows.at(-1)!.height - source.height - source.top, current.y - current.startY + scroll!.scrollTop - current.scrollStart));
        const center = source.top + delta + source.height / 2;
        current.to = delta <= rows[0].top - source.top + 1 ? 0
          : delta >= rows.at(-1)!.top + rows.at(-1)!.height - source.height - source.top - 1 ? rows.length - 1
          : rows.filter((row, index) => index !== from && center > row.top + row.height / 2).length;
        rows.forEach((row, index) => {
          const shift = index === from ? delta : from < index && index <= current.to ? -source.height : current.to <= index && index < from ? source.height : 0;
          row.element.style.transform = `translateY(${shift}px)`;
        });
      }
      current.frame = requestAnimationFrame(update);
    }
    current.frame = requestAnimationFrame(update);
  }
  function finish(commit: boolean) {
    const current = drag.current;
    if (!current || current.settling) return;
    current.settling = true;
    cancelAnimationFrame(current.frame);
    const from = current.rows[current.from];
    const target = current.rows[current.to];
    const changed = commit && current.active && current.from !== current.to;
    current.rows.forEach(row => { row.element.style.transition = reduced() ? "none" : "transform 180ms cubic-bezier(.2,.8,.2,1)"; });
    if (changed) {
      from.element.style.transform = `translateY(${current.to > current.from ? target.top + target.height - from.height - from.top : target.top - from.top}px)`;
    } else {
      current.rows.forEach(row => { row.element.style.transform = "translateY(0)"; });
    }
    endTimer.current = setTimeout(() => {
      if (changed) move(from.id, target.id);
      else clear();
      setDragging(null);
      endTimer.current = null;
    }, current.active && !reduced() ? 180 : 0);
  }
  return { list, dragging, start,
    update(event: PointerEvent<HTMLButtonElement>) { if (drag.current && !drag.current.settling) drag.current.y = event.clientY; },
    drop: () => finish(true), cancel: () => finish(false),
  };
}
