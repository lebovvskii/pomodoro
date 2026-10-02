import * as THREE from "three";
import type { Mode, TimerStatus } from "@/hooks/use-focus-timer";

export type Readout = {
  mode: Mode;
  status: TimerStatus;
  remaining: number;
  duration: number;
  round: number;
};

export function canvasTexture(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { canvas, context, texture };
}

type Finish = "enamel" | "polymer" | "metal";

/** Correlated albedo, height and roughness; the coarse grain survives minification. */
export function surfaceFinish(kind: Finish, size = 512) {
  let seed = kind === "metal" ? 31273 : kind === "polymer" ? 61247 : 73471;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const noise = (cells: number) => {
    const grid = Float32Array.from({ length: cells * cells }, random);
    return (x: number, y: number) => {
      const gx = (x / size) * cells,
        gy = (y / size) * cells;
      const ix = Math.floor(gx),
        iy = Math.floor(gy);
      const fx = gx - ix,
        fy = gy - iy;
      const sx = fx * fx * (3 - 2 * fx),
        sy = fy * fy * (3 - 2 * fy);
      const at = (dx: number, dy: number) =>
        grid[((iy + dy) % cells) * cells + ((ix + dx) % cells)];
      return THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(at(0, 0), at(1, 0), sx),
        THREE.MathUtils.lerp(at(0, 1), at(1, 1), sx),
        sy,
      );
    };
  };
  const mottling = noise(9),
    coating = noise(37),
    grain = noise(kind === "enamel" ? 215 : 170);
  const color = canvasTexture(size, size),
    height = canvasTexture(size, size),
    roughness = canvasTexture(size, size);
  const c = color.context.createImageData(size, size),
    h = height.context.createImageData(size, size),
    r = roughness.context.createImageData(size, size);
  const lines = Float32Array.from({ length: size }, random);
  const put = (pixels: ImageData, i: number, value: number) => {
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
    pixels.data[i + 3] = 255;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const broad = mottling(x, y),
        mid = coating(x, y),
        pebble = grain(x, y),
        fine = random();
      // Oily finger contact is smoother than the untouched molded rim.
      const finger =
        kind === "polymer"
          ? Math.exp(-((x / size - 0.48) ** 2 + (y / size - 0.51) ** 2) * 15)
          : 0;
      const heightValue =
        kind === "metal"
          ? 108 + lines[y] * 65 + mid * 9 + fine * 10
          : 103 + pebble * 75 + mid * 18 + fine * 9;
      const roughValue =
        kind === "metal"
          ? 136 + lines[y] * 47 + broad * 32
          : 191 + mid * 34 + pebble * 24 - finger * 70;
      const tone =
        kind === "metal"
          ? 220 + broad * 21 + lines[y] * 8
          : 223 + broad * 20 + mid * 8 + fine * 3;
      put(c, i, tone);
      put(h, i, heightValue);
      put(r, i, roughValue);
    }
  }
  color.context.putImageData(c, 0, 0);
  height.context.putImageData(h, 0, 0);
  roughness.context.putImageData(r, 0, 0);
  // Sparse tool marks interrupt the directional finish; these aren't uniform noise.
  for (let i = 0; i < (kind === "metal" ? 48 : 16); i++) {
    const x = random() * size,
      y = random() * size;
    const dx = kind === "metal" ? 9 + random() * 105 : 3 + random() * 20;
    const dy = (random() - 0.5) * (kind === "metal" ? 3 : 13);
    for (const layer of [color, height, roughness]) {
      layer.context.strokeStyle =
        layer === height
          ? "rgba(33,33,33,.26)"
          : layer === roughness
            ? "rgba(245,245,245,.42)"
            : "rgba(110,106,96,.12)";
      layer.context.lineWidth = 0.55 + random() * 0.6;
      layer.context.beginPath();
      layer.context.moveTo(x, y);
      layer.context.lineTo(x + dx, y + dy);
      layer.context.stroke();
    }
  }
  for (const layer of [color, height, roughness]) {
    layer.texture.wrapS = layer.texture.wrapT = THREE.RepeatWrapping;
    layer.texture.needsUpdate = true;
  }
  height.texture.colorSpace = roughness.texture.colorSpace = THREE.NoColorSpace;
  return {
    color: color.texture,
    height: height.texture,
    roughness: roughness.texture,
  };
}

/** Local abrasion: exposed primer, fine scratches and accumulated dirt at edges. */
export function panelWear(
  aspect: number,
  opening?: { x: number; y: number; width: number; height: number },
) {
  const width = 1536,
    height = Math.round(width / aspect);
  const layer = canvasTexture(width, height);
  const { context } = layer;
  let seed = 32837;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 210; i++) {
    const edge = i % 4;
    const x =
      edge < 2
        ? random() * width
        : edge === 2
          ? random() * 10
          : width - random() * 10;
    const y =
      edge < 2
        ? edge === 0
          ? random() * 9
          : height - random() * 9
        : random() * height;
    context.fillStyle =
      i % 5 === 0 ? "rgba(193,181,153,.55)" : "rgba(80,72,54,.19)";
    context.fillRect(x, y, 1 + random() * 8, 0.5 + random() * 1.7);
  }
  for (let i = 0; i < 32; i++) {
    const x = random() * width,
      y = random() * height;
    context.strokeStyle = "rgba(100,85,59,.12)";
    context.lineWidth = 0.65;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 4 + random() * 23, y + (random() - 0.5) * 6);
    context.stroke();
  }
  if (opening)
    context.clearRect(
      (opening.x - opening.width / 2) * width,
      (opening.y - opening.height / 2) * height,
      opening.width * width,
      opening.height * height,
    );
  layer.texture.needsUpdate = true;
  return layer.texture;
}

export function glassFinish() {
  const { context, texture } = canvasTexture(1024, 512);
  context.fillStyle = "#777";
  context.fillRect(0, 0, 1024, 512);
  let seed = 19873;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // Almost invisible cleaning traces and a few dust flecks catch the softbox.
  for (let i = 0; i < 130; i++) {
    context.strokeStyle = `rgba(165,165,165,${0.05 + random() * 0.1})`;
    context.lineWidth = 0.4;
    const x = random() * 1024,
      y = random() * 512;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + random() * 85, y - random() * 8);
    context.stroke();
  }
  for (let i = 0; i < 85; i++) {
    context.fillStyle = "rgba(200,200,200,.22)";
    context.fillRect(random() * 1024, random() * 512, 1, 1);
  }
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function printedLabel(
  text: string,
  color = "#42483e",
  secondary?: string,
  aspect = 8,
) {
  const height = Math.max(48, Math.round(1024 / aspect));
  const { context, texture } = canvasTexture(1024, height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = color;
  let size = height * (secondary ? 0.34 : 0.73);
  context.font = `500 ${size}px 'DM Sans', sans-serif`;
  size *= Math.min(1, 970 / context.measureText(text).width);
  context.font = `500 ${size}px 'DM Sans', sans-serif`;
  context.fillText(text, 512, height * (secondary ? 0.33 : 0.52));
  if (secondary) {
    context.globalAlpha = 0.6;
    context.font = `400 ${height * 0.25}px 'DM Mono', monospace`;
    context.fillText(secondary, 512, height * 0.76, 950);
  }
  texture.needsUpdate = true;
  return texture;
}

/** Only the printed legends; the four moving cards are actual scene geometry. */
export function drawReadout(context: CanvasRenderingContext2D, state: Readout) {
  const width = context.canvas.width,
    height = context.canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#191b15";
  context.fillRect(0, 0, width, height);
  context.save();
  context.scale(width / 2048, height / 768);
  context.textBaseline = "middle";
  context.font = "500 38px 'DM Mono', monospace";
  context.fillStyle = "#c9bd98";
  context.textAlign = "left";
  context.fillText(
    state.status === "running"
      ? "SESSION IN PROGRESS"
      : state.status === "paused"
        ? "PAUSED · PLACE SAVED"
        : "READY WHEN YOU ARE",
    92,
    64,
  );
  context.textAlign = "right";
  const modeName =
    state.mode === "focus"
      ? "FOCUS"
      : state.mode === "short"
        ? "SHORT REST"
        : "LONG REST";
  context.fillText(
    `${modeName} · ${String(state.round).padStart(2, "0")} / 04`,
    1956,
    64,
  );
  context.font = "400 26px 'DM Mono', monospace";
  context.textAlign = "left";
  context.fillStyle = "#b3ab89";
  context.fillText("MINUTES", 590, 687);
  context.fillText("SECONDS", 1315, 687);
  const progress = Math.max(
    0,
    Math.min(1, 1 - state.remaining / (state.duration * 60)),
  );
  for (let i = 0; i < 24; i++) {
    context.fillStyle = i < progress * 24 ? "#c19b54" : "#434637";
    context.fillRect(1790 + (i % 12) * 13, 673 + Math.floor(i / 12) * 12, 7, 6);
  }
  context.restore();
}

/** Three permanent calibrations: focus, short rest and long rest share a spindle. */
export function drawDialScale(context: CanvasRenderingContext2D) {
  const size = context.canvas.width,
    center = size / 2;
  context.clearRect(0, 0, size, size);
  const calibrations = [
    { min: 5, max: 90, step: 5, radius: 0.462, color: "#424936", name: "F" },
    { min: 1, max: 30, step: 1, radius: 0.397, color: "#977448", name: "S" },
    { min: 5, max: 60, step: 5, radius: 0.332, color: "#686b57", name: "L" },
  ];
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (const scale of calibrations) {
    const at = (fraction: number, radius: number) => {
      const angle = ((-135 + fraction * 270) * Math.PI) / 180;
      return [
        center + Math.sin(angle) * radius * size,
        center - Math.cos(angle) * radius * size,
      ];
    };
    context.strokeStyle = context.fillStyle = scale.color;
    for (let value = scale.min; value <= scale.max; value += scale.step) {
      const fraction = (value - scale.min) / (scale.max - scale.min);
      const major =
        value === scale.min ||
        value === scale.max ||
        (scale.name === "S" ? value % 10 === 0 : value % 15 === 0);
      const p = at(fraction, scale.radius),
        q = at(fraction, scale.radius - (major ? 0.02 : 0.01));
      context.lineWidth = major ? 2.8 : 1.5;
      context.beginPath();
      context.moveTo(...(p as [number, number]));
      context.lineTo(...(q as [number, number]));
      context.stroke();
      if (major) {
        const textAt = at(fraction, scale.radius - 0.025);
        context.font = "500 58px 'DM Mono', monospace";
        context.fillText(String(value).padStart(2, "0"), textAt[0], textAt[1]);
      }
    }
    context.font = "500 38px 'DM Mono', monospace";
    context.fillText(
      scale.name,
      center + (scale.name === "F" ? -50 : scale.name === "S" ? 0 : 50),
      size * 0.842,
    );
  }
  context.fillStyle = "#545945";
  context.font = "500 38px 'DM Sans', sans-serif";
  context.fillText("MINUTES", center, size * 0.891);
}
