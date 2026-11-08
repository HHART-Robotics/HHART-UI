import * as THREE from "three";
import { expect, test } from "vitest";

import { gltfPlacement } from "./scene.ts";

const placed = (v: [number, number, number], options = {}) =>
  new THREE.Vector3(...v).applyMatrix4(gltfPlacement(options)).toArray().map((n) => Math.round(n * 1e6) / 1e6 + 0);

test("a glTF model's forward, up and left land on REP 103's x, z and y", () => {
  expect(placed([0, 0, 1])).toEqual([1, 0, 0]); // glTF forward is +Z
  expect(placed([0, 1, 0])).toEqual([0, 0, 1]); // glTF up is +Y
  expect(placed([1, 0, 0])).toEqual([0, 1, 0]); // glTF +X is the model's left
});

test("a REP 103 export is left alone, a millimetre one is scaled, and base_link moves to the origin", () => {
  expect(placed([1, 2, 3], { frame: "rep103" })).toEqual([1, 2, 3]);
  expect(placed([0, 0, 300], { scale: 0.001 })).toEqual([0.3, 0, 0]);
  expect(placed([0, 0, 0.1], { origin_m: [0.1, 0, 0.05] })).toEqual([0, 0, -0.05]);
});
