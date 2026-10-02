import { useCallback, useEffect, useRef, useState } from "react";

export type Mode = "focus" | "short" | "long";
export type Durations = Record<Mode, number>;
export type TimerStatus = "ready" | "running" | "paused";

type Session = {
  mode: Mode;
  status: TimerStatus;
  remaining: number;
  pausedRemaining: number | null;
  deadline: number | null;
  durations: Durations;
  cycleCompleted: number;
  auto: boolean;
  intention: string;
  stats: { date: string; sessions: number; seconds: number };
  notice: { id: number; message: string } | null;
};

export const MODE_NAMES: Record<Mode, string> = {
  focus: "Focus",
  short: "Short break",
  long: "Long break",
};
export const LIMITS: Record<Mode, [number, number, number]> = {
  focus: [5, 90, 5],
  short: [1, 30, 1],
  long: [5, 60, 5],
};
const STORAGE = "tempo.session.v2";
const LEGACY_STORAGE = "tempo.session.v1";
export const today = (timestamp = Date.now()) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
};
const initialSession = (): Session => ({
  mode: "focus",
  status: "ready",
  remaining: 1500,
  pausedRemaining: null,
  deadline: null,
  durations: { focus: 25, short: 5, long: 15 },
  cycleCompleted: 0,
  auto: false,
  intention: "",
  stats: { date: today(), sessions: 0, seconds: 0 },
  notice: null,
});
const bounded = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;

function restore(): Session {
  const defaults = initialSession();
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE) ||
        localStorage.getItem(LEGACY_STORAGE) ||
        "null",
    );
    if (!saved || ![1, 2].includes(saved.version)) return defaults;
    const mode: Mode = ["focus", "short", "long"].includes(saved.mode)
      ? saved.mode
      : "focus";
    const legacyRound = bounded(saved.round, 1, 4, 1);
    const cycleCompleted =
      saved.version === 2
        ? bounded(saved.cycleCompleted, 0, 4, 0)
        : legacyRound - (mode === "focus" ? 1 : 0);
    const durations = { ...defaults.durations };
    for (const key of Object.keys(durations) as Mode[]) {
      durations[key] = bounded(
        saved.durations?.[key],
        LIMITS[key][0],
        LIMITS[key][1],
        durations[key],
      );
    }
    const status: TimerStatus = ["ready", "running", "paused"].includes(
      saved.status,
    )
      ? saved.status
      : "ready";
    const deadline =
      status === "running" &&
      typeof saved.deadline === "number" &&
      Number.isFinite(saved.deadline) &&
      saved.deadline <= Date.now() + durations[mode] * 60000
        ? saved.deadline
        : null;
    return {
      ...defaults,
      mode,
      durations,
      status: status === "running" && !deadline ? "ready" : status,
      deadline,
      pausedRemaining:
        status === "paused"
          ? bounded(
              saved.pausedRemaining,
              1,
              durations[mode] * 60000,
              bounded(
                saved.remaining,
                1,
                durations[mode] * 60,
                durations[mode] * 60,
              ) * 1000,
            )
          : null,
      remaining: deadline
        ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
        : bounded(
            saved.remaining,
            1,
            durations[mode] * 60,
            durations[mode] * 60,
          ),
      cycleCompleted:
        mode === "focus" && cycleCompleted === 4 ? 0 : cycleCompleted,
      auto: saved.auto === true,
      intention:
        typeof saved.intention === "string"
          ? saved.intention.slice(0, 120)
          : "",
      stats:
        saved.stats?.date === today()
          ? {
              date: today(),
              sessions: bounded(saved.stats.sessions, 0, 1000, 0),
              seconds: bounded(saved.stats.seconds, 0, 86400, 0),
            }
          : defaults.stats,
    };
  } catch {
    return defaults;
  }
}

function snapshot(session: Session) {
  return JSON.stringify({
    ...session,
    version: 2,
    remaining: session.status === "running" ? null : session.remaining,
    notice: undefined,
  });
}

export function useFocusTimer() {
  const [session, setSession] = useState<Session>(initialSession);
  const [hydrated, setHydrated] = useState(false);
  const current = useRef(session);
  const storageReady = useRef(false);
  const savedSnapshot = useRef<string | null>(null);
  const commit = useCallback((next: Session) => {
    current.current = next;
    setSession(next);
    // Persist actions synchronously so another tab cannot finish the same session again.
    if (storageReady.current) {
      const saved = snapshot(next);
      if (saved !== savedSnapshot.current) {
        try {
          localStorage.setItem(STORAGE, saved);
          savedSnapshot.current = saved;
        } catch {
          /* The timer still works when browser storage is unavailable. */
        }
      }
    }
  }, []);

  useEffect(() => {
    storageReady.current = true;
    commit(restore());
    setHydrated(true);
    const tick = () => {
      let value = current.current;
      if (value.stats.date !== today()) {
        value = { ...value, stats: initialSession().stats };
        commit(value);
      }
      if (value.status !== "running" || value.deadline === null) return;
      const remaining = Math.max(
        0,
        Math.ceil((value.deadline - Date.now()) / 1000),
      );
      if (remaining > 0) {
        if (remaining !== value.remaining) commit({ ...value, remaining });
        return;
      }
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
        if (
          saved &&
          (saved.status !== "running" ||
            saved.deadline !== value.deadline ||
            saved.mode !== value.mode)
        ) {
          commit(restore());
          return;
        }
      } catch {
        /* Continue locally if storage is unavailable. */
      }
      const focused = value.mode === "focus";
      // Only completing focus advances the cycle. Manual or skipped rests don't.
      const completed = focused
        ? value.cycleCompleted + 1
        : value.cycleCompleted;
      const nextMode: Mode = focused
        ? completed === 4
          ? "long"
          : "short"
        : "focus";
      const cycleCompleted =
        nextMode === "focus" && completed === 4 ? 0 : completed;
      const stats =
        value.stats.date === today() ? value.stats : initialSession().stats;
      // An overdue restored session completes once. It never fabricates a chain of sessions.
      commit({
        ...value,
        mode: nextMode,
        cycleCompleted,
        remaining: value.durations[nextMode] * 60,
        pausedRemaining: null,
        status: value.auto ? "running" : "ready",
        deadline: value.auto
          ? Date.now() + value.durations[nextMode] * 60000
          : null,
        stats:
          focused && today(value.deadline) === today()
            ? {
                date: today(),
                sessions: stats.sessions + 1,
                seconds: stats.seconds + value.durations.focus * 60,
              }
            : stats,
        notice: {
          id: Date.now(),
          message: focused
            ? `Focus complete. Time for a ${nextMode === "long" ? "long" : "short"} break.`
            : "A fresh start. Ready when you are.",
        },
      });
    };
    const sync = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || event.key !== STORAGE) return;
      const restored = restore();
      savedSnapshot.current = snapshot(restored);
      commit(restored);
      tick();
    };
    tick();
    const interval = window.setInterval(tick, 250);
    window.addEventListener("visibilitychange", tick);
    window.addEventListener("storage", sync);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("visibilitychange", tick);
      window.removeEventListener("storage", sync);
      storageReady.current = false;
    };
  }, [commit]);

  const toggle = useCallback(() => {
    if (!storageReady.current) return;
    const value = current.current;
    if (value.status === "running") {
      if (value.deadline !== null && value.deadline <= Date.now()) return;
      const pausedRemaining = Math.max(
        1,
        (value.deadline ?? Date.now()) - Date.now(),
      );
      commit({
        ...value,
        remaining: Math.ceil(pausedRemaining / 1000),
        status: "paused",
        pausedRemaining,
        deadline: null,
        notice: null,
      });
    } else {
      commit({
        ...value,
        status: "running",
        deadline:
          Date.now() + (value.pausedRemaining ?? value.remaining * 1000),
        pausedRemaining: null,
        notice: null,
      });
    }
  }, [commit]);
  const reset = useCallback(() => {
    const value = current.current;
    commit({
      ...value,
      status: "ready",
      remaining: value.durations[value.mode] * 60,
      pausedRemaining: null,
      deadline: null,
      notice: null,
    });
  }, [commit]);
  const selectMode = useCallback(
    (mode: Mode) => {
      const value = current.current;
      if (value.status !== "ready" || mode === value.mode) return;
      commit({
        ...value,
        mode,
        cycleCompleted:
          mode === "focus" && value.cycleCompleted === 4
            ? 0
            : value.cycleCompleted,
        remaining: value.durations[mode] * 60,
        pausedRemaining: null,
        notice: null,
      });
    },
    [commit],
  );
  const setDuration = useCallback(
    (mode: Mode, minutes: number) => {
      const value = current.current;
      if (value.status !== "ready") return;
      const duration = bounded(
        minutes,
        LIMITS[mode][0],
        LIMITS[mode][1],
        value.durations[mode],
      );
      commit({
        ...value,
        durations: { ...value.durations, [mode]: duration },
        remaining: value.mode === mode ? duration * 60 : value.remaining,
      });
    },
    [commit],
  );
  const setAuto = useCallback(
    (auto: boolean) => commit({ ...current.current, auto }),
    [commit],
  );
  const setIntention = useCallback(
    (intention: string) =>
      commit({ ...current.current, intention: intention.slice(0, 120) }),
    [commit],
  );
  return {
    session,
    hydrated,
    toggle,
    reset,
    selectMode,
    setDuration,
    setAuto,
    setIntention,
  };
}
