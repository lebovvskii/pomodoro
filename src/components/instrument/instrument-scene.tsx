import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { buildApparatus } from "./apparatus-models";
import type { PhysicalState } from "./apparatus-styles";

type Props = PhysicalState & { onReady: (available: boolean) => void };

export default function InstrumentScene(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const state = useRef(props);
  state.current = props;
  const wake = useRef<() => void>(() => {});
  useEffect(
    () => wake.current(),
    [
      props.appearance,
      props.mode,
      props.status,
      props.remaining,
      props.duration,
      props.sound,
      props.auto,
      props.dialAngle,
      props.durationFraction,
      props.actuation,
      props.rollerAngle,
      props.pressed,
      props.reducedMotion,
      props.round,
      props.cycleCompleted,
    ],
  );

  useEffect(() => {
    const host = container.current;
    if (!host) return;
    const stage = host.parentElement!;
    const compact = state.current.compact;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        premultipliedAlpha: false,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      state.current.onReady(false);
      return;
    }
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, compact ? 1.6 : 1.8),
    );
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.94;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    // The page itself is the desk: no colored rectangle or opaque backdrop.
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(32, 2, 0.1, 80);
    const body = new THREE.Group();
    scene.add(body);
    const textures = new Set<THREE.Texture>();
    const materials = new Set<THREE.Material>();
    const ownTexture = <T extends THREE.Texture>(texture: T) => {
      textures.add(texture);
      return texture;
    };
    const ownMaterial = <T extends THREE.Material>(material: T) => {
      materials.add(material);
      return material;
    };
    const refreshPrinting: Array<() => void> = [];
    const apparatus = buildApparatus(state.current.appearance, compact, body, {
      texture: ownTexture,
      material: ownMaterial,
      printing: refreshPrinting,
    });
    const { anchors, housing, wood: walnut } = apparatus;
    const width = apparatus.bounds.x + 0.24;
    const height = apparatus.bounds.y + 0.3;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 70),
      ownMaterial(
        new THREE.ShadowMaterial({
          color: 0x000000,
          opacity: 0.23,
          depthWrite: false,
        }),
      ),
    );
    floor.position.z = -0.748;
    floor.receiveShadow = true;
    scene.add(floor);
    RectAreaLightUniformsLib.init();
    const softbox = new THREE.RectAreaLight(
      state.current.appearance === "cyberpunk"
        ? 0x9dd8ff
        : state.current.appearance === "arcane"
          ? 0xc6adff
          : 0xfff3db,
      2.5,
      6,
      5,
    );
    softbox.position.set(-5, 6, 5);
    softbox.lookAt(0, 0, 0);
    scene.add(softbox);
    const fill = new THREE.RectAreaLight(0xf0f1e5, 0.65, 5, 6);
    fill.position.set(6, -2, 7);
    fill.lookAt(0, 0, 0);
    scene.add(fill);
    const key = new THREE.DirectionalLight(0xfff5e3, 1.8);
    key.position.set(-6, 8, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(compact ? 1024 : 2048, compact ? 1024 : 2048);
    key.shadow.camera.left = -9;
    key.shadow.camera.right = 9;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -9;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 30;
    key.shadow.normalBias = 0.004;
    key.shadow.bias = -0.00015;
    key.shadow.radius = 3;
    scene.add(key);
    scene.add(new THREE.HemisphereLight(0xfff9ed, 0x8a8a7a, 0.35));
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    let environment = pmrem.fromScene(room, 0.025);
    room.dispose();
    scene.environment = environment.texture;
    scene.environmentIntensity =
      state.current.appearance === "cyberpunk" ||
      state.current.appearance === "arcane"
        ? 0.35
        : 0.65;
    scene.environmentRotation.y = 1.2;

    const multisampleTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: Math.min(compact ? 2 : 4, renderer.capabilities.maxSamples),
    });
    const composer = new EffectComposer(renderer, multisampleTarget);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object !== floor) {
        const material = object.material;
        if (!Array.isArray(material) && material.transparent)
          object.layers.set(1);
      }
    });
    camera.layers.enable(1);
    const ao = new GTAOPass(scene, camera, 512, 512);
    const renderAO = ao.render.bind(ao);
    ao.render = (...args) => {
      const layers = camera.layers.mask;
      camera.layers.disable(1);
      try {
        renderAO(...args);
      } finally {
        camera.layers.mask = layers;
      }
    };
    ao.updateGtaoMaterial({
      radius: 0.23,
      thickness: 0.35,
      distanceExponent: 2,
      distanceFallOff: 0.8,
      scale: 1,
      samples: 12,
    });
    ao.updatePdMaterial({ radius: 5, rings: 2, samples: 8 });
    ao.blendIntensity = 0.62;
    // AO shades the object without making the transparent desk or antialiased edges opaque.
    ao.blendMaterial.blendSrcAlpha = THREE.ZeroFactor;
    ao.blendMaterial.blendDstAlpha = THREE.OneFactor;
    ao.enabled = !compact;
    composer.addPass(ao);
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(512, 512),
      state.current.appearance === "arcane"
        ? 0.65
        : state.current.appearance === "cyberpunk"
          ? 0.48
          : 0.28,
      0.45,
      1.2,
    );
    bloom.blendMaterial.fragmentShader =
      bloom.blendMaterial.fragmentShader.replace(
        "gl_FragColor = opacity * texel;",
        "vec3 b = opacity * texel.rgb; float a = 1.0 - exp(-max(max(b.r,b.g),b.b) * 0.45); gl_FragColor = vec4(b, a);",
      );
    bloom.blendMaterial.blending = THREE.CustomBlending;
    bloom.blendMaterial.blendSrc = THREE.OneFactor;
    bloom.blendMaterial.blendDst = THREE.OneFactor;
    bloom.blendMaterial.blendSrcAlpha = THREE.OneFactor;
    bloom.blendMaterial.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
    composer.addPass(bloom);
    const output = new OutputPass();
    // Offscreen blending stores premultiplied color. Tone-map straight color for a
    // straight-alpha canvas, keeping soft shadow/edge colors independent of page color.
    output.material.fragmentShader = output.material.fragmentShader.replace(
      "gl_FragColor = texture2D( tDiffuse, vUv );",
      "gl_FragColor = texture2D( tDiffuse, vUv ); gl_FragColor.rgb /= max(gl_FragColor.a, 0.00001);",
    );
    composer.addPass(output);

    const controls = new Map(
      Array.from(stage.querySelectorAll<HTMLElement>("[data-control]")).map(
        (element) => [element.dataset.control!, element],
      ),
    );
    let frame = 0,
      disposed = false,
      contextLost = false,
      assetsReady = false,
      reportedReady = false;
    let lastTime = performance.now(),
      cameraDistance = 12;
    const home = { yaw: compact ? -0.07 : 0.13, pitch: compact ? 0.22 : 0.31 };
    const orbit = { ...home },
      targetOrbit = { ...home };
    let hoverYaw = 0,
      hoverPitch = 0;
    let inspecting: {
      pointer: number;
      x: number;
      y: number;
      yaw: number;
      pitch: number;
    } | null = null;
    let controlGesture: number | null = null;
    const vector = new THREE.Vector3();
    const projectControls = () => {
      body.updateMatrixWorld(true);
      for (const item of anchors) {
        const element = controls.get(item.name);
        if (!element) continue;
        let left = Infinity,
          right = -Infinity,
          top = Infinity,
          bottom = -Infinity;
        for (const x of [-0.5, 0.5])
          for (const y of [-0.5, 0.5]) {
            vector.set(
              item.center.x + item.width * x,
              item.center.y + item.height * y,
              item.center.z,
            );
            body.localToWorld(vector);
            vector.project(camera);
            const px = (vector.x + 1) * 50,
              py = (1 - vector.y) * 50;
            left = Math.min(left, px);
            right = Math.max(right, px);
            top = Math.min(top, py);
            bottom = Math.max(bottom, py);
          }
        element.style.left = `${left}%`;
        element.style.top = `${top}%`;
        element.style.width = `${right - left}%`;
        element.style.height = `${bottom - top}%`;
      }
    };
    const render = (now: number) => {
      frame = 0;
      if (disposed || contextLost || document.hidden) return;
      const value = state.current;
      // Keep particles modest on phones without slowing direct manipulation.
      if (
        compact &&
        assetsReady &&
        !value.pressed &&
        !inspecting &&
        controlGesture === null &&
        now - lastTime < 31
      ) {
        frame = requestAnimationFrame(render);
        return;
      }
      const dt = Math.min((now - lastTime) / 1000, 0.04);
      lastTime = now;
      let changing = false;
      const ease = (
        object: Record<string, number>,
        key: string,
        target: number,
        speed = 18,
      ) => {
        const difference = target - object[key];
        if (value.reducedMotion || Math.abs(difference) < 0.00008)
          object[key] = target;
        else {
          object[key] += difference * (1 - Math.exp(-dt * speed));
          changing = true;
        }
      };
      if (apparatus.update(value, dt)) changing = true;
      if (controlGesture === null && !value.pressed) {
        ease(
          orbit,
          "yaw",
          targetOrbit.yaw + (value.reducedMotion || inspecting ? 0 : hoverYaw),
          12,
        );
        ease(
          orbit,
          "pitch",
          targetOrbit.pitch +
            (value.reducedMotion || inspecting ? 0 : hoverPitch),
          12,
        );
      }
      camera.position
        .set(
          Math.sin(orbit.yaw) * Math.cos(orbit.pitch),
          Math.sin(orbit.pitch),
          Math.cos(orbit.yaw) * Math.cos(orbit.pitch),
        )
        .multiplyScalar(cameraDistance);
      camera.lookAt(0, compact ? -0.18 : -0.06, 0);
      camera.updateMatrixWorld();
      if (assetsReady) projectControls();
      composer.render(dt);
      if (assetsReady && !reportedReady) {
        reportedReady = true;
        state.current.onReady(true);
      }
      if (changing) frame = requestAnimationFrame(render);
    };
    const requestRender = () => {
      if (!frame && !disposed && !contextLost && !document.hidden) {
        lastTime = performance.now() - 16;
        frame = requestAnimationFrame(render);
      }
    };
    wake.current = requestRender;
    const resizeStage = () => {
      const w = host.clientWidth,
        h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = w / h;
      const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      cameraDistance = Math.max(
        (width / (2 * halfFov * camera.aspect)) * 1.17,
        (height / (2 * halfFov)) * (compact ? 1.12 : 1.18),
      );
      camera.updateProjectionMatrix();
      requestRender();
    };
    const resize = new ResizeObserver(resizeStage);
    resize.observe(host);
    resizeStage();
    const raycaster = new THREE.Raycaster();
    const pointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      if (
        (event.target as HTMLElement).closest("button, [role='slider'], input")
      ) {
        controlGesture = event.pointerId;
        return;
      }
      const bounds = host.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          1 - ((event.clientY - bounds.top) / bounds.height) * 2,
        ),
        camera,
      );
      if (!raycaster.intersectObject(housing, true).length) return;
      inspecting = {
        pointer: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        ...targetOrbit,
      };
      stage.setPointerCapture(event.pointerId);
      stage.classList.add("is-inspecting");
    };
    const pointerMove = (event: PointerEvent) => {
      if (controlGesture !== null) return;
      if (inspecting && inspecting.pointer === event.pointerId) {
        targetOrbit.yaw = THREE.MathUtils.clamp(
          inspecting.yaw + (event.clientX - inspecting.x) * 0.003,
          -0.36,
          0.42,
        );
        targetOrbit.pitch = THREE.MathUtils.clamp(
          inspecting.pitch + (event.clientY - inspecting.y) * 0.0025,
          0.08,
          compact ? 0.4 : 0.48,
        );
        requestRender();
        return;
      }
      if (event.pointerType === "touch") return;
      const bounds = host.getBoundingClientRect();
      hoverYaw =
        THREE.MathUtils.clamp(
          (event.clientX - bounds.left) / bounds.width - 0.5,
          -0.5,
          0.5,
        ) * 0.018;
      hoverPitch =
        THREE.MathUtils.clamp(
          (event.clientY - bounds.top) / bounds.height - 0.5,
          -0.5,
          0.5,
        ) * 0.013;
      requestRender();
    };
    const pointerUp = (event: Event) => {
      if (event instanceof PointerEvent && !event.isPrimary) return;
      controlGesture = null;
      inspecting = null;
      stage.classList.remove("is-inspecting");
    };
    const pointerLeave = () => {
      hoverYaw = hoverPitch = 0;
      requestRender();
    };
    const resetView = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest("button, [role='slider']"))
        return;
      targetOrbit.yaw = home.yaw;
      targetOrbit.pitch = home.pitch;
      requestRender();
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      reportedReady = false;
      cancelAnimationFrame(frame);
      frame = 0;
      state.current.onReady(false);
      clearPositions();
    };
    const onContextRestored = () => {
      contextLost = false;
      requestRender();
    };
    const clearPositions = () =>
      controls.forEach((element) => {
        for (const key of ["left", "top", "width", "height"])
          element.style.removeProperty(key);
      });
    stage.addEventListener("pointerdown", pointerDown);
    stage.addEventListener("pointermove", pointerMove);
    stage.addEventListener("pointerup", pointerUp);
    stage.addEventListener("pointercancel", pointerUp);
    stage.addEventListener("lostpointercapture", pointerUp);
    stage.addEventListener("pointerleave", pointerLeave);
    stage.addEventListener("dblclick", resetView);
    window.addEventListener("blur", pointerUp);
    document.addEventListener("visibilitychange", requestRender);
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    renderer.domElement.addEventListener(
      "webglcontextrestored",
      onContextRestored,
    );
    const textureLoader = new THREE.TextureLoader();
    const loadTexture = async (path: string, color = false) => {
      const texture = await textureLoader.loadAsync(`/instrument/${path}`);
      if (disposed) {
        texture.dispose();
        throw new Error("Scene disposed");
      }
      ownTexture(texture);
      texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(0.24, 1.2);
      texture.anisotropy = Math.min(
        8,
        renderer.capabilities.getMaxAnisotropy(),
      );
      return texture;
    };
    const loadEnvironment = async () => {
      const hdr = await new RGBELoader().loadAsync("/instrument/studio.hdr");
      if (disposed) {
        hdr.dispose();
        return;
      }
      const next = pmrem.fromEquirectangular(hdr);
      hdr.dispose();
      environment.dispose();
      environment = next;
      scene.environment = next.texture;
    };
    void Promise.allSettled([
      loadEnvironment(),
      state.current.appearance === "steampunk"
        ? Promise.all([
            loadTexture("walnut-color.jpg", true),
            loadTexture("walnut-normal.jpg"),
            loadTexture("walnut-arm.jpg"),
          ]).then(([color, normal, arm]) => {
            if (disposed) return;
            walnut.map = color;
            walnut.normalMap = normal;
            walnut.normalScale.set(0.3, 0.3);
            walnut.roughnessMap = arm;
            walnut.aoMap = arm;
            walnut.aoMapIntensity = 0.6;
            walnut.needsUpdate = true;
          })
        : Promise.resolve(),
      document.fonts.ready,
    ]).then(() => {
      if (disposed) return;
      refreshPrinting.forEach((refresh) => refresh());
      assetsReady = true;
      apparatus.refresh();
      requestRender();
    });
    requestRender();
    return () => {
      disposed = true;
      wake.current = () => {};
      cancelAnimationFrame(frame);
      resize.disconnect();
      stage.removeEventListener("pointerdown", pointerDown);
      stage.removeEventListener("pointermove", pointerMove);
      stage.removeEventListener("pointerup", pointerUp);
      stage.removeEventListener("pointercancel", pointerUp);
      stage.removeEventListener("lostpointercapture", pointerUp);
      stage.removeEventListener("pointerleave", pointerLeave);
      stage.removeEventListener("dblclick", resetView);
      window.removeEventListener("blur", pointerUp);
      document.removeEventListener("visibilitychange", requestRender);
      renderer.domElement.removeEventListener(
        "webglcontextlost",
        onContextLost,
      );
      renderer.domElement.removeEventListener(
        "webglcontextrestored",
        onContextRestored,
      );
      clearPositions();
      stage.classList.remove("is-inspecting");
      const geometries = new Set<THREE.BufferGeometry>();
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.Points ||
          object instanceof THREE.Line
        ) {
          geometries.add(object.geometry);
          if (object instanceof THREE.InstancedMesh) object.dispose();
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      environment.dispose();
      pmrem.dispose();
      key.shadow.dispose();
      ao.dispose();
      bloom.dispose();
      output.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [props.compact, props.appearance]);
  return (
    <div className="instrument-canvas" ref={container} aria-hidden="true" />
  );
}
