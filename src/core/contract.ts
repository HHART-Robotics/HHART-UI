export type Field = { name: string; type: string; unit?: string };
export type Declared = { name: string; tier: "curated" | "passthrough"; direction: "in" | "out"; fields: Field[] };
export type Describe = { type: "describe"; version: string; messages: Declared[] };
export type Message = { type: string; [field: string]: unknown };
export type Values = Record<string, unknown>;
export type Capability = { name: string; running: boolean; error: string | null };

export type ContractState = {
  contract: Describe | null;
  latest: Record<string, Values>;
  at: Record<string, number>; // ms, last arrival per type
  faults: Record<string, string>; // device -> text, active only
  capabilities: Record<string, Capability>;
};

export const INITIAL_STATE: ContractState = { contract: null, latest: {}, at: {}, faults: {}, capabilities: {} };
export const STALE_MS = 2000;

function isDescribe(message: Message): message is Describe {
  return message.type === "describe" && Array.isArray((message as Partial<Describe>).messages);
}

export function declares(contract: Describe | null, name: string, direction: "in" | "out"): boolean {
  return contract?.messages.some((m) => m.name === name && m.direction === direction) ?? false;
}

// Unknown types ignored so robots can add messages without breaking UI
export function decode(state: ContractState, message: Message, now = 0): ContractState {
  if (isDescribe(message)) return { ...INITIAL_STATE, contract: message };
  if (!declares(state.contract, message.type, "out")) return state;
  const { type, ...fields } = message;
  const next: ContractState = {
    ...state,
    latest: { ...state.latest, [type]: fields },
    at: { ...state.at, [type]: now },
  };
  if (type === "fault") {
    const device = String(fields.device);
    const { [device]: _cleared, ...others } = state.faults;
    next.faults = fields.active ? { ...others, [device]: String(fields.text) } : others;
  }
  if (type === "capability") {
    const capability = fields as unknown as Capability;
    next.capabilities = { ...state.capabilities, [capability.name]: capability };
  }
  return next;
}

export function panelsOf(contract: Describe | null, own: readonly string[]): Declared[] {
  return (contract?.messages ?? []).filter((m) => m.direction === "out" && !own.includes(m.name));
}

export function formsOf(contract: Describe | null, own: readonly string[]): Declared[] {
  return (contract?.messages ?? []).filter((m) => m.direction === "in" && !own.includes(m.name));
}

export function isStale(state: ContractState, type: string, now: number): boolean {
  const at = state.at[type];
  return at === undefined || now - at > STALE_MS;
}
