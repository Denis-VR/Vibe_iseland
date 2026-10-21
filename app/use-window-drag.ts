import { useEffect, useRef, type PointerEvent } from "react";

// Individual translate keeps window movement independent of enter/exit animations.
export function useWindowDrag() {
  const card = useRef<HTMLElement>(null);
  const mountedCard = useRef<HTMLElement | null>(null);
  const offset = useRef({ x: 0, y: 0 });
  const gesture = useRef<{ pointer: number; x: number; y: number; startX: number; startY: number } | null>(null);
  function place(x: number, y: number) {
    const element = card.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const baseX = rect.left - offset.current.x;
    const baseY = rect.top - offset.current.y;
    const padding = 8;
    const nextX = Math.max(padding - baseX, Math.min(x, window.innerWidth - padding - rect.width - baseX));
    const nextY = Math.max(padding - baseY, Math.min(y, window.innerHeight - padding - rect.height - baseY));
    offset.current = { x: nextX, y: nextY };
    element.style.translate = `${nextX}px ${nextY}px`;
  }
  useEffect(() => {
    const element = card.current;
    if (!element) return;
    if (mountedCard.current !== element) {
      mountedCard.current = element;
      offset.current = { x: 0, y: 0 };
    }
    const keepVisible = () => place(offset.current.x, offset.current.y);
    const observer = new ResizeObserver(keepVisible);
    observer.observe(element);
    window.addEventListener("resize", keepVisible);
    return () => { observer.disconnect(); window.removeEventListener("resize", keepVisible); };
  });
  function end(event: PointerEvent<HTMLElement>) {
    if (gesture.current?.pointer !== event.pointerId) return;
    gesture.current = null;
    card.current?.classList.remove("window-dragging");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return {
    card,
    handle: {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (event.button !== 0 || (event.target as HTMLElement).closest("button,input,a")) return;
        event.preventDefault();
        gesture.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, startX: offset.current.x, startY: offset.current.y };
        event.currentTarget.setPointerCapture(event.pointerId);
        card.current?.classList.add("window-dragging");
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const active = gesture.current;
        if (!active || active.pointer !== event.pointerId) return;
        place(active.startX + event.clientX - active.x, active.startY + event.clientY - active.y);
      },
      onPointerUp: end,
      onPointerCancel: end,
      onLostPointerCapture: end,
      onDoubleClick(event: React.MouseEvent<HTMLElement>) {
        if ((event.target as HTMLElement).closest("button")) return;
        place(0, 0);
      },
    },
  };
}
