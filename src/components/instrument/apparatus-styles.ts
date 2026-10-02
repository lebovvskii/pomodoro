import type { Mode, TimerStatus } from "@/hooks/use-focus-timer";

export const APPARATUS_STYLES = [
  {
    id: "cyberpunk",
    name: "Киберпанк",
    title: "NEON / 2091",
    detail: "Сенсорный терминал · свайп по шкале",
    icon: "⌘",
    paper: "#0c1017",
  },
  {
    id: "steampunk",
    name: "Стимпанк",
    title: "THE CHRONOMETRIST",
    detail: "Заводной ключ · пуск цепочкой",
    icon: "⚙",
    paper: "#e4d9c3",
  },
  {
    id: "soviet",
    name: "Советский",
    title: "ХРОНОС / 1984",
    detail: "Ламповый пульт · поворотный селектор",
    icon: "✦",
    paper: "#e4e4d7",
  },
  {
    id: "dieselpunk",
    name: "Дизельпанк",
    title: "IRONWORKS / MK IV",
    detail: "Открытый двигатель · рычаг зажигания",
    icon: "▰",
    paper: "#181a18",
  },
  {
    id: "arcane",
    name: "Магический",
    title: "THE AETHER ENGINE",
    detail: "Астролябия · кольцо · заряд сферы",
    icon: "◇",
    paper: "#151221",
  },
] as const;
export type Appearance = (typeof APPARATUS_STYLES)[number]["id"];
export const isAppearance = (value: unknown): value is Appearance =>
  APPARATUS_STYLES.some((style) => style.id === value);
export const OPERATING_GUIDE: Record<
  Appearance,
  { duration: string; start: string; hint: string }
> = {
  cyberpunk: {
    duration: "Swipe the timeline left or right",
    start: "Touch the illuminated pad",
    hint: "Свайп по шкале — время · касание панели — пуск / пауза",
  },
  steampunk: {
    duration: "Turn the winding key",
    start: "Pull the chain down and release",
    hint: "Заводной ключ — время · потяните цепочку вниз и отпустите",
  },
  soviet: {
    duration: "Turn the detented bakelite knob",
    start: "Press the red plunger",
    hint: "Селектор F / S / L — режим · ручка — время · красный плунжер — пуск",
  },
  dieselpunk: {
    duration: "Turn the crank",
    start: "Pull the ignition handle down and release",
    hint: "Кривошип — время · сдвижной селектор — режим · протяните рычаг вниз",
  },
  arcane: {
    duration: "Drag the right edge of the ring up or down",
    start: "Hold the sphere until charged, then release",
    hint: "Правая грань кольца — время · удерживайте сферу 0,7 с и отпустите",
  },
};
export type PhysicalState = {
  appearance: Appearance;
  mode: Mode;
  running: boolean;
  status: TimerStatus;
  remaining: number;
  duration: number;
  sound: boolean;
  auto: boolean;
  dialAngle: number;
  durationFraction: number;
  actuation: number;
  rollerAngle: number;
  pressed: string | null;
  reducedMotion: boolean;
  compact: boolean;
  round: number;
  cycleCompleted: number;
};
export type Anchor = {
  name: string;
  center: import("three").Vector3;
  width: number;
  height: number;
};
