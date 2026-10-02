import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  canvasTexture,
  printedLabel,
  surfaceFinish,
  drawDialScale,
} from "./surface-textures";
import { mechanicalCounter } from "./mechanical-counter";
import { createEffects } from "./apparatus-effects";
import type { Anchor, Appearance, PhysicalState } from "./apparatus-styles";

type Resources = {
  texture: <T extends THREE.Texture>(texture: T) => T;
  material: <T extends THREE.Material>(material: T) => T;
  printing: Array<() => void>;
};
type Motion = {
  name: string;
  node: THREE.Group;
  z: number;
  travel: number;
  lever?: boolean;
};
const settings: Record<
  Appearance,
  { shell: number; metal: number; accent: number; ink: string; glow: number }
> = {
  cyberpunk: {
    shell: 0x151b29,
    metal: 0x5e7384,
    accent: 0x18cde8,
    ink: "#d3faff",
    glow: 0x2cddff,
  },
  steampunk: {
    shell: 0x422a1b,
    metal: 0xb78a40,
    accent: 0x713821,
    ink: "#463c25",
    glow: 0xff9c41,
  },
  soviet: {
    shell: 0x797f64,
    metal: 0xb4b49d,
    accent: 0x802b1c,
    ink: "#dedbc4",
    glow: 0xff9b39,
  },
  dieselpunk: {
    shell: 0x363a32,
    metal: 0x6c7164,
    accent: 0xbd7435,
    ink: "#d0cbb1",
    glow: 0xffb157,
  },
  arcane: {
    shell: 0x302440,
    metal: 0xb39a69,
    accent: 0x7447bc,
    ink: "#e6d5ff",
    glow: 0xb799ff,
  },
};

/** Each constructor owns a different silhouette, mechanism and layout. */
export function buildApparatus(
  style: Appearance,
  compact: boolean,
  body: THREE.Group,
  resources: Resources,
) {
  const palette = settings[style];
  const maps = (kind: "enamel" | "polymer" | "metal") => {
    const finish = surfaceFinish(kind);
    Object.values(finish).forEach(resources.texture);
    return {
      map: finish.color,
      bumpMap: finish.height,
      roughnessMap: finish.roughness,
    };
  };
  const paint = maps("enamel"),
    polymer = maps("polymer"),
    brushed = maps("metal");
  const material = (
    color: number,
    metalness = 0,
    roughness = 0.8,
    finish = paint,
  ) =>
    resources.material(
      new THREE.MeshStandardMaterial({
        color,
        metalness,
        roughness,
        ...finish,
        bumpScale: metalness > 0.5 ? 0.003 : 0.01,
      }),
    );
  const shell = material(palette.shell),
    metal = material(palette.metal, 0.94, 0.65, brushed),
    dark = material(0x151a16, 0.05, 0.95, polymer);
  const accent = material(palette.accent, 0.1, 0.65, polymer),
    ivory = material(0xcfc19d, 0, 0.86, polymer);
  const wood = resources.material(
    new THREE.MeshPhysicalMaterial({
      color: 0x897055,
      roughness: 0.65,
      clearcoat: 0.1,
      clearcoatRoughness: 0.7,
    }),
  );
  const glow = resources.material(
    new THREE.MeshStandardMaterial({
      color: palette.glow,
      emissive: palette.glow,
      emissiveIntensity: 3,
      roughness: 0.3,
    }),
  );
  const glass = resources.material(
    new THREE.MeshPhysicalMaterial({
      color: 0xb8c8b5,
      transparent: true,
      opacity: 0.09,
      roughness: 0.22,
      clearcoat: 0.7,
      clearcoatRoughness: 0.14,
      depthWrite: false,
    }),
  );
  const anchors: Anchor[] = [],
    motions: Motion[] = [],
    painters: Array<(state: PhysicalState) => void> = [],
    gears: Array<{ node: THREE.Object3D; speed: number }> = [];
  const lights: Array<THREE.PointLight> = [];
  const pilots: Array<{
    name: "sound" | "auto";
    material: THREE.MeshStandardMaterial;
  }> = [];
  const box = (
    w: number,
    h: number,
    d: number,
    r: number,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = body,
  ) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const disc = (
    r: number,
    d: number,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = body,
    vertices = 64,
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, d, vertices),
      mat,
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const torus = (
    r: number,
    t: number,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = body,
  ) => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, t, 10, 80), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const tube = (
    points: THREE.Vector3[],
    radius: number,
    mat: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        40,
        radius,
        10,
        false,
      ),
      mat,
    );
    mesh.castShadow = mesh.receiveShadow = true;
    body.add(mesh);
    return mesh;
  };
  const ink = (
    text: string,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    color = palette.ink,
    parent: THREE.Object3D = body,
  ) => {
    const map = resources.texture(printedLabel(text, color, undefined, w / h));
    resources.printing.push(() => {
      const fresh = printedLabel(text, color, undefined, w / h);
      const canvas = map.image as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(fresh.image as HTMLCanvasElement, 0, 0);
      map.needsUpdate = true;
      fresh.dispose();
    });
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      resources.material(
        new THREE.MeshStandardMaterial({
          map,
          transparent: true,
          roughness: 0.95,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
        }),
      ),
    );
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const anchor = (
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
  ) =>
    anchors.push({
      name,
      center: new THREE.Vector3(x, y, z),
      width: w,
      height: h,
    });
  const polygon = (
    points: [number, number][],
    depth: number,
    mat: THREE.Material,
    z: number,
    parent: THREE.Object3D = body,
  ) => {
    const shape = new THREE.Shape(
      points.map(([x, y]) => new THREE.Vector2(x, y)),
    );
    const mesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelSize: 0.045,
        bevelThickness: 0.025,
        bevelSegments: 3,
        steps: 1,
      }),
      mat,
    );
    mesh.position.z = z;
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const bolts = (w: number, h: number, z: number, r = 0.064) => {
    for (const x of [-w / 2, w / 2])
      for (const y of [-h / 2, h / 2]) {
        disc(r, 0.026, metal, x, y, z, body, 6);
        const slot = box(r * 0.9, 0.014, 0.004, 0.002, dark, x, y, z + 0.016);
        slot.rotation.z = x * 0.71 + y * 0.4;
      }
  };
  const gear = (
    x: number,
    y: number,
    r: number,
    z: number,
    speed: number,
    parent: THREE.Object3D = body,
  ) => {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    parent.add(group);
    torus(r * 0.78, r * 0.14, metal, 0, 0, 0, group);
    disc(r * 0.17, 0.055, metal, 0, 0, 0, group);
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      const spoke = box(
        r * 0.095,
        r * 0.69,
        0.035,
        0.012,
        metal,
        Math.sin(a) * r * 0.35,
        Math.cos(a) * r * 0.35,
        0,
        group,
      );
      spoke.rotation.z = -a;
    }
    const teeth = new THREE.InstancedMesh(
      new THREE.BoxGeometry(r * 0.12, r * 0.16, 0.065),
      metal,
      32,
    );
    const t = new THREE.Object3D();
    for (let i = 0; i < 32; i++) {
      const a = (i * Math.PI * 2) / 32;
      t.position.set(Math.sin(a) * r * 0.94, Math.cos(a) * r * 0.94, 0);
      t.rotation.z = -a;
      t.updateMatrix();
      teeth.setMatrixAt(i, t.matrix);
    }
    teeth.castShadow = teeth.receiveShadow = true;
    group.add(teeth);
    gears.push({ node: group, speed });
    return group;
  };
  // Every control takes the height of its own supporting panel. Printing sits
  // a fraction of a millimetre above that panel, never on a shared floating plane.
  const plaque = (
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    face: number,
    mat: THREE.Material = metal,
    color = palette.ink,
  ) => {
    box(w, h, 0.032, 0.018, mat, x, y, face + 0.016);
    ink(text, w * 0.89, h * 0.55, x, y, face + 0.033, color);
  };
  const button = (
    name: string,
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    face: number,
    kind: "round" | "touch" | "gem" = "round",
    mat: THREE.Material = accent,
  ) => {
    const node = new THREE.Group();
    const rest = face + (kind === "touch" ? 0.038 : 0.15);
    node.position.set(x, y, rest);
    body.add(node);
    if (kind === "touch") {
      box(w, h, 0.035, 0.05, dark, x, y, face + 0.018);
      box(w * 0.94, h * 0.86, 0.012, 0.035, mat, 0, 0, 0, node);
      ink(text, w * 0.82, h * 0.35, 0, 0, 0.008, palette.ink, node);
    } else if (kind === "gem") {
      disc(w * 0.57, 0.07, metal, x, y, face + 0.036, body, 6);
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(w * 0.45),
        resources.material(
          new THREE.MeshPhysicalMaterial({
            color: palette.glow,
            metalness: 0.25,
            roughness: 0.24,
            clearcoat: 0.8,
            emissive: palette.glow,
            emissiveIntensity: 0.35,
          }),
        ),
      );
      crystal.scale.set(1, h / w, 0.5);
      node.add(crystal);
      // The legend is engraved on a socket below the crystal.
      plaque(text, x, y - h * 0.66, w * 1.45, 0.18, face, dark);
    } else {
      disc(w * 0.56, 0.075, metal, x, y, face + 0.038);
      disc(w * 0.47, 0.18, mat, 0, 0, 0, node);
      torus(w * 0.46, 0.018, metal, 0, 0, 0.095, node);
      ink(
        text,
        w * 0.73,
        h * 0.22,
        0,
        0,
        0.092,
        mat === ivory ? "#313427" : palette.ink,
        node,
      );
    }
    motions.push({
      name,
      node,
      z: rest,
      travel: kind === "touch" ? 0.004 : kind === "gem" ? 0.045 : 0.1,
    });
    anchor(name, x, y, rest + 0.1, w * 1.12, Math.max(h, w) * 1.12);
    return node;
  };
  const toggle = (
    name: "sound" | "auto",
    x: number,
    y: number,
    face: number,
    kind: "lever" | "rocker" | "touch" | "gem",
  ) => {
    const pilot = resources.material(glow.clone());
    pilots.push({ name, material: pilot });
    const label =
      name === "sound"
        ? style === "soviet"
          ? "ЗВУК"
          : "SOUND"
        : style === "soviet"
          ? "АВТО"
          : "AUTO";
    // Socket, label and travel all stay inside this solid mounting plate.
    box(
      0.87,
      0.68,
      0.055,
      0.04,
      kind === "gem" ? shell : dark,
      x,
      y,
      face + 0.028,
    );
    ink(label, 0.68, 0.11, x, y + 0.23, face + 0.057);
    const node = new THREE.Group();
    node.position.set(x, y - 0.07, face + 0.13);
    body.add(node);
    if (kind === "lever") {
      torus(0.13, 0.027, metal, x, y - 0.07, face + 0.085);
      disc(0.075, 0.09, metal, x, y - 0.07, face + 0.1);
      disc(0.036, 0.3, metal, 0, 0, 0.13, node);
      disc(0.067, 0.11, ivory, 0, 0, 0.3, node);
    } else if (kind === "rocker") {
      box(0.34, 0.34, 0.13, 0.024, accent, 0, 0, 0, node);
      box(0.11, 0.025, 0.008, 0.003, pilot, 0, 0.08, 0.07, node);
    } else if (kind === "gem") {
      disc(0.19, 0.06, metal, x, y - 0.07, face + 0.08, body, 6);
      const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15), pilot);
      gem.scale.z = 0.55;
      node.add(gem);
    } else {
      box(0.43, 0.16, 0.02, 0.03, pilot, 0, 0, 0, node);
    }
    motions.push({
      name,
      node,
      z: node.position.z,
      travel: kind === "gem" ? 0.035 : 0,
      lever: kind === "lever" || kind === "rocker",
    });
    anchor(name, x, y, face + 0.3, 0.88, 0.7);
  };
  const dynamicReadout = (
    position: [number, number],
    w: number,
    h: number,
    kind: "holo" | "ink" | "arcane",
    z = 0.68,
  ) => {
    const target = canvasTexture(2048, 768);
    resources.texture(target.texture);
    const mat = resources.material(
      kind === "ink"
        ? new THREE.MeshStandardMaterial({
            map: target.texture,
            roughness: 0.94,
            transparent: true,
            depthWrite: false,
          })
        : new THREE.MeshBasicMaterial({
            map: target.texture,
            transparent: true,
            depthWrite: false,
            color: new THREE.Color(palette.glow).multiplyScalar(
              kind === "holo" ? 2.2 : 1.6,
            ),
            toneMapped: false,
          }),
    );
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(...position, z);
    body.add(mesh);
    painters.push((state) => {
      const ctx = target.context;
      ctx.clearRect(0, 0, 2048, 768);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = kind === "ink" ? "#302b20" : "#ffffff";
      ctx.font = "400 440px 'DM Mono', monospace";
      ctx.fillText(
        `${String(Math.floor(state.remaining / 60)).padStart(2, "0")}:${String(state.remaining % 60).padStart(2, "0")}`,
        1024,
        378,
        1890,
      );
      ctx.font = "500 41px 'DM Mono', monospace";
      ctx.fillText(
        state.status === "running"
          ? "SESSION ACTIVE"
          : state.status === "paused"
            ? "PAUSED"
            : "READY",
        1024,
        75,
      );
      ctx.font = "400 33px 'DM Mono', monospace";
      ctx.fillText(
        `${state.mode.toUpperCase()}   /   ${state.round} OF 4`,
        1024,
        682,
      );
      target.texture.needsUpdate = true;
    });
    return mesh;
  };
  let rotary: THREE.Group | undefined,
    slider: THREE.Group | undefined,
    hand: THREE.Group | undefined,
    roller: THREE.Group | undefined,
    modePointer: THREE.Group | undefined,
    startMechanism: THREE.Group | undefined,
    counter: ReturnType<typeof mechanicalCounter> | undefined;
  const modeNames = ["focus", "short", "long"];
  const chainLinks: THREE.Mesh[] = [];
  let selectorKind: "arc" | "rail" = "arc";
  const selector = (
    x: number,
    y: number,
    face: number,
    kind: "arc" | "rail",
  ) => {
    selectorKind = kind;
    anchor(
      "selector",
      x,
      y,
      face + 0.32,
      kind === "arc" ? 1.5 : 2.1,
      kind === "arc" ? 1.5 : 0.64,
    );
    modePointer = new THREE.Group();
    modePointer.position.set(x, y, face + 0.16);
    body.add(modePointer);
    if (kind === "arc") {
      disc(0.68, 0.055, dark, x, y, face + 0.028);
      torus(0.63, 0.022, metal, x, y, face + 0.058);
      disc(0.09, 0.17, metal, x, y, face + 0.11);
      box(
        0.11,
        0.61,
        0.12,
        0.032,
        style === "soviet" ? dark : metal,
        0,
        0.12,
        0,
        modePointer,
      );
      disc(0.1, 0.14, ivory, 0, -0.14, 0.02, modePointer);
      for (let i = 0; i < 3; i++) {
        const a = (i - 1) * 0.95;
        const px = x + Math.sin(a) * 0.52,
          py = y + Math.cos(a) * 0.52;
        ink(["F", "S", "L"][i], 0.16, 0.13, px, py, face + 0.058);
        anchor(modeNames[i], px, py, face + 0.2, 0.36, 0.35);
      }
    } else {
      box(2.1, 0.64, 0.07, 0.04, dark, x, y, face + 0.035);
      box(1.68, 0.035, 0.025, 0.008, metal, x, y - 0.09, face + 0.082);
      disc(0.12, 0.19, metal, 0, -0.09, 0, modePointer);
      box(0.26, 0.24, 0.12, 0.035, dark, 0, -0.09, 0.1, modePointer);
      for (let i = 0; i < 3; i++) {
        const px = x + (i - 1) * 0.7;
        ink(["I", "II", "III"][i], 0.4, 0.13, px, y + 0.18, face + 0.071);
        anchor(modeNames[i], px, y, face + 0.26, 0.65, 0.6);
      }
    }
  };
  const dial = (
    x: number,
    y: number,
    radius: number,
    face: number,
    kind: "key" | "bakelite" | "crank",
  ) => {
    disc(
      radius * 1.18,
      0.035,
      kind === "key" ? metal : shell,
      x,
      y,
      face + 0.018,
    );
    const scale = canvasTexture(1024, 1024);
    resources.texture(scale.texture);
    const paint = () => {
      drawDialScale(scale.context);
      scale.texture.needsUpdate = true;
    };
    paint();
    resources.printing.push(paint);
    const printing = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 1.17, 64),
      resources.material(
        new THREE.MeshStandardMaterial({
          map: scale.texture,
          transparent: true,
          depthWrite: false,
          roughness: 0.95,
        }),
      ),
    );
    printing.position.set(x, y, face + 0.037);
    body.add(printing);
    rotary = new THREE.Group();
    rotary.position.set(x, y, face + 0.22);
    body.add(rotary);
    disc(0.11, 0.32, metal, x, y, face + 0.16);
    if (kind === "bakelite") {
      disc(radius * 0.78, 0.28, dark, 0, 0, 0, rotary);
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12;
        const rib = box(
          0.047,
          0.12,
          0.27,
          0.012,
          dark,
          Math.sin(a) * radius * 0.76,
          Math.cos(a) * radius * 0.76,
          0,
          rotary,
        );
        rib.rotation.z = -a;
      }
      box(0.027, 0.14, 0.008, 0.003, ivory, 0, radius * 0.55, 0.145, rotary);
      disc(0.055, 0.016, metal, 0, 0, 0.15, rotary);
    } else if (kind === "key") {
      disc(0.14, 0.27, metal, 0, 0, 0, rotary);
      for (const side of [-1, 1]) {
        box(
          radius * 0.8,
          0.2,
          0.1,
          0.085,
          metal,
          side * radius * 0.46,
          0,
          0.08,
          rotary,
        );
        torus(
          radius * 0.22,
          0.033,
          metal,
          side * radius * 0.65,
          0,
          0.14,
          rotary,
        );
      }
    } else {
      torus(radius * 0.85, 0.065, metal, 0, 0, 0.08, rotary);
      disc(0.13, 0.17, metal, 0, 0, 0, rotary);
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3;
        const spoke = box(
          0.09,
          radius * 0.85,
          0.075,
          0.018,
          metal,
          Math.sin(a) * radius * 0.42,
          Math.cos(a) * radius * 0.42,
          0.08,
          rotary,
        );
        spoke.rotation.z = -a;
      }
      disc(0.11, 0.34, dark, radius * 0.65, 0.18, 0.23, rotary);
    }
    anchor("dial", x, y, face + 0.45, radius * 2.2, radius * 2.2);
  };
  const idleWheel = (
    x: number,
    y: number,
    face: number,
    kind: "gear" | "piston" | "pendulum" | "spring",
  ) => {
    roller = new THREE.Group();
    roller.position.set(x, y, face + 0.16);
    body.add(roller);
    if (kind === "gear") {
      disc(0.31, 0.1, dark, x, y, face + 0.05);
      disc(0.055, 0.2, metal, x, y, face + 0.12);
      const teeth = gear(0, 0, 0.3, 0.04, 0, roller);
      teeth.rotation.z = 0.1;
      anchor("roller", x, y, face + 0.25, 0.73, 0.73);
    } else if (kind === "piston") {
      box(0.66, 0.9, 0.07, 0.025, dark, x, y, face + 0.035);
      box(0.12, 0.7, 0.15, 0.02, metal, 0, 0, 0, roller);
      box(0.5, 0.22, 0.25, 0.03, metal, 0, 0, 0.12, roller);
      for (const side of [-1, 1])
        box(0.04, 0.82, 0.07, 0.01, metal, x + side * 0.28, y, face + 0.14);
      anchor("roller", x, y, face + 0.4, 0.71, 0.98);
    } else if (kind === "pendulum") {
      tube(
        [
          new THREE.Vector3(x, y + 0.64, face),
          new THREE.Vector3(x, y, face + 0.16),
        ],
        0.04,
        metal,
      );
      box(0.035, 0.6, 0.03, 0.008, metal, 0, -0.27, 0, roller);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.19), glow);
      gem.position.y = -0.57;
      roller.add(gem);
      anchor("roller", x, y - 0.28, face + 0.3, 0.65, 1.1);
    } else {
      box(0.9, 0.28, 0.08, 0.035, dark, x, y, face + 0.04);
      disc(0.07, 0.2, metal, x - 0.28, y, face + 0.12);
      box(0.66, 0.1, 0.17, 0.03, metal, 0, 0, 0.04, roller);
      disc(0.1, 0.14, ivory, 0.25, 0, 0.13, roller);
      anchor("roller", x, y, face + 0.33, 1, 0.45);
    }
  };
  let idleKind = "gear";
  const feet: Array<[number, number]> = [];
  const cycleLenses: THREE.MeshStandardMaterial[] = [];
  const cycle = (x: number, y: number, face: number, vertical = false) => {
    box(
      vertical ? 0.22 : 1.12,
      vertical ? 1.12 : 0.22,
      0.045,
      0.025,
      dark,
      x,
      y,
      face + 0.0225,
    );
    for (let i = 0; i < 4; i++) {
      const px = x + (vertical ? 0 : (i - 1.5) * 0.25),
        py = y + (vertical ? (i - 1.5) * 0.25 : 0);
      disc(0.07, 0.018, metal, px, py, face + 0.056);
      const lamp = resources.material(
        new THREE.MeshStandardMaterial({
          color: palette.glow,
          emissive: palette.glow,
          emissiveIntensity: 0.1,
          roughness: 0.3,
        }),
      );
      disc(
        0.044,
        0.023,
        lamp,
        px,
        py,
        face + 0.077,
        body,
        style === "arcane" ? 6 : 24,
      );
      cycleLenses.push(lamp);
    }
  };
  if (style === "cyberpunk") {
    // A touch terminal: no mechanical keypad or circular duration knob.
    const w = compact ? 5.0 : 6.2;
    polygon(
      [
        [-w / 2 + 0.45, -2.5],
        [w / 2 - 0.24, -2.5],
        [w / 2, -2.26],
        [w / 2, 2.14],
        [w / 2 - 0.46, 2.6],
        [-w / 2 + 0.2, 2.6],
        [-w / 2, 2.4],
        [-w / 2, -2.03],
      ],
      0.48,
      shell,
      -0.4,
    );
    box(w - 0.24, 4.84, 0.055, 0.16, metal, 0, 0.05, 0.105);
    box(w - 0.46, 4.62, 0.03, 0.12, dark, 0, 0.05, 0.149);
    box(w - 0.76, 3.09, 0.025, 0.1, dark, 0, 0.65, 0.177);
    dynamicReadout([-0.36, 1.42], compact ? 3.45 : 4.3, 1.08, "holo", 0.193);
    const sx = compact ? 1.86 : 2.4;
    for (let i = 0; i < 3; i++)
      button(
        modeNames[i],
        ["F", "S", "L"][i],
        sx,
        0.98 - i * 0.55,
        0.4,
        0.38,
        0.19,
        "touch",
        metal,
      );
    torus(0.47, 0.012, glow, -0.38, -0.01, 0.195);
    button("start", "▶ / Ⅱ", -0.38, -0.01, 0.78, 0.72, 0.19, "touch", shell);
    button(
      "reset",
      "↺",
      -(w / 2 - 0.65),
      -0.16,
      0.45,
      0.42,
      0.19,
      "touch",
      metal,
    );
    ink("TOUCH TO ENGAGE", 2.2, 0.12, -0.38, -0.64, 0.166);
    const rail = compact ? 3.36 : 4.35;
    box(rail + 0.22, 0.56, 0.035, 0.045, shell, 0, -1.26, 0.183);
    box(rail, 0.038, 0.023, 0.009, glow, 0, -1.26, 0.213);
    slider = new THREE.Group();
    slider.position.set(0, -1.26, 0.239);
    body.add(slider);
    box(0.2, 0.41, 0.055, 0.04, accent, 0, 0, 0, slider);
    ink("SWIPE  /  MINUTES", 2.6, 0.13, 0, -1.67, 0.166);
    anchor("dial", 0, -1.26, 0.27, rail + 0.22, 0.61);
    toggle("sound", -1.14, -2.12, 0.167, "touch");
    toggle("auto", 1.14, -2.12, 0.167, "touch");
    idleWheel(-(w / 2 - 0.5), -1.26, 0.18, "spring");
    // A narrow haptic strip lives beside the duration rail.
    roller!.scale.set(0.32, 1.5, 1);
    const a = anchors.find((item) => item.name === "roller")!;
    a.width = 0.33;
    a.height = 0.68;
    button(
      "clicker",
      "•",
      w / 2 - 0.5,
      2.18,
      0.24,
      0.23,
      0.167,
      "touch",
      metal,
    );
    ink("N / 2091", 1.2, 0.15, -(w / 2 - 0.91), 2.18, 0.167);
    cycle(0, 2.18, 0.167);
    box(w + 0.24, 0.18, 0.6, 0.045, dark, 0, -2.63, -0.27);
    feet.push(
      [-w / 2 + 0.45, -2.43],
      [w / 2 - 0.45, -2.43],
      [-w / 2 + 0.45, 2.3],
      [w / 2 - 0.45, 2.3],
    );
  } else if (style === "steampunk") {
    // A round regulator and separate wooden plinth, with a real wind-up key.
    disc(2.08, 0.57, wood, -0.55, 0.42, -0.275);
    torus(2.04, 0.072, metal, -0.55, 0.42, 0.026);
    disc(1.84, 0.055, ivory, -0.55, 0.42, 0.095);
    torus(1.84, 0.042, metal, -0.55, 0.42, 0.139);
    const face = canvasTexture(1024, 1024);
    resources.texture(face.texture);
    const paintFace = () => {
      const ctx = face.context;
      ctx.clearRect(0, 0, 1024, 1024);
      ctx.strokeStyle = ctx.fillStyle = "#51442b";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < 60; i++) {
        const a = (i * Math.PI) / 30;
        ctx.lineWidth = i % 5 === 0 ? 4 : 1.5;
        ctx.beginPath();
        ctx.moveTo(512 + Math.sin(a) * 472, 512 - Math.cos(a) * 472);
        ctx.lineTo(
          512 + Math.sin(a) * (i % 5 === 0 ? 432 : 453),
          512 - Math.cos(a) * (i % 5 === 0 ? 432 : 453),
        );
        ctx.stroke();
        if (i % 5 === 0) {
          ctx.font = "400 42px 'Instrument Serif', serif";
          ctx.fillText(
            String(i === 0 ? 60 : i),
            512 + Math.sin(a) * 391,
            512 - Math.cos(a) * 391,
          );
        }
      }
      face.texture.needsUpdate = true;
    };
    paintFace();
    resources.printing.push(paintFace);
    const clock = new THREE.Mesh(
      new THREE.CircleGeometry(1.77, 96),
      resources.material(
        new THREE.MeshStandardMaterial({
          map: face.texture,
          transparent: true,
          depthWrite: false,
          roughness: 0.96,
        }),
      ),
    );
    clock.position.set(-0.55, 0.42, 0.124);
    body.add(clock);
    hand = new THREE.Group();
    hand.position.set(-0.55, 0.42, 0.155);
    body.add(hand);
    box(0.035, 1.35, 0.025, 0.008, dark, 0, 0.65, 0, hand);
    box(0.1, 0.35, 0.024, 0.025, metal, 0, -0.17, 0, hand);
    disc(0.072, 0.05, metal, -0.55, 0.42, 0.175);
    dynamicReadout([-0.55, 0.29], 1.72, 0.5, "ink", 0.126);
    ink("CHRONOMETRIST / 1893", 2.2, 0.12, -0.55, 1.4, 0.124, "#51442b");
    disc(0.62, 0.09, dark, -0.55, -0.65, 0.16);
    gear(-0.93, -0.65, 0.33, 0.23, 0.18);
    gear(-0.35, -0.72, 0.25, 0.23, -0.24);
    gear(-0.5, -0.18, 0.28, 0.23, 0.21);
    const crystal = new THREE.Mesh(new THREE.CircleGeometry(1.79, 96), glass);
    crystal.position.set(-0.55, 0.42, 0.34);
    body.add(crystal);
    box(6.2, 1.46, 0.55, 0.12, wood, 0, -2.28, -0.235);
    box(5.95, 1.29, 0.026, 0.08, metal, 0, -2.28, 0.052);
    box(1.6, 2.5, 0.28, 0.09, wood, 2.1, 0.3, -0.06);
    dial(2.1, 0.25, 0.6, 0.08, "key");
    plaque("WIND / MIN", 2.1, -0.63, 1.22, 0.24, 0.081, metal, "#4e3b23");
    selector(-1.56, -2.23, 0.067, "arc");
    button("reset", "R", -2.6, -2.22, 0.32, 0.32, 0.067, "round", ivory);
    idleWheel(-0.35, -2.28, 0.067, "gear");
    button("clicker", "•", 0.24, -2.28, 0.28, 0.28, 0.067, "round", metal);
    toggle("sound", 1.1, -2.28, 0.067, "lever");
    toggle("auto", 2.17, -2.28, 0.067, "lever");
    // Chain attaches to a solid top bracket; the handle travels when pulled.
    box(0.55, 0.3, 0.22, 0.05, metal, 2.77, 1.48, 0.12);
    for (let i = 0; i < 25; i++) {
      const link = torus(0.055, 0.014, metal, 2.77, -0.64 + i * 0.135, 0.23);
      if (i % 2) link.rotation.y = Math.PI / 2;
      chainLinks.push(link);
    }
    startMechanism = new THREE.Group();
    startMechanism.position.set(2.77, -0.86, 0.28);
    body.add(startMechanism);
    disc(0.18, 0.16, metal, 0, 0, 0, startMechanism);
    disc(0.1, 0.08, ivory, 0, -0.15, 0, startMechanism);
    anchor("start", 2.77, -0.97, 0.4, 0.58, 0.73);
    plaque("PULL / RELEASE", 2.11, 1.35, 1.13, 0.24, 0.081, metal, "#4e3b23");
    tube(
      [
        new THREE.Vector3(-2.57, 0.8, 0.03),
        new THREE.Vector3(-2.77, 1.5, 0.03),
        new THREE.Vector3(-2.63, 1.85, 0.03),
      ],
      0.07,
      metal,
    );
    cycle(-0.55, 2.04, 0.124);
    feet.push([-2.62, -2.28], [2.62, -2.28], [-1.7, 1.54], [0.8, 1.54]);
  } else if (style === "soviet") {
    // A upright laboratory console, rotary mode switch and two round plungers.
    box(5.25, 5.22, 0.61, 0.11, shell, 0, -0.04, -0.2);
    box(4.98, 4.98, 0.026, 0.035, shell, 0, -0.04, 0.118);
    bolts(4.72, 4.72, 0.145, 0.067);
    box(4.35, 1.52, 0.04, 0.025, dark, 0, 1.4, 0.151);
    const readouts: Array<ReturnType<typeof canvasTexture>> = [];
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 0.94;
      disc(0.39, 0.09, dark, x, 1.4, 0.208);
      torus(0.367, 0.023, metal, x, 1.4, 0.262);
      const envelope = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.325, 0.7, 8, 32),
        glass,
      );
      envelope.scale.z = 0.55;
      envelope.position.set(x, 1.4, 0.43);
      body.add(envelope);
      for (let wire = 0; wire < 5; wire++)
        box(
          0.006,
          1.01,
          0.008,
          0.002,
          metal,
          x - 0.27 + wire * 0.135,
          1.4,
          0.29,
        );
      const target = canvasTexture(256, 512);
      resources.texture(target.texture);
      readouts.push(target);
      const digit = new THREE.Mesh(
        new THREE.PlaneGeometry(0.61, 1.13),
        resources.material(
          new THREE.MeshBasicMaterial({
            map: target.texture,
            color: new THREE.Color(0xff8433).multiplyScalar(3.4),
            transparent: true,
            depthWrite: false,
            toneMapped: false,
          }),
        ),
      );
      digit.position.set(x, 1.4, 0.53);
      body.add(digit);
      const light = new THREE.PointLight(0xff8a37, 0.055, 1.2, 2);
      light.position.set(x, 1.4, 0.64);
      body.add(light);
      lights.push(light);
    }
    painters.push((state) => {
      const digits =
        String(Math.floor(state.remaining / 60)).padStart(2, "0") +
        String(state.remaining % 60).padStart(2, "0");
      readouts.forEach((target, i) => {
        const ctx = target.context;
        ctx.clearRect(0, 0, 256, 512);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "400 352px 'DM Mono', monospace";
        ctx.fillStyle = "rgba(255,200,150,.015)";
        for (let j = 0; j < 10; j++) ctx.fillText(String(j), 128, 257);
        ctx.fillStyle = "#fff2db";
        ctx.fillText(digits[i], 128, 257);
        target.texture.needsUpdate = true;
      });
    });
    ink("ХРОНОС / ЛАБОРАТОРИЯ ВРЕМЕНИ", 3.8, 0.14, 0, 2.29, 0.132);
    ink("МИНУТЫ             СЕКУНДЫ", 3.5, 0.12, 0, 0.52, 0.132);
    selector(-1.4, -0.28, 0.132, "arc");
    ink("РЕЖИМ", 1.2, 0.13, -1.4, -1.05, 0.132);
    dial(1.19, -0.31, 0.83, 0.132, "bakelite");
    ink("ВРЕМЯ / МИН", 1.5, 0.13, 1.19, -1.35, 0.132);
    button(
      "start",
      "ПУСК / СТОП",
      -1.58,
      -1.66,
      0.74,
      0.74,
      0.132,
      "round",
      accent,
    );
    button("reset", "СБРОС", -0.52, -1.66, 0.5, 0.5, 0.132, "round", dark);
    // Both switch plates are well above the bottom rim, with room for the stem.
    toggle("sound", 1.04, -1.81, 0.132, "lever");
    toggle("auto", 2.04, -1.81, 0.132, "lever");
    idleWheel(-0.89, -2.35, 0.132, "spring");
    idleKind = "spring";
    button("clicker", "•", -2.25, -0.96, 0.25, 0.25, 0.132, "round", ivory);
    cycle(0, 2.68, -0.03);
    box(2.05, 0.13, 0.15, 0.04, dark, 0, 2.87, -0.14);
    for (const side of [-1, 1])
      box(0.12, 0.51, 0.15, 0.02, metal, side * 0.96, 2.61, -0.14);
    // Diagnostic bar has its own mounting lip under the handle.
    box(1.34, 0.29, 0.17, 0.035, shell, 0, 2.68, -0.1);
    feet.push([-2.12, -2.29], [2.12, -2.29], [-2.12, 2.12], [2.12, 2.12]);
  } else if (style === "dieselpunk") {
    // Two separate engine pods joined by exposed pipes, not a faceplate box.
    box(3.0, 3.42, 0.44, 0.12, shell, -1.99, -0.88, -0.23);
    box(2.7, 3.13, 0.04, 0.05, metal, -1.99, -0.88, 0.03);
    box(1.58, 4.12, 0.5, 0.1, shell, 1.61, -0.12, -0.21);
    box(1.36, 3.8, 0.033, 0.04, metal, 1.61, -0.12, 0.061);
    box(4.57, 1.64, 0.11, 0.08, shell, -1.18, 1.35, -0.39);
    box(4.33, 1.46, 0.025, 0.025, dark, -1.18, 1.35, -0.14);
    counter = mechanicalCounter(
      body,
      3.95,
      {
        texture: resources.texture,
        material: resources.material,
        printing: resources.printing,
      },
      polymer.bumpMap,
    );
    counter.group.position.set(-1.18, 1.35, 0.43);
    for (const side of [-1, 1]) {
      box(4.37, 0.12, 0.4, 0.018, metal, -1.18, 1.35 + side * 0.77, 0.12);
      box(0.13, 1.45, 0.4, 0.018, metal, -1.18 + side * 2.12, 1.35, 0.12);
    }
    box(3.7, 0.39, 0.1, 0.045, shell, -1.18, 2.26, -0.355);
    plaque("IRONWORKS / MK IV", -1.18, 2.27, 3.65, 0.29, -0.31, metal);
    box(0.75, 2.48, 0.2, 0.035, shell, -3.79, -0.42, -0.08);
    dial(-3.8, -0.24, 0.76, 0.028, "crank");
    plaque("CRANK", -3.8, -1.4, 0.76, 0.21, 0.025, dark);
    selector(-1.99, -2.05, 0.052, "rail");
    plaque("GEAR / I II III", -1.99, -2.48, 2.1, 0.2, 0.052, dark);
    toggle("sound", -2.55, -1.08, 0.052, "rocker");
    toggle("auto", -1.4, -1.08, 0.052, "rocker");
    idleWheel(-1.99, 0.04, 0.052, "piston");
    idleKind = "piston";
    button("reset", "RESET", 1.61, -1.52, 0.49, 0.49, 0.079, "round", accent);
    button("clicker", "OIL", 2.23, -2.0, 0.29, 0.29, 0.079, "round", dark);
    // A gated ignition handle has a long physical travel, driven by pointer drag.
    box(0.23, 2.32, 0.04, 0.035, dark, 1.61, 0.34, 0.101);
    for (const side of [-1, 1])
      box(0.025, 2.25, 0.012, 0.006, accent, 1.61 + side * 0.23, 0.34, 0.124);
    plaque("IGNITION / PULL", 1.61, 1.53, 1.15, 0.25, 0.079, dark);
    startMechanism = new THREE.Group();
    startMechanism.position.set(1.61, -0.3, 0.27);
    body.add(startMechanism);
    box(0.14, 1.13, 0.12, 0.025, metal, 0, 0.48, 0.13, startMechanism);
    const grip = box(
      0.78,
      0.2,
      0.24,
      0.06,
      dark,
      0,
      1.03,
      0.13,
      startMechanism,
    );
    grip.rotation.z = 0.06;
    anchor("start", 1.61, 0.4, 0.56, 1.02, 1.93);
    cycle(1.61, 1.98, 0.079);
    for (const x of [-0.35, 0.1])
      tube(
        [
          new THREE.Vector3(x, -1.89, -0.03),
          new THREE.Vector3(x, 0.5, -0.03),
          new THREE.Vector3(0.76, 0.9, -0.03),
        ],
        0.08,
        metal,
      );
    tube(
      [
        new THREE.Vector3(-3.0, 2.05, -0.11),
        new THREE.Vector3(-3.0, 2.57, -0.11),
        new THREE.Vector3(-2.91, 2.75, -0.11),
      ],
      0.12,
      dark,
    );
    for (let i = 0; i < 5; i++) {
      const rib = box(
        1.72,
        0.1,
        0.05,
        0.02,
        dark,
        -1.99,
        -0.44 + i * 0.14,
        0.078,
      );
      rib.rotation.z = 0.02;
    }
    for (const [x, y] of [
      [-3.12, -2.32],
      [-0.88, -2.32],
      [1.15, -1.86],
      [2.11, 1.53],
    ] as const)
      disc(0.075, 0.032, metal, x, y, 0.092, body, 6);
    feet.push([-3.02, -2.3], [-0.9, -2.3], [1.16, -1.84], [2.08, 1.58]);
  } else {
    // An astrolabe held by claws: the duration control is the outer ring itself.
    const oy = 0.57;
    disc(1.98, 0.12, metal, 0, oy, -0.16);
    disc(1.87, 0.08, shell, 0, oy, -0.055);
    torus(1.92, 0.045, metal, 0, oy, 0.11);
    rotary = new THREE.Group();
    rotary.position.set(0, oy, 0.27);
    body.add(rotary);
    torus(2.13, 0.052, metal, 0, 0, 0, rotary);
    torus(2.12, 0.012, glow, 0, 0, 0.038, rotary);
    for (let i = 0; i < 32; i++) {
      const a = (i * Math.PI) / 16;
      const rune = box(
        0.027,
        0.13,
        0.018,
        0.004,
        i % 4 === 0 ? glow : metal,
        Math.sin(a) * 2.13,
        Math.cos(a) * 2.13,
        0.05,
        rotary,
      );
      rune.rotation.z = -a;
    }
    anchor("dial", 2.02, oy, 0.36, 0.53, 1.7);
    const orbit = torus(1.61, 0.026, metal, 0, oy, 0.43);
    orbit.rotation.y = 0.33;
    gears.push({ node: orbit, speed: 0.023 });
    torus(1.4, 0.012, glow, 0, oy, 0.5);
    dynamicReadout([0, oy], 2.5, 1.02, "arcane", 1.7);
    // The orb is the start control. Hold it to charge, then release the seal.
    anchor("start", 0, oy, 1.71, 1.78, 1.23);
    for (let i = 0; i < 3; i++) {
      const a = (i - 1) * 0.8;
      const x = Math.sin(a) * 1.72,
        y = oy - Math.cos(a) * 1.72;
      box(0.7, 0.8, 0.36, 0.07, shell, x, y, 0.165);
      button(
        modeNames[i],
        ["FOCUS", "REST", "DREAM"][i],
        x,
        y,
        0.38,
        0.4,
        0.346,
        "gem",
        glow,
      );
    }
    box(3.97, 0.93, 0.55, 0.11, shell, 0, -2.36, -0.25);
    box(3.76, 0.76, 0.025, 0.05, metal, 0, -2.36, 0.04);
    toggle("sound", -1.24, -2.36, 0.054, "gem");
    toggle("auto", 1.24, -2.36, 0.054, "gem");
    button("reset", "RETURN", 0, -2.36, 0.33, 0.34, 0.054, "gem", metal);
    idleWheel(-2.28, -0.34, 0.12, "pendulum");
    idleKind = "pendulum";
    button("clicker", "✧", 2.02, -1.76, 0.3, 0.33, 0.054, "gem", metal);
    // Supports connect the rings, pendulum and outer seal to the pedestal.
    for (const side of [-1, 1])
      tube(
        [
          new THREE.Vector3(side * 1.61, -2.01, -0.12),
          new THREE.Vector3(side * 1.88, -0.4, 0.08),
          new THREE.Vector3(side * 1.65, 1.55, 0.1),
        ],
        0.095,
        metal,
      );
    tube(
      [
        new THREE.Vector3(-1.61, -2.01, -0.12),
        new THREE.Vector3(-2.4, -1.0, 0.1),
        new THREE.Vector3(-2.28, 0.3, 0.12),
      ],
      0.055,
      metal,
    );
    box(0.47, 0.58, 0.16, 0.055, shell, 2.02, -1.76, -0.038);
    plaque("THE AETHER ENGINE", 0, 2.81, 2.34, 0.28, -0.015, metal, "#493551");
    for (const side of [-1, 1])
      disc(0.025, 0.1, metal, side * 0.8, 2.76, -0.045);
    tube(
      [
        new THREE.Vector3(-1.1, 2.19, -0.08),
        new THREE.Vector3(-0.8, 2.72, -0.08),
        new THREE.Vector3(0.8, 2.72, -0.08),
        new THREE.Vector3(1.1, 2.19, -0.08),
      ],
      0.04,
      metal,
    );
    cycle(0, -1.8, 0.054);
    box(1.35, 0.26, 0.12, 0.03, shell, 0, -1.8, -0.005);
    const light = new THREE.PointLight(0x9578ff, 0.22, 5, 2);
    light.position.set(0, oy, 1.7);
    body.add(light);
    lights.push(light);
    feet.push([-1.61, -2.39], [1.61, -2.39], [-1.4, 1.3], [1.4, 1.3]);
  }
  // Every foot joins the case and touches the same transparent shadow plane.
  for (const [x, y] of feet) {
    disc(0.095, 0.52, metal, x, y, -0.4);
    disc(0.15, 0.15, dark, x, y, -0.665);
  }
  const extent = new THREE.Box3().setFromObject(body);
  const bounds = extent.getSize(new THREE.Vector3());
  const center = extent.getCenter(new THREE.Vector3());
  body.position.set(-center.x, -center.y, 0);
  const effects = createEffects(style, compact, resources);
  body.add(effects.group);
  let energy = 0,
    elapsed = 0,
    signature = "";
  const positions: Record<string, number> = {},
    velocities: Record<string, number> = {};
  return {
    anchors,
    housing: body,
    wood,
    bounds,
    update(state: PhysicalState, dt: number) {
      elapsed += state.reducedMotion ? 0 : dt;
      let moving = false;
      const targetEnergy = state.pressed
        ? Math.max(0.35, state.actuation)
        : state.running
          ? 0.55
          : 0.18;
      energy = state.reducedMotion
        ? targetEnergy
        : energy + (targetEnergy - energy) * (1 - Math.exp(-dt * 12));
      if (Math.abs(targetEnergy - energy) > 0.001) moving = true;
      pilots.forEach(({ name, material }) => {
        material.emissiveIntensity = (
          name === "sound" ? state.sound : state.auto
        )
          ? 2.0
          : 0.025;
      });
      cycleLenses.forEach((lamp, i) => {
        lamp.emissiveIntensity =
          i < state.cycleCompleted ? 1.7 : i === state.round - 1 ? 0.7 : 0.055;
      });
      for (const motion of motions) {
        const active = state.pressed === motion.name,
          selected =
            modeNames.includes(motion.name) && state.mode === motion.name;
        const enabled = motion.name === "sound" ? state.sound : state.auto;
        const target = motion.lever
          ? active
            ? 0
            : enabled
              ? -0.48
              : 0.48
          : active
            ? 1
            : selected
              ? 0.23
              : 0;
        const id = motion.name;
        let p = positions[id] ?? target,
          v = velocities[id] ?? 0;
        if (state.reducedMotion) {
          p = target;
          v = 0;
        } else {
          const steps = Math.max(1, Math.ceil(dt / 0.006));
          for (let i = 0; i < steps; i++) {
            const h = dt / steps;
            v += ((target - p) * 1250 - v * 55) * h;
            p += v * h;
          }
        }
        positions[id] = p;
        velocities[id] = v;
        if (Math.abs(p - target) > 0.0001 || Math.abs(v) > 0.001) moving = true;
        if (motion.lever) motion.node.rotation.x = p;
        else {
          motion.node.position.z = motion.z - p * motion.travel;
          motion.node.rotation.x = -p * 0.016;
        }
      }
      if (rotary) {
        const target = -state.dialAngle,
          diff = target - rotary.rotation.z;
        rotary.rotation.z = state.reducedMotion
          ? target
          : rotary.rotation.z + diff * (1 - Math.exp(-dt * 26));
        if (Math.abs(diff) > 0.0001) moving = true;
      }
      const settle = (current: number, target: number, speed = 24) => {
        if (state.reducedMotion || Math.abs(current - target) < 0.0001)
          return target;
        moving = true;
        return current + (target - current) * (1 - Math.exp(-dt * speed));
      };
      if (slider) {
        const range = compact ? 3.36 : 4.35;
        slider.position.x = settle(
          slider.position.x,
          state.durationFraction * range - range / 2,
        );
      }
      if (modePointer) {
        const index = modeNames.indexOf(state.mode);
        if (selectorKind === "arc")
          modePointer.rotation.z = settle(
            modePointer.rotation.z,
            -(index - 1) * 0.95,
          );
        else
          modePointer.position.x = settle(
            modePointer.position.x,
            -1.99 + (index - 1) * 0.7,
          );
      }
      if (startMechanism) {
        if (style === "steampunk") {
          startMechanism.position.y = settle(
            startMechanism.position.y,
            -0.86 - state.actuation * 0.57,
            30,
          );
          chainLinks.forEach((link, i) => {
            link.position.y = startMechanism!.position.y + 0.22 + i * 0.135;
            link.visible = link.position.y <= 1.35;
          });
        } else
          startMechanism.rotation.x = settle(
            startMechanism.rotation.x,
            (state.running ? -0.55 : 0.13) - state.actuation * 0.85,
            24,
          );
      }
      if (roller) {
        if (idleKind === "piston")
          roller.position.y = 0.04 + Math.sin(state.rollerAngle) * 0.17;
        else if (idleKind === "pendulum")
          roller.rotation.z = Math.sin(state.rollerAngle) * 0.48;
        else if (idleKind === "spring")
          roller.rotation.x = Math.sin(state.rollerAngle) * 0.28;
        else roller.rotation.z = state.rollerAngle;
      }
      if (hand) hand.rotation.z = (-state.remaining / 3600) * Math.PI * 2;
      const next = `${state.remaining}:${state.status}:${state.mode}:${state.round}`;
      if (signature !== next) {
        painters.forEach((paint) => paint(state));
        signature = next;
      }
      if (counter) {
        counter.set(state.remaining, state.running && !state.reducedMotion);
        if (counter.tick(dt)) moving = true;
      }
      if (!state.reducedMotion)
        for (const { node, speed } of gears)
          node.rotation.z += dt * speed * (state.running ? 1 : 0.35);
      effects.update(
        state.reducedMotion ? 0 : elapsed,
        energy,
        state.actuation,
      );
      lights.forEach((light) => {
        light.intensity =
          (style === "arcane" ? 0.22 : 0.055) * (1 + energy * 0.45);
      });
      glow.emissiveIntensity = (style === "arcane" ? 1.6 : 2.1) + energy * 1.4;
      return moving || (!state.reducedMotion && style !== "soviet");
    },
    refresh() {
      signature = "";
    },
  };
}
