import * as THREE from "three";
import { canvasTexture } from "./surface-textures";

type Resources = {
  texture: (texture: THREE.Texture) => THREE.Texture;
  material: <T extends THREE.Material>(material: T) => T;
  printing: Array<() => void>;
};

/** Printed split cards, hinged into the recess rather than glowing screen pixels. */
export function mechanicalCounter(
  parent: THREE.Object3D,
  width: number,
  resources: Resources,
  cardBump: THREE.Texture,
) {
  const group = new THREE.Group();
  parent.add(group);
  const numerals = Array.from({ length: 10 }, (_, digit) => {
    const { context, texture } = canvasTexture(256, 384);
    const paint = () => {
      context.fillStyle = "#c9bd9d";
      context.fillRect(0, 0, 256, 384);
      const curl = context.createLinearGradient(0, 0, 0, 384);
      curl.addColorStop(0, "#645d392c");
      curl.addColorStop(0.08, "#ffffff04");
      curl.addColorStop(0.48, "#ffffff09");
      curl.addColorStop(0.5, "#645c391a");
      curl.addColorStop(0.94, "#ffffff0c");
      curl.addColorStop(1, "#4c452525");
      context.fillStyle = curl;
      context.fillRect(0, 0, 256, 384);
      context.fillStyle = "#252b22";
      context.font = "500 310px 'DM Mono', monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(digit), 128, 201);
      let seed = 17713 + digit * 7919;
      for (let i = 0; i < 700; i++) {
        seed = (seed * 16807) % 2147483647;
        const x = seed % 256;
        seed = (seed * 16807) % 2147483647;
        context.fillStyle =
          i % 3 ? "rgba(72,65,39,.08)" : "rgba(218,207,171,.26)";
        context.fillRect(x, seed % 384, 0.6, 0.8);
      }
      texture.needsUpdate = true;
    };
    paint();
    resources.printing.push(paint);
    resources.texture(texture);
    return texture;
  });
  const cardWidth = width * 0.161,
    cardHeight = 1.01;
  const halfGeometry = (top: boolean) => {
    const geometry = new THREE.PlaneGeometry(cardWidth, cardHeight / 2);
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++)
      uv.setY(i, uv.getY(i) * 0.5 + (top ? 0.5 : 0));
    return geometry;
  };
  const topGeometry = halfGeometry(true),
    bottomGeometry = halfGeometry(false);
  const makeMaterial = () =>
    resources.material(
      new THREE.MeshStandardMaterial({
        map: numerals[0],
        roughness: 0.94,
        bumpMap: cardBump,
        bumpScale: 0.0008,
      }),
    );
  const axleMaterial = resources.material(
    new THREE.MeshStandardMaterial({
      color: 0x75694b,
      metalness: 0.8,
      roughness: 0.6,
    }),
  );
  const cells = Array.from({ length: 4 }, (_, i) => {
    const cell = new THREE.Group();
    cell.position.x = (i - (i < 2 ? 1.75 : 1.25)) * width * 0.187;
    cell.rotation.z = (i % 2 ? 1 : -1) * 0.0018;
    group.add(cell);
    const upper = new THREE.Mesh(topGeometry, makeMaterial());
    const lower = new THREE.Mesh(bottomGeometry, makeMaterial());
    upper.position.set(0, cardHeight / 4 + 0.004, 0);
    lower.position.set(0, -cardHeight / 4 - 0.004, 0);
    upper.receiveShadow = lower.receiveShadow = true;
    cell.add(upper, lower);
    const hinge = new THREE.Group();
    hinge.position.z = 0.008;
    hinge.visible = false;
    cell.add(hinge);
    const front = new THREE.Mesh(topGeometry, makeMaterial());
    const back = new THREE.Mesh(bottomGeometry, makeMaterial());
    front.position.set(0, cardHeight / 4 + 0.004, 0.001);
    back.position.set(0, cardHeight / 4 + 0.004, -0.001);
    back.rotation.x = Math.PI;
    front.receiveShadow = back.receiveShadow = true;
    hinge.add(front, back);
    for (const x of [-cardWidth / 2 - 0.005, cardWidth / 2 + 0.005]) {
      const axle = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.045, 0.023),
        axleMaterial,
      );
      axle.position.set(x, 0, 0.01);
      cell.add(axle);
    }
    return {
      upper,
      lower,
      front,
      back,
      hinge,
      digit: -1,
      target: 0,
      elapsed: 1,
      delay: 0,
    };
  });
  const colonMaterial = resources.material(
    new THREE.MeshStandardMaterial({ color: 0xb3a989, roughness: 1 }),
  );
  for (const y of [-0.12, 0.12]) {
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.022, 16),
      colonMaterial,
    );
    dot.position.set(0, y, 0.004);
    group.add(dot);
  }
  return {
    group,
    set(seconds: number, animate: boolean) {
      const digits =
        String(Math.floor(seconds / 60)).padStart(2, "0") +
        String(seconds % 60).padStart(2, "0");
      cells.forEach((cell, i) => {
        const next = Number(digits[i]);
        if (cell.target === next && cell.digit >= 0) {
          if (!animate && cell.elapsed < 1) {
            cell.lower.material.map = numerals[next];
            cell.hinge.visible = false;
            cell.elapsed = 1;
          }
          return;
        }
        // Finish any interrupted turn before installing a fresh card pair.
        const old = cell.digit < 0 ? next : cell.target;
        cell.upper.material.map = numerals[next];
        cell.lower.material.map =
          numerals[animate && cell.digit >= 0 ? old : next];
        cell.front.material.map = numerals[old];
        cell.back.material.map = numerals[next];
        cell.target = cell.digit = next;
        cell.elapsed = animate && old !== next ? 0 : 1;
        cell.delay = (3 - i) * 0.012;
        cell.hinge.rotation.x = 0;
        cell.hinge.visible = cell.elapsed === 0;
      });
    },
    tick(dt: number) {
      let moving = false;
      cells.forEach((cell) => {
        if (cell.elapsed >= 1) return;
        cell.delay -= dt;
        if (cell.delay > 0) {
          moving = true;
          return;
        }
        cell.elapsed = Math.min(1, cell.elapsed + dt / 0.22);
        const t = cell.elapsed;
        cell.hinge.rotation.x = -Math.PI * (t * t * (3 - 2 * t));
        if (t >= 1) {
          cell.lower.material.map = numerals[cell.target];
          cell.hinge.visible = false;
        } else moving = true;
      });
      return moving;
    },
  };
}
