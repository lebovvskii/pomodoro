import { useCallback, useEffect, useRef, useState } from "react";
import type { ClickSound, ClickPhase } from "@/lib/mechanical-audio";

/** Keep the hit target still while the cap moves, including very quick taps. */
export function usePhysicalPress(
  play: (kind: ClickSound, phase: ClickPhase) => void,
) {
  const [pressed, setPressed] = useState<string | null>(null);
  const active = useRef<{ name: string; kind: ClickSound; at: number } | null>(
    null,
  );
  const physicalClick = useRef<string | null>(null);
  const cancelledClick = useRef<string | null>(null);
  const releaseTimer = useRef<ReturnType<typeof setTimeout>>();
  const playRef = useRef(play);
  playRef.current = play;

  const release = useCallback((name?: string) => {
    const value = active.current;
    if (!value || (name && name !== value.name)) return;
    active.current = null;
    clearTimeout(releaseTimer.current);
    releaseTimer.current = setTimeout(
      () => {
        setPressed(null);
        playRef.current(value.kind, "release");
      },
      Math.max(0, 70 - (performance.now() - value.at)),
    );
  }, []);

  const press = useCallback((name: string, kind: ClickSound) => {
    if (active.current) return false;
    clearTimeout(releaseTimer.current);
    active.current = { name, kind, at: performance.now() };
    setPressed(name);
    playRef.current(kind, "press");
    return true;
  }, []);

  const pulse = useCallback(
    (name: string, kind: ClickSound) => {
      if (press(name, kind)) release(name);
    },
    [press, release],
  );

  useEffect(() => {
    const cancel = () => {
      physicalClick.current = null;
      cancelledClick.current = active.current?.name ?? null;
      release();
    };
    const hide = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", hide);
      clearTimeout(releaseTimer.current);
    };
  }, [release]);

  const bind = (name: string, kind: ClickSound, activate: () => void) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || !event.isPrimary) return;
      if (press(name, kind)) {
        physicalClick.current = name;
        cancelledClick.current = null;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!event.isPrimary) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      )
        cancelledClick.current = name;
      release(name);
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
    },
    onPointerCancel: () => {
      physicalClick.current = null;
      cancelledClick.current = name;
      release(name);
    },
    onLostPointerCapture: () => {
      if (active.current?.name !== name) return;
      physicalClick.current = null;
      cancelledClick.current = name;
      release(name);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if ((event.key === " " || event.key === "Enter") && !event.repeat) {
        if (press(name, kind)) {
          physicalClick.current = name;
          cancelledClick.current = null;
        }
      }
      if (event.repeat && (event.key === " " || event.key === "Enter"))
        event.preventDefault();
    },
    onKeyUp: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === " " || event.key === "Enter") release(name);
    },
    onBlur: () => {
      physicalClick.current = null;
      release(name);
    },
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.detail > 0 && cancelledClick.current === name) {
        physicalClick.current = null;
        cancelledClick.current = null;
        return;
      }
      if (physicalClick.current !== name) pulse(name, kind);
      physicalClick.current = null;
      activate();
    },
  });

  return { pressed, bind, press, release, pulse };
}
