import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import {
  LIMITS,
  MODE_NAMES,
  today,
  useFocusTimer,
} from "@/hooks/use-focus-timer";
import type { Mode } from "@/hooks/use-focus-timer";
import { usePhysicalPress } from "@/hooks/use-physical-press";
import { MechanicalAudio } from "@/lib/mechanical-audio";
import type { ClickSound } from "@/lib/mechanical-audio";

import {
  APPARATUS_STYLES,
  OPERATING_GUIDE,
  isAppearance,
} from "./apparatus-styles";
import type { Appearance } from "./apparatus-styles";
import { StyleSwitcher } from "./style-switcher";

const Scene = dynamic(() => import("./instrument-scene"), { ssr: false });
const modes: Mode[] = ["focus", "short", "long"];
const segments = [
  "7,3 34,3 38,7 33,11 8,11 3,7",
  "35,13 40,8 40,34 36,38 32,34 32,17",
  "36,40 40,44 40,68 35,73 32,65 32,44",
  "8,66 33,66 37,73 33,77 7,77 3,73",
  "3,41 7,45 7,65 2,72 0,67 0,45",
  "2,10 7,16 7,33 3,37 0,33 0,14",
  "7,35 33,35 37,39 33,43 7,43 3,39",
];
const digitSegments = [
  "abcdef",
  "bc",
  "abdeg",
  "abcdg",
  "bcfg",
  "acdfg",
  "acdefg",
  "abc",
  "abcdefg",
  "abcdfg",
];

function Digit({ value }: { value: string }) {
  return (
    <svg className="display-digit" viewBox="0 0 40 80" aria-hidden="true">
      {segments.map((points, i) => (
        <polygon
          key={i}
          points={points}
          className={
            digitSegments[Number(value)].includes("abcdefg"[i])
              ? "segment-on"
              : "segment-off"
          }
        />
      ))}
    </svg>
  );
}
function Icon({
  name,
  size = 18,
}: {
  name:
    | "sound"
    | "muted"
    | "settings"
    | "help"
    | "close"
    | "play"
    | "pause"
    | "reset"
    | "arrow";
  size?: number;
}) {
  const paths = {
    sound: (
      <>
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        <path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" />
      </>
    ),
    muted: (
      <>
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        <path d="m16 9 5 6m0-6-5 6" />
      </>
    ),
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="2.5" />
        <circle cx="15" cy="17" r="2.5" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 1 1 4 2l-1.5 1v2M12 17h.01" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    play: <path d="m8 5 11 7-11 7Z" />,
    pause: (
      <>
        <path d="M8 5v14M16 5v14" />
      </>
    ),
    reset: (
      <>
        <path d="M4 10a8 8 0 1 1 .5 6M4 4v6h6" />
      </>
    ),
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function DurationInput({
  mode,
  value,
  onCommit,
}: {
  mode: Mode;
  value: number;
  onCommit: (mode: Mode, minutes: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const minutes = Number(draft);
    if (!draft.trim() || !Number.isFinite(minutes)) {
      setDraft(String(value));
      return;
    }
    const bounded = Math.min(
      LIMITS[mode][1],
      Math.max(LIMITS[mode][0], Math.round(minutes)),
    );
    setDraft(String(bounded));
    onCommit(mode, bounded);
  };
  return (
    <input
      type="number"
      min={LIMITS[mode][0]}
      max={LIMITS[mode][1]}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      aria-label={`${MODE_NAMES[mode]} minutes`}
    />
  );
}

export function FocusInstrument() {
  const {
    session,
    hydrated,
    toggle,
    reset,
    selectMode,
    setDuration,
    setAuto,
    setIntention,
  } = useFocusTimer();
  const {
    mode,
    remaining,
    status,
    durations,
    auto,
    intention,
    cycleCompleted,
    notice,
  } = session;
  const round =
    mode === "focus" ? cycleCompleted + 1 : Math.max(1, cycleCompleted);
  const running = status === "running";
  const locked = !hydrated || status !== "ready";
  const [sound, setSound] = useState(true);
  const [volume, setVolume] = useState(0.35);
  const [appearance, setAppearance] = useState<Appearance>("cyberpunk");
  const [rendered, setRendered] = useState(false);
  const [sceneLoaded, setSceneLoaded] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [compact, setCompact] = useState(false);
  const [rollerAngle, setRollerAngle] = useState(0);
  const [actuation, setActuation] = useState(0);
  const actuator = useRef<{
    pointer: number;
    y: number;
    travel: number;
    at: number;
    progress: number;
    hold: boolean;
  } | null>(null);
  const chargeAnimation = useRef(0);
  const [dialogKind, setDialogKind] = useState<"settings" | "guide" | null>(
    null,
  );
  const [soundLoaded, setSoundLoaded] = useState(false);
  const audio = useRef<MechanicalAudio | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const { pressed, bind, press, release, pulse } = usePhysicalPress(
    (kind, phase) => audio.current?.click(kind, phase),
  );
  const drag = useRef<{
    kind: "dial" | "roller" | "selector";
    pointerId: number;
    centerX: number;
    centerY: number;
    radius: number;
    vertical: boolean;
    startY: number;
    startX: number;
    width: number;
    startMinutes: number;
    startMode: number;
    lastAngle: number;
    accumulated: number;
    base: number;
    moved: boolean;
    lastY: number;
    lastTime: number;
    velocity: number;
  } | null>(null);
  const rollerCurrent = useRef(0);
  const rollerAnimation = useRef(0);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const dialogOpener = useRef<HTMLElement | null>(null);
  const lastNotice = useRef<number | null>(null);
  const [minimum, maximum, step] = LIMITS[mode];
  const dialAngle =
    ((-135 + ((durations[mode] - minimum) / (maximum - minimum)) * 270) *
      Math.PI) /
    180;
  const durationFraction = (durations[mode] - minimum) / (maximum - minimum);
  const operatingGuide = OPERATING_GUIDE[appearance];
  const stats =
    session.stats.date === today()
      ? session.stats
      : { sessions: 0, seconds: 0 };
  const progress = 1 - remaining / (durations[mode] * 60);
  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");
  const label = running
    ? "Pause session"
    : status === "paused"
      ? "Resume session"
      : mode === "focus"
        ? "Start focusing"
        : "Start your break";

  useEffect(() => {
    audio.current = new MechanicalAudio();
    void audio.current.preload();
    try {
      const saved = JSON.parse(
        localStorage.getItem("tempo.sound.v1") || "null",
      );
      if (saved) {
        const enabled = saved.enabled !== false;
        const savedVolume =
          typeof saved.volume === "number" && Number.isFinite(saved.volume)
            ? Math.max(0, Math.min(1, saved.volume))
            : 0.35;
        setSound(enabled);
        setVolume(savedVolume);
        audio.current.setEnabled(enabled);
        audio.current.setVolume(savedVolume);
      }
    } catch {
      /* Use the default sound preference. */
    }
    try {
      const savedAppearance = localStorage.getItem("tempo.apparatus.v1");
      if (isAppearance(savedAppearance)) setAppearance(savedAppearance);
    } catch {
      /* The apparatus is usable without storage. */
    }
    setSoundLoaded(true);
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(media.matches);
    const change = () => setReducedMotion(media.matches);
    media.addEventListener("change", change);
    const compactMedia = matchMedia("(max-width: 620px)");
    const resize = () => setCompact(compactMedia.matches);
    resize();
    compactMedia.addEventListener("change", resize);
    const cancelGesture = () => {
      drag.current = null;
      actuator.current = null;
      cancelAnimationFrame(chargeAnimation.current);
      setActuation(0);
      cancelAnimationFrame(rollerAnimation.current);
    };
    const visibility = () => {
      if (document.hidden) cancelGesture();
    };
    window.addEventListener("blur", cancelGesture);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      audio.current?.dispose();
      media.removeEventListener("change", change);
      compactMedia.removeEventListener("change", resize);
      window.removeEventListener("blur", cancelGesture);
      document.removeEventListener("visibilitychange", visibility);
      cancelAnimationFrame(rollerAnimation.current);
      cancelAnimationFrame(chargeAnimation.current);
    };
  }, []);
  useEffect(() => {
    audio.current?.setEnabled(sound);
    audio.current?.setVolume(volume);
    if (soundLoaded) {
      try {
        localStorage.setItem(
          "tempo.sound.v1",
          JSON.stringify({ enabled: sound, volume }),
        );
      } catch {
        /* Optional. */
      }
    }
  }, [sound, volume, soundLoaded]);
  useEffect(() => {
    const previous = document.documentElement.style.getPropertyValue("--paper");
    const selected = APPARATUS_STYLES.find((style) => style.id === appearance)!;
    document.documentElement.style.setProperty("--paper", selected.paper);
    return () => {
      if (previous)
        document.documentElement.style.setProperty("--paper", previous);
      else document.documentElement.style.removeProperty("--paper");
    };
  }, [appearance]);

  const changeAppearance = (next: Appearance) => {
    if (next === appearance) return;
    drag.current = null;
    actuator.current = null;
    cancelAnimationFrame(chargeAnimation.current);
    setActuation(0);
    cancelAnimationFrame(rollerAnimation.current);
    if (pressed) release(pressed);
    setSceneLoaded(false);
    setRendered(false);
    setAppearance(next);
    try {
      localStorage.setItem("tempo.apparatus.v1", next);
    } catch {
      /* Optional preference. */
    }
  };
  useEffect(() => {
    document.title =
      running || status === "paused"
        ? `${minutes}:${seconds} · ${MODE_NAMES[mode]} — Tempo`
        : "Tempo — Time, well spent.";
  }, [minutes, seconds, mode, running, status]);
  useEffect(() => {
    if (notice && lastNotice.current !== notice.id) {
      lastNotice.current = notice.id;
      audio.current?.bell();
    }
  }, [notice]);
  useEffect(() => {
    const handle = (event: globalThis.KeyboardEvent) => {
      if (
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        dialog.current?.open
      )
        return;
      const target = event.target as HTMLElement;
      if (
        target.closest(
          "input, textarea, button, [role='slider'], [contenteditable='true']",
        )
      )
        return;
      if (event.code === "Space") {
        event.preventDefault();
        press("start", "start");
        toggle();
      }
      if (event.key.toLowerCase() === "r") {
        pulse("reset", "reset");
        reset();
      }
      if (event.key.toLowerCase() === "m") toggleSound();
    };
    const keyup = (event: globalThis.KeyboardEvent) => {
      if (event.code === "Space") release("start");
    };
    window.addEventListener("keydown", handle);
    window.addEventListener("keyup", keyup);
    return () => {
      window.removeEventListener("keydown", handle);
      window.removeEventListener("keyup", keyup);
    };
    // Stable timer actions read the latest session. Sound reads its ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggle, reset, press, release, pulse]);

  const onReady = useCallback((available: boolean) => {
    setRendered(available);
    setSceneLoaded(true);
  }, []);
  const click = (kind: ClickSound) => audio.current?.click(kind);
  const toggleSound = (playSound = true) => {
    const next = !soundRef.current;
    audio.current?.setEnabled(next);
    if (next && playSound) audio.current?.click("toggle");
    soundRef.current = next;
    setSound(next);
  };
  const chooseMode = (next: Mode) => {
    if (locked || next === mode) return;
    selectMode(next);
  };
  const openDialog = (
    kind: "settings" | "guide",
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    dialogOpener.current = event.currentTarget;
    setDialogKind(kind);
    dialog.current?.showModal();
  };
  const closeDialog = () => {
    dialog.current?.close();
  };
  const pointerAngle = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return Math.atan2(
      event.clientY - bounds.top - bounds.height / 2,
      event.clientX - bounds.left - bounds.width / 2,
    );
  };
  const startDrag = (
    kind: "dial" | "roller" | "selector",
    event: PointerEvent<HTMLElement>,
  ) => {
    if (
      event.button !== 0 ||
      !event.isPrimary ||
      drag.current ||
      (kind !== "roller" && locked)
    )
      return;
    cancelAnimationFrame(rollerAnimation.current);
    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = event.currentTarget.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const radius = bounds.width / 2;
    drag.current = {
      kind,
      pointerId: event.pointerId,
      centerX,
      centerY,
      radius,
      vertical:
        Math.hypot(event.clientX - centerX, event.clientY - centerY) <
        radius * 0.4,
      startY: event.clientY,
      startX: event.clientX,
      width: bounds.width,
      startMinutes: durations[mode],
      startMode: modes.indexOf(mode),
      lastAngle: pointerAngle(event),
      accumulated: 0,
      base: rollerCurrent.current,
      moved: false,
      lastY: event.clientY,
      lastTime: performance.now(),
      velocity: 0,
    };
  };
  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const value = drag.current;
    if (!value || event.pointerId !== value.pointerId) return;
    if (value.kind === "selector") {
      if (
        !value.moved &&
        Math.hypot(event.clientX - value.startX, event.clientY - value.startY) <
          3
      )
        return;
      const index =
        appearance === "dieselpunk" || value.vertical
          ? value.startMode +
            Math.round((event.clientX - value.startX) / (value.width / 3))
          : Math.round(
              Math.atan2(
                event.clientX - value.centerX,
                value.centerY - event.clientY,
              ) /
                0.95 +
                1,
            );
      const next = modes[Math.max(0, Math.min(2, index))];
      if (next !== mode) {
        chooseMode(next);
        click("dial");
      }
      value.moved = true;
      return;
    }
    if (value.kind === "roller") {
      const next = value.base + (event.clientY - value.startY) * 0.075;
      const now = performance.now();
      value.velocity = Math.max(
        -22,
        Math.min(
          22,
          ((event.clientY - value.lastY) * 0.075) /
            Math.max(0.008, (now - value.lastTime) / 1000),
        ),
      );
      value.lastY = event.clientY;
      value.lastTime = now;
      if (Math.abs(next - rollerCurrent.current) > 0.06) value.moved = true;
      if (Math.floor(next / 0.16) !== Math.floor(rollerCurrent.current / 0.16))
        click("roller");
      rollerCurrent.current = next;
      setRollerAngle(next);
      return;
    }
    const distance = Math.hypot(
      event.clientX - value.centerX,
      event.clientY - value.centerY,
    );
    const angle = Math.atan2(
      event.clientY - value.centerY,
      event.clientX - value.centerX,
    );
    let delta = angle - value.lastAngle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    if (distance > value.radius * 0.3) value.accumulated += delta;
    value.lastAngle = angle;
    const movement =
      appearance === "cyberpunk" && rendered
        ? (event.clientX - value.startX) / value.width
        : appearance === "arcane" && rendered
          ? (value.startY - event.clientY) / Math.max(120, value.width * 4)
          : value.vertical
            ? (value.startY - event.clientY) / (value.radius * 2.5)
            : value.accumulated / (Math.PI * 1.5);
    const next = Math.min(
      maximum,
      Math.max(
        minimum,
        value.startMinutes +
          Math.round((movement * (maximum - minimum)) / step) * step,
      ),
    );
    if (next !== durations[mode]) {
      click("dial");
      setDuration(mode, next);
    }
  };
  const endDrag = (event: PointerEvent<HTMLElement>) => {
    const value = drag.current;
    if (!value || event.pointerId !== value.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    // Pointer click is handled here so a drag cannot generate an extra click.
    if (
      value.kind === "selector" &&
      !value.moved &&
      event.type !== "pointercancel"
    ) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const index =
        appearance === "dieselpunk"
          ? Math.floor(((event.clientX - bounds.left) / bounds.width) * 3)
          : Math.round(
              Math.atan2(
                event.clientX - value.centerX,
                value.centerY - event.clientY,
              ) /
                0.95 +
                1,
            );
      const next = modes[Math.max(0, Math.min(2, index))];
      if (next !== mode) {
        chooseMode(next);
        click("dial");
      }
    }
    if (
      value.kind === "roller" &&
      !value.moved &&
      event.type !== "pointercancel"
    ) {
      rollerCurrent.current += 0.8;
      setRollerAngle(rollerCurrent.current);
      click("roller");
    } else if (
      value.kind === "roller" &&
      event.type !== "pointercancel" &&
      !reducedMotion
    ) {
      let velocity =
        performance.now() - value.lastTime < 100 ? value.velocity : 0;
      let last = performance.now();
      const coast = (now: number) => {
        const dt = Math.min((now - last) / 1000, 0.04);
        last = now;
        velocity *= Math.exp(-dt * 5.2);
        const next = rollerCurrent.current + velocity * dt;
        if (
          Math.floor(next / 0.16) !== Math.floor(rollerCurrent.current / 0.16)
        )
          click("roller");
        rollerCurrent.current = next;
        setRollerAngle(next);
        if (Math.abs(velocity) > 0.08)
          rollerAnimation.current = requestAnimationFrame(coast);
      };
      rollerAnimation.current = requestAnimationFrame(coast);
    }
  };
  const cancelDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    cancelAnimationFrame(rollerAnimation.current);
  };
  const turnDial = (event: KeyboardEvent<HTMLDivElement>) => {
    if (locked) return;
    const direction = ["ArrowRight", "ArrowUp"].includes(event.key)
      ? 1
      : ["ArrowLeft", "ArrowDown"].includes(event.key)
        ? -1
        : 0;
    if (direction || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next =
        event.key === "Home"
          ? minimum
          : event.key === "End"
            ? maximum
            : durations[mode] + direction * step;
      setDuration(mode, next);
      click("dial");
    }
  };

  const cancelActuator = () => {
    if (!actuator.current) return;
    actuator.current = null;
    cancelAnimationFrame(chargeAnimation.current);
    setActuation(0);
    release("start");
  };
  const primaryBinding = bind("start", "start", toggle);
  const usesActuator =
    rendered && ["steampunk", "dieselpunk", "arcane"].includes(appearance);
  const startBinding = usesActuator
    ? {
        ...primaryBinding,
        onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
          if (
            event.button !== 0 ||
            !event.isPrimary ||
            actuator.current ||
            !hydrated ||
            !press("start", "start")
          )
            return;
          const bounds = event.currentTarget.getBoundingClientRect();
          actuator.current = {
            pointer: event.pointerId,
            y: event.clientY,
            travel: Math.max(
              28,
              bounds.height * (appearance === "steampunk" ? 0.65 : 0.48),
            ),
            at: performance.now(),
            progress: 0,
            hold: appearance === "arcane",
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          if (appearance === "arcane") {
            const charge = (now: number) => {
              const value = actuator.current;
              if (!value || !value.hold) return;
              value.progress = Math.min(1, (now - value.at) / 700);
              setActuation(value.progress);
              if (value.progress < 1)
                chargeAnimation.current = requestAnimationFrame(charge);
            };
            chargeAnimation.current = requestAnimationFrame(charge);
          }
        },
        onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
          const value = actuator.current;
          if (!value || value.pointer !== event.pointerId || value.hold) return;
          value.progress = Math.max(
            0,
            Math.min(1, (event.clientY - value.y) / value.travel),
          );
          setActuation(value.progress);
        },
        onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
          const value = actuator.current;
          if (!value || value.pointer !== event.pointerId) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const inside =
            event.clientX >= bounds.left &&
            event.clientX <= bounds.right &&
            (!value.hold ||
              (event.clientY >= bounds.top && event.clientY <= bounds.bottom));
          const complete =
            inside &&
            (value.hold
              ? performance.now() - value.at >= 700
              : value.progress >= 0.72);
          cancelActuator();
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
          if (complete) toggle();
        },
        onPointerCancel: cancelActuator,
        onLostPointerCapture: cancelActuator,
        onBlur: () => {
          cancelActuator();
          primaryBinding.onBlur();
        },
        // Native keyboard activation remains available without a timed gesture.
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
          if (event.detail === 0) primaryBinding.onClick(event);
        },
      }
    : primaryBinding;

  return (
    <div className="tempo-app" data-style={appearance}>
      <header className="site-header">
        <Link href="/" className="wordmark" aria-label="Tempo home">
          <span className="brand-symbol" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          tempo<span className="wordmark-period">.</span>
        </Link>
        <span className="header-descriptor">A FOCUS INSTRUMENT</span>
        <div className="header-actions">
          <button
            className="icon-button sound-button"
            onClick={() => toggleSound()}
            aria-label={
              sound ? "Mute mechanical sounds" : "Enable mechanical sounds"
            }
            aria-pressed={sound}
            title={sound ? "Sound on · M" : "Sound off · M"}
          >
            <Icon name={sound ? "sound" : "muted"} />
            <span>Sound {sound ? "on" : "off"}</span>
          </button>
          <span className="header-divider" />
          <button
            className="icon-button"
            onClick={(event) => openDialog("settings", event)}
            aria-label="Settings"
            title="Settings"
          >
            <Icon name="settings" />
          </button>
          <button
            className="icon-button"
            onClick={(event) => openDialog("guide", event)}
            aria-label="How to use Tempo"
            title="A quick guide"
          >
            <Icon name="help" />
          </button>
        </div>
      </header>

      <main className="workspace">
        <section
          className="workspace-heading"
          aria-labelledby="workspace-title"
        >
          <div>
            <p className="eyebrow">
              <span />
              YOUR TIME. YOUR TEMPO.
            </p>
            <h1 id="workspace-title">
              Time, <em>well spent.</em>
            </h1>
          </div>
          <p className="heading-note">
            Pick one thing. Find your rhythm.
            <br />
            Let the rest wait a little.
          </p>
        </section>

        <StyleSwitcher value={appearance} onChange={changeAppearance} />

        <section
          className={`instrument ${rendered ? "is-rendered" : "is-fallback"} ${sceneLoaded ? "is-loaded" : "is-loading"} ${running ? "is-running" : ""}`}
          aria-label="Pomodoro focus instrument"
          aria-busy={!sceneLoaded}
        >
          {!sceneLoaded && (
            <span className="instrument-loading" role="status">
              Собираем аппарат<span>· · ·</span>
            </span>
          )}
          <div className="instrument-shadow" aria-hidden="true" />
          <div className="fallback-housing" aria-hidden="true" />
          <Scene
            appearance={appearance}
            mode={mode}
            running={running}
            status={status}
            remaining={remaining}
            duration={durations[mode]}
            sound={sound}
            auto={auto}
            dialAngle={dialAngle}
            durationFraction={durationFraction}
            actuation={actuation}
            rollerAngle={rollerAngle}
            pressed={pressed}
            reducedMotion={reducedMotion}
            compact={compact}
            round={round}
            cycleCompleted={cycleCompleted}
            onReady={onReady}
          />
          <div className="instrument-face">
            <span className="plate-brand">
              TEMPO <span>—</span> Nº 01
            </span>
            <span className="plate-edition">THE FOCUS EDITION</span>
            <div
              className="mode-bank"
              role="group"
              aria-label="Session mode"
              aria-hidden={
                rendered &&
                ["steampunk", "soviet", "dieselpunk"].includes(appearance)
                  ? true
                  : undefined
              }
            >
              {modes.map((item) => (
                <button
                  key={item}
                  data-control={item}
                  className={`mode-key ${mode === item ? "is-selected" : ""} ${pressed === item ? "is-pressed" : ""}`}
                  aria-pressed={mode === item}
                  tabIndex={
                    rendered &&
                    ["steampunk", "soviet", "dieselpunk"].includes(appearance)
                      ? -1
                      : 0
                  }
                  style={
                    rendered &&
                    ["steampunk", "soviet", "dieselpunk"].includes(appearance)
                      ? { pointerEvents: "none" }
                      : undefined
                  }
                  disabled={!hydrated}
                  aria-disabled={locked}
                  title={
                    locked
                      ? "Reset the session to change mode"
                      : MODE_NAMES[item]
                  }
                  {...bind(item, "key", () => chooseMode(item))}
                >
                  <span className="key-surface">
                    {item === "focus"
                      ? "FOCUS"
                      : item === "short"
                        ? "SHORT REST"
                        : "LONG REST"}
                  </span>
                </button>
              ))}
            </div>
            <div
              hidden={
                !rendered ||
                !["steampunk", "soviet", "dieselpunk"].includes(appearance)
              }
              className="physical-selector"
              data-control="selector"
              role="slider"
              tabIndex={0}
              aria-label="Session mode selector. Drag to select Focus, Short rest or Long rest."
              aria-valuemin={0}
              aria-valuemax={2}
              aria-valuenow={modes.indexOf(mode)}
              aria-valuetext={MODE_NAMES[mode]}
              aria-disabled={locked}
              onPointerDown={(event) => startDrag("selector", event)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onLostPointerCapture={cancelDrag}
              onKeyDown={(event) => {
                const direction = ["ArrowRight", "ArrowUp"].includes(event.key)
                  ? 1
                  : ["ArrowLeft", "ArrowDown"].includes(event.key)
                    ? -1
                    : 0;
                if (!locked && direction) {
                  event.preventDefault();
                  chooseMode(
                    modes[
                      Math.max(0, Math.min(2, modes.indexOf(mode) + direction))
                    ],
                  );
                  click("dial");
                }
              }}
              title={
                locked
                  ? "Reset to change mode"
                  : "Drag the selector · arrow keys to choose a mode"
              }
            />
            <div className="cycle-label" aria-label={`Session ${round} of 4`}>
              <span>SESSION</span>
              <b>{String(round).padStart(2, "0")} / 04</b>
            </div>
            <div className="display-glass">
              <div className="display-topline">
                <span>
                  <i
                    className={running ? "status-light active" : "status-light"}
                  />
                  {running
                    ? mode === "focus"
                      ? "IN THE FLOW"
                      : "TAKE IT SLOW"
                    : status === "paused"
                      ? "ON HOLD"
                      : "READY WHEN YOU ARE"}
                </span>
                <span>{MODE_NAMES[mode].toUpperCase()}</span>
              </div>
              <output
                className="time-display"
                aria-label={`${Math.floor(remaining / 60)} minutes ${remaining % 60} seconds remaining`}
              >
                <Digit value={minutes[0]} />
                <Digit value={minutes[1]} />
                <span className="display-colon" aria-hidden="true">
                  <i />
                  <i />
                </span>
                <Digit value={seconds[0]} />
                <Digit value={seconds[1]} />
              </output>
              <div className="display-bottomline">
                <span>
                  {status === "paused"
                    ? "A BREATH. THEN BACK TO IT."
                    : mode === "focus"
                      ? "ONE THING AT A TIME"
                      : "A LITTLE ROOM TO RECHARGE"}
                </span>
                <div className="display-progress" aria-hidden="true">
                  <i
                    style={{
                      width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <div
              className={`duration-dial ${locked ? "is-locked" : ""}`}
              role="slider"
              data-control="dial"
              tabIndex={0}
              aria-label={`${MODE_NAMES[mode]} duration. ${operatingGuide.duration}`}
              aria-valuemin={minimum}
              aria-valuemax={maximum}
              aria-valuenow={durations[mode]}
              aria-valuetext={`${durations[mode]} minutes${locked ? "; reset the session to adjust" : ""}`}
              aria-disabled={locked}
              onKeyDown={turnDial}
              onPointerDown={(event) => startDrag("dial", event)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onLostPointerCapture={cancelDrag}
              title={
                locked
                  ? "Reset to adjust duration"
                  : `${operatingGuide.duration} · arrow keys to adjust`
              }
            >
              <div className="fallback-dial" aria-hidden="true">
                <i style={{ transform: `rotate(${dialAngle}rad)` }} />
              </div>
              <div className="dial-center">
                <b>{durations[mode]}</b>
                <span>MINUTES</span>
              </div>
            </div>
            <span className="dial-bound dial-bound-min">
              {String(minimum).padStart(2, "0")}
            </span>
            <span className="dial-bound dial-bound-max">{maximum}</span>
            <span className="dial-caption">
              {locked ? "SESSION IN PROGRESS" : "TURN TO SET YOUR TIME"}
            </span>
            <button
              className={`start-key ${pressed === "start" ? "is-pressed" : ""}`}
              data-control="start"
              aria-label={`${label}. ${operatingGuide.start}`}
              title={operatingGuide.start}
              disabled={!hydrated}
              {...startBinding}
            >
              <span className="key-surface">
                <Icon name={running ? "pause" : "play"} size={16} />
                <span>{label}</span>
                <kbd>SPACE</kbd>
              </span>
            </button>
            <button
              className={`reset-key ${pressed === "reset" ? "is-pressed" : ""}`}
              data-control="reset"
              aria-label="Reset session"
              title="Reset · R"
              disabled={!hydrated}
              {...bind("reset", "reset", reset)}
            >
              <span className="key-surface">
                <Icon name="reset" size={17} />
              </span>
            </button>
            <div className="control-rule" aria-hidden="true" />
            <button
              className="toggle-control sound-toggle"
              data-control="sound"
              role="switch"
              aria-checked={sound}
              aria-label="Mechanical sounds"
              {...bind("sound", "toggle", () => toggleSound(false))}
            >
              <span
                className={`fallback-lever ${sound ? "is-on" : ""}`}
                aria-hidden="true"
              />
              <span className="toggle-label">
                SOUND<b>{sound ? "ON" : "OFF"}</b>
              </span>
            </button>
            <button
              className="toggle-control auto-toggle"
              data-control="auto"
              role="switch"
              aria-checked={auto}
              aria-label="Automatically start the next session"
              title="Automatically start the next focus or break"
              {...bind("auto", "toggle", () => setAuto(!auto))}
            >
              <span
                className={`fallback-lever ${auto ? "is-on" : ""}`}
                aria-hidden="true"
              />
              <span className="toggle-label">
                AUTO FLOW<b>{auto ? "ON" : "OFF"}</b>
              </span>
            </button>
            <button
              className="fidget-roller"
              data-control="roller"
              aria-label="Fidget roller. Drag up or down, or press to spin."
              onPointerDown={(event) => startDrag("roller", event)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onLostPointerCapture={cancelDrag}
              onClick={(event) => {
                if (event.detail === 0) {
                  rollerCurrent.current += 0.8;
                  setRollerAngle(rollerCurrent.current);
                  click("roller");
                }
              }}
            >
              <span
                className="fallback-roller"
                aria-hidden="true"
                style={{ backgroundPositionY: `${rollerAngle * 10}px` }}
              />
            </button>
            <button
              className={`fidget-clicker ${pressed === "clicker" ? "is-pressed" : ""}`}
              data-control="clicker"
              aria-label="Fidget clicker"
              {...bind("clicker", "clicker", () => {})}
            >
              <span className="fallback-clicker" aria-hidden="true">
                ◇
              </span>
            </button>
            <span className="fidget-label">A LITTLE PLAY. A CLEARER MIND.</span>
          </div>
        </section>
        <div className="instrument-underneath">
          <span>
            <i />
            {running
              ? "A little less noise. A little more you."
              : status === "paused"
                ? "Your place is saved. Come back when you’re ready."
                : "Made for a slower, better kind of productive."}
          </span>
          <span className="operating-hint">{operatingGuide.hint}</span>
        </div>

        <section className="session-desk" aria-label="Your session">
          <div className="intention-card">
            <label htmlFor="intention">
              <span className="small-star" aria-hidden="true">
                ✳
              </span>{" "}
              WHAT’S YOUR ONE THING?
            </label>
            <div className="intention-input">
              <input
                id="intention"
                value={intention}
                maxLength={120}
                onChange={(event) => setIntention(event.target.value)}
                placeholder="Give this session a little purpose…"
                autoComplete="off"
              />
              <span aria-hidden="true">
                <Icon name="arrow" />
              </span>
            </div>
          </div>
          <div className="today-card">
            <span className="desk-label">A LITTLE PROGRESS, TODAY</span>
            <div className="today-values">
              <div>
                <b>{String(stats.sessions).padStart(2, "0")}</b>
                <span>sessions</span>
              </div>
              <i />
              <div>
                <b>
                  {Math.round(stats.seconds / 60)}
                  <small>m</small>
                </b>
                <span>of focus</span>
              </div>
              <div className="session-dots" aria-hidden="true">
                {[1, 2, 3, 4].map((item) => (
                  <i
                    key={item}
                    className={item <= cycleCompleted ? "complete" : ""}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
        <div className="notice" role="status" aria-live="polite">
          {notice?.message || ""}
        </div>
      </main>
      <footer className="site-footer">
        <span>Less rush. More rhythm.</span>
        <span>DESIGNED TO FEEL GOOD.</span>
        <button onClick={(event) => openDialog("guide", event)}>
          A quick guide <Icon name="arrow" size={14} />
        </button>
      </footer>

      <dialog
        className="tempo-dialog"
        ref={dialog}
        aria-labelledby="dialog-title"
        onClose={() => {
          setDialogKind(null);
          dialogOpener.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            )
              closeDialog();
          }
        }}
      >
        <button
          className="dialog-close icon-button"
          onClick={closeDialog}
          aria-label="Close dialog"
          autoFocus
        >
          <Icon name="close" />
        </button>
        {dialogKind === "settings" ? (
          <>
            <p className="eyebrow">YOUR OWN RHYTHM</p>
            <h2 id="dialog-title">
              Make it <em>yours.</em>
            </h2>
            <p className="dialog-description">
              A little tuning goes a long way.
            </p>
            <fieldset className="duration-settings" disabled={locked}>
              <legend>SESSION LENGTHS</legend>
              {modes.map((item) => (
                <label key={item}>
                  <span>{MODE_NAMES[item]}</span>
                  <div>
                    <DurationInput
                      mode={item}
                      value={durations[item]}
                      onCommit={setDuration}
                    />
                    <span>min</span>
                  </div>
                </label>
              ))}
            </fieldset>
            {locked && (
              <p className="settings-note">
                Reset your current session to change its length.
              </p>
            )}
            <label className="volume-setting">
              <span>
                Mechanical sound<span>{Math.round(volume * 100)}%</span>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                aria-label="Mechanical sound volume"
                onChange={(event) => setVolume(Number(event.target.value))}
                onPointerUp={() => click("key")}
              />
            </label>
            <button className="dialog-done" onClick={closeDialog}>
              All set <Icon name="arrow" size={17} />
            </button>
          </>
        ) : (
          <>
            <p className="eyebrow">WELCOME TO TEMPO</p>
            <h2 id="dialog-title">
              Find your <em>rhythm.</em>
            </h2>
            <p className="dialog-description">
              One small ritual. A little more space to think.
            </p>
            <ol className="guide-steps">
              <li>
                <span>01</span>
                <div>
                  <b>Choose your one thing.</b>
                  <p>
                    Write a small intention. {operatingGuide.duration} to set
                    your session length.
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <b>{operatingGuide.start}.</b>
                  <p>
                    Focus, then take a short break. After four sessions, enjoy a
                    longer rest.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <b>Keep your hands happy.</b>
                  <p>
                    Move the small free mechanism or press the auxiliary
                    control. The gear, spring, piston and pendulum are just for
                    the joy of it.
                  </p>
                </div>
              </li>
            </ol>
            <p className="guide-auto">
              Flip <b>Auto flow</b> to start each next session automatically.
              Your timer and today’s progress stay on this device.
            </p>
            <div className="keyboard-guide">
              <span>
                <kbd>SPACE</kbd> Play / pause
              </span>
              <span>
                <kbd>R</kbd> Reset
              </span>
              <span>
                <kbd>M</kbd> Sound
              </span>
            </div>
            <button className="dialog-done" onClick={closeDialog}>
              Sounds good <Icon name="arrow" size={17} />
            </button>
          </>
        )}
      </dialog>
    </div>
  );
}
