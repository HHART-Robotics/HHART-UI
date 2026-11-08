import type { Declared, Message } from "./contract.ts";
import type { Direction } from "./drive.ts";

export const KEEPALIVE_MS = 200; // P, must stay under robot's deadman T

export function drive(direction: Direction, pct: number): Message {
  return { type: "drive", direction, pct };
}

export function stop(): Message {
  return { type: "stop" };
}

export function release(): Message {
  return { type: "release" };
}

export function switchCapability(name: string, running: boolean): Message {
  return { type: "switch", name, running };
}

export function commandFrom(message: Declared, values: Record<string, string | boolean>): Message {
  const command: Message = { type: message.name };
  for (const field of message.fields) {
    const raw = values[field.name];
    if (field.type === "bool") command[field.name] = raw === true || raw === "true";
    else if (field.type === "int") command[field.name] = Math.trunc(Number(raw));
    else if (field.type === "float") command[field.name] = Number(raw);
    else command[field.name] = raw ?? "";
  }
  return command;
}
