import { describe, expect, test } from "vitest";

import { commandFrom, drive, release, stop, switchCapability } from "./commands.ts";
import { INITIAL_STATE, decode, formsOf, isStale, panelsOf, type Describe } from "./contract.ts";
import { clampToPad, directionOf, resolveStick, STICK_DEADZONE, stickDirection, tracksOf } from "./drive.ts";
import { formatValue } from "./format.ts";

const DESCRIBE: Describe = {
  type: "describe", version: "1.0.0", messages: [
    { name: "status", tier: "curated", direction: "out", fields: [{ name: "route", type: "str" }] },
    { name: "fault", tier: "curated", direction: "out", fields: [] },
    { name: "capability", tier: "curated", direction: "out", fields: [] },
    { name: "battery", tier: "passthrough", direction: "out", fields: [{ name: "voltage_v", unit: "V", type: "float" }] },
    { name: "drive", tier: "curated", direction: "in", fields: [] },
    { name: "lights", tier: "curated", direction: "in", fields: [{ name: "on", type: "bool" }, { name: "level", type: "int" }] },
  ],
};

describe("contract", () => {
  test("nothing decodes before describe, and undescribed types are ignored", () => {
    expect(decode(INITIAL_STATE, { type: "status", route: "embedded" })).toEqual(INITIAL_STATE);
    const state = decode(INITIAL_STATE, DESCRIBE);
    expect(decode(state, { type: "new_sensor", x: 1 })).toEqual(state);
    expect(decode(state, { type: "drive", direction: "forward" })).toEqual(state);
  });

  test("the latest of each message is kept with when it came", () => {
    const state = decode(decode(INITIAL_STATE, DESCRIBE), { type: "battery", voltage_v: 12.1 }, 5000);
    expect(state.latest.battery).toEqual({ voltage_v: 12.1 });
    expect(isStale(state, "battery", 6000)).toBe(false);
    expect(isStale(state, "battery", 7500)).toBe(true);
    expect(isStale(state, "status", 5000)).toBe(true);
  });

  test("faults are held per device until the robot clears them", () => {
    let state = decode(INITIAL_STATE, DESCRIBE);
    state = decode(state, { type: "fault", device: "imu", text: "no data for 1 s", active: true });
    state = decode(state, { type: "fault", device: "cmd", text: "another node", active: true });
    state = decode(state, { type: "fault", device: "imu", text: "", active: false });
    expect(state.faults).toEqual({ cmd: "another node" });
  });

  test("capabilities are kept by name", () => {
    const state = decode(decode(INITIAL_STATE, DESCRIBE), { type: "capability", name: "ros", running: false, error: "no rclpy" });
    expect(state.capabilities.ros).toEqual({ name: "ros", running: false, error: "no rclpy" });
  });

  test("a new describe starts the state again", () => {
    const state = decode(decode(INITIAL_STATE, DESCRIBE), { type: "battery", voltage_v: 12 });
    expect(decode(state, DESCRIBE).latest).toEqual({});
  });

  test("messages and commands without a view of their own are listed for generic views", () => {
    expect(panelsOf(DESCRIBE, ["status", "fault", "capability"]).map((m) => m.name)).toEqual(["battery"]);
    expect(formsOf(DESCRIBE, ["drive"]).map((m) => m.name)).toEqual(["lights"]);
  });
});

describe("commands", () => {
  test("are built in the contract's terms", () => {
    expect(drive("left", 30)).toEqual({ type: "drive", direction: "left", pct: 30 });
    expect(stop()).toEqual({ type: "stop" });
    expect(release()).toEqual({ type: "release" });
    expect(switchCapability("ros", true)).toEqual({ type: "switch", name: "ros", running: true });
  });

  test("a declared command is cast by its field types", () => {
    const lights = DESCRIBE.messages[5];
    expect(commandFrom(lights, { on: "true", level: "7.9" })).toEqual({ type: "lights", on: true, level: 7 });
  });
});

describe("drive", () => {
  test("WASD and the arrows drive, and nothing else does", () => {
    expect(directionOf("w")).toBe("forward");
    expect(directionOf("ArrowLeft")).toBe("left");
    expect(directionOf("q")).toBeNull();
  });

  test("tracks turn on the spot and stand still with no direction", () => {
    expect(tracksOf("left")).toEqual({ left: -1, right: 1 });
    expect(tracksOf(null)).toEqual({ left: 0, right: 0 });
  });

  test("the stick picks one quadrant and steps its speed", () => {
    expect(stickDirection(0, 1)).toBe("forward");
    expect(stickDirection(-1, 0.2)).toBe("left");
    expect(resolveStick(0, STICK_DEADZONE / 2, 10, 100)).toBeNull();
    expect(resolveStick(0, 1, 10, 100)).toEqual({ direction: "forward", pct: 100 });
    expect(resolveStick(0, 1, 10, 60)?.pct).toBe(60);
    expect(clampToPad(3, 4)).toEqual({ dx: 0.6, up: 0.8 });
  });
});

describe("format", () => {
  test("unknown is a dash, thousands are spaced", () => {
    expect(formatValue(undefined)).toBe("-");
    expect(formatValue(Number.NaN)).toBe("-");
    expect(formatValue(-12345.678, 1)).toBe("-12 345.7");
    expect(formatValue("ok")).toBe("ok");
  });
});
