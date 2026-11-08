export type Direction = "forward" | "backward" | "left" | "right";
export type Tracks = { left: -1 | 0 | 1; right: -1 | 0 | 1 };

export const DIRECTIONS: readonly Direction[] = ["forward", "backward", "left", "right"];
export const LABELS: Record<Direction, string> = {
  forward: "Forward", backward: "Reverse", left: "Turning left", right: "Turning right",
};

const KEYS: Record<string, Direction> = {
  w: "forward", arrowup: "forward",
  s: "backward", arrowdown: "backward",
  a: "left", arrowleft: "left",
  d: "right", arrowright: "right",
};
export const STOP_KEY = " ";

export function directionOf(key: string): Direction | null {
  return KEYS[key.toLowerCase()] ?? null;
}

const TRACKS: Record<Direction, Tracks> = {
  forward: { left: 1, right: 1 },
  backward: { left: -1, right: -1 },
  left: { left: -1, right: 1 },
  right: { left: 1, right: -1 },
};

export function tracksOf(direction: Direction | null): Tracks {
  return direction ? TRACKS[direction] : { left: 0, right: 0 };
}

export const SPEED_MIN = 10;
export const SPEED_MAX = 100;
export const SPEED_PRESETS = [25, 50, 75, 100];

export const STICK_DEADZONE = 0.18; // Fraction of pad radius
export const STICK_STEP = 5; // pct, else every pointer event is a command

// dx right-positive, up up-positive. ponytail: quadrants, not arcade mixing. Mix once drive carries per-track speeds.
export function stickDirection(dx: number, up: number): Direction {
  const deg = (Math.atan2(up, dx) * 180) / Math.PI;
  if (deg >= -45 && deg < 45) return "right";
  if (deg >= 45 && deg < 135) return "forward";
  if (deg >= -135 && deg < -45) return "backward";
  return "left";
}

export function clampToPad(dx: number, up: number): { dx: number; up: number } {
  const m = Math.hypot(dx, up);
  return m <= 1 ? { dx, up } : { dx: dx / m, up: up / m };
}

// Null inside dead zone
export function resolveStick(dx: number, up: number, minPct: number, maxPct: number): { direction: Direction; pct: number } | null {
  const m = Math.min(1, Math.hypot(dx, up));
  if (m < STICK_DEADZONE) return null;
  const t = (m - STICK_DEADZONE) / (1 - STICK_DEADZONE);
  const stepped = Math.round((minPct + t * (maxPct - minPct)) / STICK_STEP) * STICK_STEP;
  return { direction: stickDirection(dx, up), pct: Math.max(minPct, Math.min(maxPct, stepped)) };
}
