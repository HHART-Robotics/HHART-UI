import { useEffect, useRef, useState, type ReactNode } from "react";
import { commandFrom, switchCapability } from "../core/commands.ts";
import { isStale, type Capability, type ContractState, type Declared, type Message, type Values } from "../core/contract.ts";
import { formatValue } from "../core/format.ts";
import type { Theme } from "../adapters/theme.ts";

export type Level = "warn" | "fault" | null;

export function Shell({ topBar, left, centre, right, bottom, drawer }: {
  topBar: ReactNode; left: ReactNode; centre: ReactNode; right?: ReactNode; bottom?: ReactNode; drawer?: ReactNode;
}) {
  return (
    <div className="app-layout">
      {topBar}
      <main className="dashboard">
        <aside className="col-left">{left}</aside>
        <div className="col-centre">{centre}</div>
        <div className="col-right">{right}</div>
        {bottom ? <div className="row-bottom">{bottom}</div> : null}
      </main>
      {drawer}
    </div>
  );
}

export function TopBar({ brand, connected, route, chips, theme, onToggleTheme, onStop, children }: {
  brand: string; connected: boolean; route?: string; chips?: ReactNode; theme: Theme;
  onToggleTheme: () => void; onStop: () => void; children?: ReactNode;
}) {
  return (
    <header className="top-bar">
      <span className="brand-title">{brand}</span>
      <div className="top-bar-group">
        {children}
        {route ? (
          <div className="field">
            <span className="field-label">Route</span>
            <span className="field-value">{route === "full_ros" ? "Full ROS 2" : route === "embedded" ? "Embedded" : route}</span>
          </div>
        ) : null}
        {chips}
        <span className={`chip ${connected ? "chip-ok" : "chip-fault"}`}>{connected ? "Linked" : "No link"}</span>
        <button type="button" className="btn-action" onClick={onToggleTheme}
          title={`Switch to the ${theme === "dark" ? "light" : "dark"} theme`}>
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        <button type="button" className="btn-stop" onClick={onStop} disabled={!connected} title="Stop (Space)">
          Stop
        </button>
      </div>
    </header>
  );
}

// frame: base64 JPEG
export function CameraPanel({ frame, offline = "No camera on this robot", title = "Camera" }: {
  frame?: string | null; offline?: string; title?: string;
}) {
  const [stats, setStats] = useState({ fps: 0, kb: 0 });
  const times = useRef<number[]>([]);
  useEffect(() => {
    if (!frame) return;
    const t = times.current;
    t.push(performance.now());
    if (t.length > 30) t.shift();
    const elapsed = t.length >= 2 ? (t[t.length - 1] - t[0]) / 1000 : 0;
    // Base64, 4 chars per 3 bytes
    setStats({ fps: elapsed ? Math.round((t.length - 1) / elapsed) : 0, kb: Math.round((frame.length * 3) / 4 / 1024) });
  }, [frame]);

  const snapshot = () => {
    if (!frame) return;
    const a = document.createElement("a");
    a.href = `data:image/jpeg;base64,${frame}`;
    a.download = `snapshot_${Date.now()}.jpg`;
    a.click();
  };

  return (
    <div className="panel camera-panel">
      <div className="panel-head">
        <span className="panel-title">{title}</span>
        <button type="button" className="btn-action" onClick={snapshot} disabled={!frame}>Snapshot</button>
      </div>
      <div className="camera-viewport">
        {frame
          ? <img src={`data:image/jpeg;base64,${frame}`} alt={title} className="camera-img" draggable={false} />
          : <div className="camera-empty-state"><span>No video signal</span><span className="camera-empty-mode">{offline}</span></div>}
        {frame ? <div className="camera-stats-plate">{stats.fps} fps, {stats.kb} KB</div> : null}
      </div>
    </div>
  );
}

export type Readout = { label: string; value: string; unit?: string };

export function PoseHud({ title, level = null, chips, primary, readouts, action }: {
  title: string; level?: Level; chips?: ReactNode; primary?: Readout & { sub?: string }; readouts: Readout[];
  action?: { label: string; title?: string; disabled?: boolean; onClick: () => void };
}) {
  return (
    <section className={`pose-hud ${level ? `has-${level}` : ""}`}>
      <div className="pose-head">
        <span className="panel-title">{title}</span>
        {chips}
        {action ? (
          <button type="button" className="btn-action pose-zero" onClick={action.onClick} disabled={action.disabled}
            title={action.title}>{action.label}</button>
        ) : null}
      </div>
      {primary ? (
        <div className="readout-primary">
          <span className="readout-value-display num">{primary.value}<span className="readout-unit">{primary.unit}</span></span>
          {primary.sub ? <span className="readout-sub num">{primary.sub}</span> : null}
        </div>
      ) : null}
      <div className="pose-readouts" style={{ gridTemplateColumns: `repeat(${Math.max(1, readouts.length)}, minmax(0, 1fr))` }}>
        {readouts.map((r) => (
          <div className="readout" key={r.label}>
            <span className="readout-label">{r.label}</span>
            <span className="readout-value num">{r.value}<span className="readout-unit">{r.unit}</span></span>
          </div>
        ))}
      </div>
    </section>
  );
}

export type DrawerTab = { id: string; label: string; render: () => ReactNode };

// Stay mounted once opened, switching doesn't kill their state
export function Drawer({ tabs }: { tabs: DrawerTab[] }) {
  const [tab, setTab] = useState<string | null>(null);
  const [opened, setOpened] = useState(() => new Set<string>());
  if (tab && !opened.has(tab)) setOpened(new Set(opened).add(tab));
  return (
    <section className="drawer">
      <div className="drawer-tabs" role="tablist">
        {tabs.map(({ id, label }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            className={`drawer-tab ${tab === id ? "is-active" : ""}`} onClick={() => setTab(tab === id ? null : id)}>
            {label}
          </button>
        ))}
        {tab ? <button type="button" className="btn-action drawer-close" onClick={() => setTab(null)}>Close</button> : null}
      </div>
      <div className="drawer-body" hidden={!tab}>
        {tabs.filter(({ id }) => opened.has(id)).map(({ id, render }) => (
          <div key={id} className="drawer-pane" hidden={tab !== id}>{render()}</div>
        ))}
      </div>
    </section>
  );
}

export function CapabilityPanel({ name, label, capabilities, connected, send, children }: {
  name: string; label: string; capabilities: Record<string, Capability>; connected: boolean;
  send: (command: Message) => void; children?: ReactNode;
}) {
  const state = capabilities[name];
  let chip;
  if (!connected) chip = <span className="chip chip-neutral">No link</span>;
  else if (!state) chip = <span className="chip chip-neutral">Not on this robot</span>;
  else if (state.running) chip = <span className="chip chip-ok">Running</span>;
  else chip = <span className="chip chip-neutral">Off</span>;
  return (
    <div className="cap-panel">
      <div className="cap-head">
        <span className="panel-title">{label}</span>
        {chip}
        <button type="button" className="btn-action" disabled={!connected || !state}
          onClick={() => send(switchCapability(name, !state?.running))}>
          {state?.running ? `Stop ${label}` : `Start ${label}`}
        </button>
      </div>
      {state?.error ? <p className="cap-error">{state.error}</p> : null}
      {children ? <div className="cap-body">{children}</div> : null}
    </div>
  );
}

export function FaultsPanel({ faults, error }: { faults: Record<string, string>; error?: Values }) {
  const entries = Object.entries(faults);
  return (
    <section className={`panel ${entries.length ? "has-fault" : ""}`}>
      <div className="panel-head">
        <span className="panel-title">Faults</span>
        <span className={`chip ${entries.length ? "chip-fault" : "chip-ok"}`}>{entries.length ? `${entries.length} active` : "None"}</span>
      </div>
      {entries.length ? (
        <ul className="fault-list">
          {entries.map(([device, text]) => <li key={device}><span className="fault-device">{device}</span> {text}</li>)}
        </ul>
      ) : <p className="panel-note">Devices report here, in the robot's words, until they recover.</p>}
      {error ? <p className="panel-note warn-note">Refused: {String(error.text)}</p> : null}
    </section>
  );
}

export function MessagePanel({ message, state, now }: { message: Declared; state: ContractState; now: number }) {
  const values = state.latest[message.name];
  return (
    <section className={`panel ${isStale(state, message.name, now) ? "is-stale" : ""}`}>
      <div className="panel-head">
        <span className="panel-title">{message.name}</span>
        {message.tier === "passthrough" ? <span className="chip chip-neutral">Declared</span> : null}
      </div>
      <div className="readout-grid">
        {message.fields.map((f) => (
          <div className="readout" key={f.name}>
            <span className="readout-label">{f.name}</span>
            <span className="readout-value num">{formatValue(values?.[f.name])}<span className="readout-unit">{f.unit ?? ""}</span></span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CommandForm({ message, send, disabled }: { message: Declared; send: (command: Message) => void; disabled: boolean }) {
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  return (
    <section className="panel">
      <div className="panel-head"><span className="panel-title">{message.name}</span></div>
      <form className="command-form" onSubmit={(e) => { e.preventDefault(); send(commandFrom(message, values)); }}>
        {message.fields.map((f) => (
          <label key={f.name} className="field">
            <span className="field-label">{f.name}{f.unit ? ` (${f.unit})` : ""}</span>
            <input className="field-input" type={f.type === "bool" ? "checkbox" : f.type === "str" ? "text" : "number"}
              step={f.type === "float" ? "any" : undefined}
              onChange={(e) => setValues({ ...values, [f.name]: f.type === "bool" ? e.target.checked : e.target.value })} />
          </label>
        ))}
        <button type="submit" className="btn-action" disabled={disabled}>Send</button>
      </form>
    </section>
  );
}
