// Metres, REP 103 (x forward, y left, z up)

import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { token, type Theme } from "../adapters/theme.ts";
import type { ContractState } from "../core/contract.ts";

export type Pose = { x_m: number; y_m: number; yaw_deg: number };

// base_link at origin
export interface RobotModel {
  load(): Promise<THREE.Object3D>;
}

// build reruns on theme change, update every frame
export interface Environment {
  build(theme: Theme): THREE.Object3D;
  update?(world: THREE.Object3D, state: ContractState): void;
}

const colour = (name: string) => new THREE.Color(token(name) || "#808080");

export function boxRobot({ length_m = 0.3, width_m = 0.2, height_m = 0.08, wheel_m = 0.05 } = {}): RobotModel {
  return {
    async load() {
      const robot = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(length_m, width_m * 0.8, height_m),
        new THREE.MeshStandardMaterial({ color: colour("--ink-dim"), roughness: 0.6 }));
      body.position.z = wheel_m + height_m / 2;
      // Accent on front face shows heading
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.01, width_m * 0.6, height_m * 0.5),
        new THREE.MeshStandardMaterial({ color: colour("--accent") }));
      nose.position.set(length_m / 2, 0, body.position.z);
      robot.add(body, nose);
      for (const side of [1, -1]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(wheel_m, wheel_m, width_m * 0.12, 24),
          new THREE.MeshStandardMaterial({ color: colour("--line-strong"), roughness: 0.9 }));
        wheel.position.set(0, (side * width_m) / 2, wheel_m);
        robot.add(wheel);
      }
      return robot;
    },
  };
}

export type GltfOptions = {
  draco?: string; // Decoder folder, Draco files only
  frame?: "gltf" | "rep103"; // gltf: Y up, +Z forward (glTF default). rep103: X forward, Z up
  scale?: number; // To metres, e.g. 0.001 for CAD in mm
  origin_m?: [number, number, number]; // base_link in model, after frame change
};

// glTF's +X, +Y, +Z are REP 103's +Y (left), +Z (up), +X (forward)
export const GLTF_TO_REP103 = new THREE.Matrix4().makeBasis(
  new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));

export function gltfPlacement({ frame = "gltf", scale = 1, origin_m = [0, 0, 0] }: GltfOptions = {}): THREE.Matrix4 {
  const [x, y, z] = origin_m;
  return new THREE.Matrix4().makeTranslation(-x, -y, -z)
    .multiply(frame === "gltf" ? GLTF_TO_REP103 : new THREE.Matrix4())
    .multiply(new THREE.Matrix4().makeScale(scale, scale, scale));
}

export function gltfRobot(url: string, options: GltfOptions = {}): RobotModel {
  let pending: Promise<THREE.Object3D> | null = null;
  return {
    load() {
      if (!pending) {
        const loader = new GLTFLoader();
        if (options.draco) loader.setDRACOLoader(new DRACOLoader().setDecoderPath(options.draco));
        pending = loader.loadAsync(url).then((gltf) => gltf.scene);
      }
      // Clone per caller, three.js objects have one parent
      return pending.then((scene) => {
        const placed = new THREE.Group();
        placed.matrixAutoUpdate = false;
        placed.matrix.copy(gltfPlacement(options));
        placed.add(scene.clone(true));
        return placed;
      });
    },
  };
}

export function floorGrid({ size_m = 10, step_m = 0.5 } = {}): Environment {
  return {
    build() {
      const world = new THREE.Group();
      const grid = new THREE.GridHelper(size_m, Math.round(size_m / step_m), colour("--ink-faint"), colour("--line-strong"));
      grid.rotation.x = Math.PI / 2; // GridHelper lies in XZ, floor is XY
      world.add(grid);
      return world;
    },
  };
}
