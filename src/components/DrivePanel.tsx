import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { KEEPALIVE_MS, drive, release, stop } from "../core/commands.ts";
import type { Message } from "../core/contract.ts";
import {
  LABELS, SPEED_MAX, SPEED_MIN, SPEED_PRESETS, STOP_KEY, clampToPad, directionOf, resolveStick, tracksOf,
  type Direction,
} from "../core/drive.ts";

// Other stop buttons (e.g. top bar's) fire this so held drive is dropped too
export const STOP_EVENT = "hhart:drive-stop";

const MODE_KEY = "hhart.driveMode";

// Focused range slider isn't text input, WASD must still drive after dragging
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  && (target as HTMLInputElement).type !== "range";

const ICONS = {
  forward: "M7 12.5l5-5 5 5M7 18l5-5 5 5",
  backward: "M7 6l5 5 5-5M7 11.5l5 5 5-5",
  left: "M12 19A6 6 0 1 0 6 13M3 10l3 3 3-3",
  right: "M12 19A6 6 0 1 1 18 13M15 10l3 3 3-3",
};

type Held = { direction: Direction; pct: number; fromStick: boolean };

function DriveKey({ direction, keyHint, label, active, disabled, onStart, onStop }: {
  direction: Direction; keyHint: string; label: string; active: boolean; disabled: boolean;
  onStart: (d: Direction) => void; onStop: () => void;
}) {
  const held = useRef(false);
  // Pointer capture, thumb sliding off button still releases
  const end = () => {
    if (!held.current) return;
    held.current = false;
    onStop();
  };
  const area = { forward: "up", backward: "down", left: "left", right: "right" }[direction];
  return (
    <button
      type="button"
      className={`drive-key drive-key-${area} ${active ? "is-active" : ""}`}
      disabled={disabled}
      aria-label={`${label} (${keyHint})`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        held.current = true;
        onStart(direction);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      <span className="keycap">{keyHint}</span>
      <svg className="drive-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[direction]} /></svg>
      <span className="drive-key-label">{label}</span>
    </button>
  );
}

function Track({ side, sign }: { side: "left" | "right"; sign: number }) {
  const state = sign > 0 ? "fwd" : sign < 0 ? "rev" : "idle";
  return (
    <div className={`track track-${state} track-${side}`} title={`${side} track`}>
      <span className="track-label">{side === "left" ? "L" : "R"}</span>
      <svg className="track-arrow" viewBox="0 0 24 24" aria-hidden="true">
        {state === "fwd" ? <path d="M7 14l5-5 5 5" /> : null}
        {state === "rev" ? <path d="M7 10l5 5 5-5" /> : null}
        {state === "idle" ? <path d="M8 12h8" /> : null}
      </svg>
    </div>
  );
}

function DriveStick({ disabled, maxPct, active, onStick }: {
  disabled: boolean; maxPct: number; active: boolean; onStick: (d: Direction | null, pct: number) => void;
}) {
  const pad = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLSpanElement>(null);
  const dragging = useRef(false);
  const sent = useRef<{ direction: Direction; pct: number } | null>(null);
  const geometry = useRef({ cx: 0, cy: 0, r: 1 });

  const place = (dx: number, up: number) => {
    const { r } = geometry.current;
    if (knob.current) knob.current.style.transform = `translate(calc(-50% + ${dx * r}px), calc(-50% + ${-up * r}px))`;
  };

  useEffect(() => {
    if (active || dragging.current) return;
    sent.current = null;
    place(0, 0);
  }, [active]);

  const track = (e: PointerEvent) => {
    const { cx, cy, r } = geometry.current;
    const { dx, up } = clampToPad((e.clientX - cx) / r, -(e.clientY - cy) / r);
    place(dx, up);
    // Changes only, keepalive handles resends
    const next = resolveStick(dx, up, SPEED_MIN, maxPct);
    if (!next) {
      if (sent.current) {
        sent.current = null;
        onStick(null, 0);
      }
    } else if (!sent.current || sent.current.direction !== next.direction || sent.current.pct !== next.pct) {
      sent.current = next;
      onStick(next.direction, next.pct);
    }
  };

  const end = () => {
    if (!dragging.current) return;
    dragging.current = false;
    pad.current?.removeAttribute("data-dragging");
    sent.current = null;
    place(0, 0);
    onStick(null, 0);
  };

  return (
    <div
      ref={pad}
      className={`drive-stick ${active ? "is-live" : ""}`}
      data-disabled={disabled ? "true" : undefined}
      onPointerDown={(e) => {
        if (disabled || !pad.current || !knob.current) return;
        const rect = pad.current.getBoundingClientRect();
        // Usable radius short by half a knob
        geometry.current = { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2,
          r: Math.max(1, rect.width / 2 - knob.current.offsetWidth / 2) };
        pad.current.setAttribute("data-dragging", "true");
        pad.current.setPointerCapture(e.pointerId);
        dragging.current = true;
        track(e);
      }}
      onPointerMove={(e) => dragging.current && track(e)}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      <svg className="drive-stick-guides" viewBox="0 0 100 100" aria-hidden="true">
        <path className="guide" d="M61 61L83 83M39 39L17 17M61 39L83 17M39 61L17 83" />
        <text x="50" y="10">Fwd</text>
        <text x="50" y="90">Rev</text>
        <text x="10" y="50">L</text>
        <text x="90" y="50">R</text>
      </svg>
      <span ref={knob} className="drive-stick-knob" />
    </div>
  );
}

export function DrivePanel({ send, disabled = false, presets = SPEED_PRESETS }: {
  send: (command: Message) => void; disabled?: boolean; presets?: number[];
}) {
  const [mode, setMode] = useState<"keys" | "stick">(() => (localStorage.getItem(MODE_KEY) === "stick" ? "stick" : "keys"));
  const [speed, setSpeed] = useState(50);
  const [speedDraft, setSpeedDraft] = useState<string | null>(null);
  const [held, setHeld] = useState<Held | null>(null);
  const heldKeys = useRef(new Set<string>());
  const driving = useRef(false);
  driving.current = held !== null;

  const pct = held ? (held.fromStick ? held.pct : speed) : null;

  const start = useCallback((direction: Direction) => {
    if (disabled) return;
    setHeld({ direction, pct: speed, fromStick: false });
    send(drive(direction, speed));
  }, [disabled, send, speed]);

  const end = useCallback(() => {
    heldKeys.current.clear();
    setHeld(null);
    if (!disabled) send(stop());
  }, [disabled, send]);

  const stick = useCallback((direction: Direction | null, stickPct: number) => {
    if (disabled) return;
    if (!direction) return end();
    setHeld({ direction, pct: stickPct, fromStick: true });
    send(drive(direction, stickPct));
  }, [disabled, send, end]);

  useEffect(() => {
    if (!held || disabled || pct === null) return undefined;
    const id = setInterval(() => send(drive(held.direction, pct)), KEEPALIVE_MS);
    return () => clearInterval(id);
  }, [held, pct, disabled, send]);

  // Forget held keys while disconnected, else release then is lost and drive resends on reconnect
  useEffect(() => {
    if (!disabled) return;
    heldKeys.current.clear();
    setHeld(null);
  }, [disabled]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (disabled || e.repeat || isTyping(e.target)) return;
      if (e.key === STOP_KEY) {
        e.preventDefault();
        end();
        return;
      }
      const direction = directionOf(e.key);
      if (direction) {
        e.preventDefault();
        heldKeys.current.add(e.key.toLowerCase());
        start(direction);
      }
    };
    const up = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (!heldKeys.current.has(key)) return;
      heldKeys.current.delete(key);
      const remaining = Array.from(heldKeys.current).at(-1);
      const direction = remaining ? directionOf(remaining) : null;
      if (direction) start(direction);
      else end();
    };
    // Keyup goes to focused window, leaving mid-drive stops only driving window
    const blur = () => driving.current && end();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    window.addEventListener(STOP_EVENT, end);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener(STOP_EVENT, end);
    };
  }, [disabled, start, end]);

  const commitSpeed = (text: string) => {
    const value = Number(text);
    if (text.trim() !== "" && Number.isFinite(value)) setSpeed(Math.round(Math.min(SPEED_MAX, Math.max(SPEED_MIN, value))));
    setSpeedDraft(null);
  };

  const tracks = tracksOf(held?.direction ?? null);
  const keyProps = { disabled, onStart: start, onStop: end };

  return (
    <section className="panel">
      <div className="panel-head">
        <div className="head-group">
          <span className="panel-title">Drive</span>
          <button type="button" className="btn-action" onClick={() => {
            end();
            const next = mode === "keys" ? "stick" : "keys";
            localStorage.setItem(MODE_KEY, next);
            setMode(next);
          }} title={mode === "keys" ? "Swap to the joystick, for touch and for speeds between the presets"
            : "Swap to the keys, laid out as they are on the keyboard"}>
            {mode === "keys" ? "Joystick" : "Keys"}
          </button>
          <button type="button" className="btn-action" onClick={() => send(release())} disabled={disabled}
            title="After a stop, let other controllers drive the robot again">
            Release
          </button>
        </div>
        {held
          ? <span className="chip chip-warn">{LABELS[held.direction]}</span>
          : <span className="chip chip-neutral">{disabled ? "No link" : "Stopped"}</span>}
      </div>

      {mode === "keys" ? (
        <div className="drive-keys">
          <Track side="left" sign={tracks.left} />
          <DriveKey {...keyProps} direction="forward" keyHint="W" label="Forward" active={held?.direction === "forward"} />
          <Track side="right" sign={tracks.right} />
          <DriveKey {...keyProps} direction="left" keyHint="A" label="Left" active={held?.direction === "left"} />
          <DriveKey {...keyProps} direction="backward" keyHint="S" label="Reverse" active={held?.direction === "backward"} />
          <DriveKey {...keyProps} direction="right" keyHint="D" label="Right" active={held?.direction === "right"} />
        </div>
      ) : (
        <div className="drive-stick-panel">
          <div className="drive-stick-tracks">
            <Track side="left" sign={tracks.left} />
            <Track side="right" sign={tracks.right} />
          </div>
          <DriveStick disabled={disabled} maxPct={speed} active={held !== null} onStick={stick} />
          <div className="drive-stick-foot">
            <span className="readout-label">Commanded</span>
            <span className="readout-value num">{pct ?? "--"}<span className="readout-unit">%</span></span>
          </div>
          <span className="drive-stick-hint">Drag or touch. The keyboard still drives: W A S D.</span>
        </div>
      )}

      <div className="speed">
        <div className="speed-head">
          <label className="readout-label" htmlFor="drive-speed">{mode === "stick" ? "Speed limit" : "Speed"}</label>
          <span className="speed-entry">
            <input className="speed-input num" type="number" inputMode="numeric" min={SPEED_MIN} max={SPEED_MAX} step="1"
              value={speedDraft ?? speed} onChange={(e) => setSpeedDraft(e.target.value)}
              onBlur={(e) => commitSpeed(e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              aria-label={`Speed in percent, ${SPEED_MIN} to ${SPEED_MAX}`} />
            <span className="readout-unit">%</span>
          </span>
        </div>
        <input id="drive-speed" type="range" min={SPEED_MIN} max={SPEED_MAX} step="1" value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))} className="range-slider"
          style={{ "--fill": `${((speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * 100}%` } as CSSProperties} />
        <div className="speed-presets">
          {presets.map((value) => (
            <button key={value} type="button" className={`btn-preset num ${speed === value ? "is-active" : ""}`}
              onClick={() => setSpeed(value)}>
              {value}%
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
