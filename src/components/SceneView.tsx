import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { token, type Theme } from "../adapters/theme.ts";
import type { ContractState } from "../core/contract.ts";
import type { Environment, Pose, RobotModel } from "./scene.ts";

const PRESETS = [
  { id: "chase", label: "Chase", offset: new THREE.Vector3(-1.1, -0.35, 0.65) },
  { id: "top", label: "Top", offset: new THREE.Vector3(-0.001, 0, 2.6) },
  { id: "side", label: "Side", offset: new THREE.Vector3(0, -1.4, 0.35) },
] as const;
type Preset = (typeof PRESETS)[number]["id"];

const Z = new THREE.Vector3(0, 0, 1);

function dispose(object: THREE.Object3D) {
  object.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
      o.geometry.dispose();
      for (const m of [o.material].flat()) m.dispose();
    }
  });
}

export function SceneView({ environment, robotModel, pose = null, state, theme, title = "Scene", toolbar, children }: {
  environment: Environment; robotModel: RobotModel; pose?: Pose | null; state?: ContractState; theme: Theme;
  title?: string; toolbar?: ReactNode; children?: ReactNode;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const [preset, setPreset] = useState<Preset>("chase");
  const live = useRef({ pose, state, preset, reset: true });
  live.current = { ...live.current, pose, state };

  useEffect(() => {
    live.current.preset = preset;
    live.current.reset = true;
  }, [preset]);

  useEffect(() => {
    const el = mount.current;
    if (!el) return undefined;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(token("--bg-void") || "#000000");
    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 500);
    camera.up.copy(Z);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 2.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(2, -3, 5);
    scene.add(sun);

    const world = environment.build(theme);
    const robot = new THREE.Group();
    scene.add(world, robot);
    let gone = false;
    robotModel.load().then((model) => (gone ? dispose(model) : robot.add(model)));

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();

    // Follows robot, operator can still orbit between preset changes
    const last = new THREE.Vector3();
    const delta = new THREE.Vector3();
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const { pose: p, state: s } = live.current;
      robot.position.set(p?.x_m ?? 0, p?.y_m ?? 0, 0);
      robot.rotation.z = ((p?.yaw_deg ?? 0) * Math.PI) / 180;
      if (s && environment.update) environment.update(world, s);
      if (live.current.reset) {
        live.current.reset = false;
        const offset = PRESETS.find((x) => x.id === live.current.preset)!.offset.clone().applyAxisAngle(Z, robot.rotation.z);
        camera.position.copy(robot.position).add(offset);
      } else {
        camera.position.add(delta.subVectors(robot.position, last));
      }
      last.copy(robot.position);
      controls.target.copy(robot.position).setZ(0.1);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      gone = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      dispose(scene);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [environment, robotModel, theme]);

  return (
    <div className="panel scene-panel">
      <div className="panel-head">
        <span className="panel-title">{title}</span>
        <div className="head-group">
          {toolbar}
          <div className="segment-control" role="group" aria-label="View">
            {PRESETS.map(({ id, label }) => (
              <button key={id} type="button" className={`segment-btn ${preset === id ? "is-active" : ""}`}
                onClick={() => (preset === id ? (live.current.reset = true) : setPreset(id))}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="scene-stage">
        <div ref={mount} className="scene-gl" />
        {children}
      </div>
    </div>
  );
}
