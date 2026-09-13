"use client";
import { useEffect, useRef, type ComponentProps } from "react";
import { Slider as Primitive } from "@/components/ui/slider";
export function Slider(props: ComponentProps<typeof Primitive>) {
  const ref = useRef<HTMLDivElement>(null);
  const label = props["aria-label"];
  useEffect(() => {
    ref.current
      ?.querySelectorAll('[role="slider"]')
      .forEach((el) => el.setAttribute("aria-label", label || "Значение"));
  }, [label]);
  return (
    <div ref={ref} className="slider-wrap">
      <Primitive {...props} />
    </div>
  );
}
