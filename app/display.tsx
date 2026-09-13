import { useEffect, useRef, useState } from "react";
import type { SceneQuality } from "./scene-quality";
import { newId } from "./id";

type FullDocument = Document & { webkitFullscreenElement?: Element; msFullscreenElement?: Element; webkitExitFullscreen?: () => void; msExitFullscreen?: () => void };
type FullElement = HTMLElement & { webkitRequestFullscreen?: () => void; msRequestFullscreen?: () => void };
export function fullscreenElement() {
  const doc = document as FullDocument;
  return doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement;
}
export async function toggleFullscreen() {
  const doc = document as FullDocument, root = document.documentElement as FullElement;
  if (fullscreenElement()) {
    const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
    if (!exit) throw Error("unsupported");
    await exit.call(doc);
  } else {
    const enter = root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen;
    if (!enter) throw Error("unsupported");
    await enter.call(root);
  }
}
export function useDisplay() {
  const [quality, setQuality] = useState<SceneQuality>(() => {
    try { const saved = localStorage.getItem("quiet-height-quality"); return saved === "hd" || saved === "uhd" ? saved : "auto"; } catch { return "auto"; }
  });
  useEffect(() => {
    function resize() {
      const viewport = window.visualViewport;
      document.documentElement.style.setProperty("--app-height", `${Math.round(viewport?.height || innerHeight)}px`);
    }
    resize();
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); window.visualViewport?.removeEventListener("resize", resize); };
  }, []);
  return { fit: "cover" as const, quality, changeQuality(value: SceneQuality) {
    setQuality(value);
    try { localStorage.setItem("quiet-height-quality", value); } catch { /* Optional persistence. */ }
  } };
}
export function DisplaySettings({ display, weather, season, zen }: { display: ReturnType<typeof useDisplay>; weather: string; season: string; zen: boolean }) {
  const [status, setStatus] = useState(""), [sending, setSending] = useState(false), [sent, setSent] = useState(false);
  const pending = useRef<object | null>(null);
  async function report() {
    setSending(true);
    try {
      const root = document.documentElement as FullElement;
      if (!pending.current) pending.current = {
        id: newId(), version: "display-20260913-5",
        quality: display.quality, sourceResolution: document.querySelector("canvas")?.dataset.sourceResolution || "loading",
        browser: navigator.userAgent.slice(0, 512), language: navigator.language.slice(0, 40),
        screen: { width: screen.width, height: screen.height },
        viewport: { width: innerWidth, height: innerHeight },
        document: { width: root.scrollWidth, height: root.scrollHeight },
        visual: { width: window.visualViewport?.width || innerWidth, height: window.visualViewport?.height || innerHeight, scale: window.visualViewport?.scale || 1 },
        rendered: [".sanctuary", ".landscape-layers", ".landscape-canvas"].map(selector => {
          const element = document.querySelector(selector)!;
          const rect = element.getBoundingClientRect();
          return { selector, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }),
        canvas: { width: (document.querySelector(".landscape-canvas") as HTMLCanvasElement).width, height: (document.querySelector(".landscape-canvas") as HTMLCanvasElement).height },
        pixelRatio: devicePixelRatio || 1,
        fullscreen: !!fullscreenElement(), fullscreenSupported: !!(root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen),
        touch: navigator.maxTouchPoints || 0, fit: display.fit, weather, season, zen,
      };
      const response = await fetch("/api/device-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pending.current) });
      if (!response.ok) throw Error("Не удалось отправить. Попробуй ещё раз.");
      setSent(true); setStatus("Спасибо! Данные о проблеме отправлены.");
    } catch { setStatus("Не удалось отправить. Попробуй ещё раз."); }
    finally { setSending(false); }
  }
  return <section className="display-settings">
    <h3>Экран и пейзаж</h3>
    <div className="fit-options" aria-label="Качество пейзажа">
      {([["auto", "Авто"], ["hd", "HD"], ["uhd", "4K"]] as const).map(([id, label]) => <button key={id} aria-pressed={display.quality === id} onClick={() => display.changeQuality(id)}>{label}</button>)}
    </div>
    <p className="small-copy">Для большого телевизора выбери 4K. Если переходы тормозят, верни Авто или HD. Качество сохраняется для этого устройства.</p>
    <p className="small-copy">Пейзаж заполняет экран одной картинкой. На узких экранах края обрезаются. На iPhone кнопка полного экрана скрывает управление сайта; для открытия без панелей Safari добавь сайт на экран «Домой» через меню «Поделиться».</p>
    <button onClick={report} disabled={sending || sent}>{sending ? "Отправляю…" : sent ? "Проблема отправлена" : "Сообщить о проблеме с отображением"}</button>
    <p className="small-copy">Одно нажатие отправит браузер, размеры экрана и настройки отображения. Без снимка экрана, координат и введённого текста.</p>
    <p role="status">{status}</p>
    <h3>Версии сайта</h3>
    <p className="small-copy">Если соединение нестабильно, открой другую версию. Настройки и плейлисты на каждом адресе сохраняются отдельно.</p>
    <p className="small-copy"><a href="https://ru.vibeisland.fun/">Сервер в России</a> · <a href="https://vibeisland.fun/">Основной сервер</a></p>
  </section>;
}
