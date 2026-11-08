# @hhart/ui

React + TypeScript operator UI for robots made with `hhart new`.

Developed in [HHART](https://github.com/HHART-Robotics/HHART), where issues and PRs go.
[HHART-UI](https://github.com/HHART-Robotics/HHART-UI) is a read-only mirror of
this folder.

| Export | |
| --- | --- |
| `Shell` | Page layout |
| `TopBar` | Brand, route, link state, theme, Stop |
| `DrivePanel` | Drive buttons, joystick, keys (WASD, arrows), speed, Release |
| `SceneView` | 3D view of the robot (three.js) |
| `PoseHud` | Readouts over the scene |
| `CameraPanel` | JPEG camera feed |
| `FaultsPanel` | Active faults and refused commands |
| `CapabilityPanel` | Start and stop a capability, e.g. ROS access |
| `Drawer` | Tabs under the main view |
| `MessagePanel`, `CommandForm` | Generic views for messages and commands without their own view |
| `useBridge` | WebSocket to the robot, decoded through the contract |
| `readTheme`, `applyTheme`, `token` | Themes and colour tokens |
| `@hhart/ui/core` | Pure logic: contract decoding, commands, drive mapping, formatting |
| `@hhart/ui/styles.css` | Tokens and component styles |

## Slots

A robot supplies its 3D model and environment. Metres, REP 103 (x forward,
y left, z up), `base_link` at the origin.

```ts
interface RobotModel { load(): Promise<THREE.Object3D> }
interface Environment {
  build(theme: Theme): THREE.Object3D;                        // reruns on theme change
  update?(world: THREE.Object3D, state: ContractState): void; // every frame
}
```

Built in: `boxRobot()`, `gltfRobot(url)` for CAD exports, `floorGrid()`.

## Styling

Use the tokens on `:root` (`--bg-panel`, `--ink`, `--st-ok`, `--st-warn`,
`--st-fault`, `--accent`, ...) and the component classes (`panel`,
`panel-head`, `chip`, `readout`, `btn-action`). Don't add colours.

## Install

Already a dependency in robots made with `hhart new`. Otherwise:

```text
pnpm add github:HHART-Robotics/HHART-UI#v0.1.1
```

Ships TypeScript source for Vite to compile. React, React DOM and three.js are
peer dependencies.

## Develop

From the HHART repo root:

```text
pnpm install && pnpm typecheck && pnpm test
```

## Licence

Licensed under the [Apache License 2.0](LICENSE) (Apache-2.0), like the rest of
[HHART](https://github.com/HHART-Robotics/HHART). See [NOTICE](NOTICE).
