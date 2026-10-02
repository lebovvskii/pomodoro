import * as THREE from "three";
import type { Appearance } from "./apparatus-styles";

type Resources = { material: <T extends THREE.Material>(material: T) => T };
const vertex = `varying vec2 vUv; varying vec3 vNormal; varying vec3 vView;
void main(){vUv=uv; vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`;
const noise = `float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
float fbm(vec2 p){float s=0.;float a=.5;for(int i=0;i<4;i++){s+=a*noise(p);p=p*2.03+vec2(7.1,2.3);a*=.5;}return s;}`;

/** Effects live in the scene and light the object; alpha stays empty away from them. */
export function createEffects(
  style: Appearance,
  compact: boolean,
  resources: Resources,
) {
  const group = new THREE.Group();
  const shaders: THREE.ShaderMaterial[] = [];
  const animated: Array<(time: number, energy: number) => void> = [];
  const shader = (color: number, fragment: string) => {
    const material = resources.material(
      new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          energy: { value: 0.25 },
          charge: { value: 0 },
          tint: { value: new THREE.Color(color) },
        },
        vertexShader: vertex,
        fragmentShader: `uniform float time;uniform float energy;uniform float charge;uniform vec3 tint;varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;${noise}${fragment}`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    shaders.push(material);
    return material;
  };
  const orb = (x: number, y: number, radius: number, color: number) => {
    const material = shader(
      color,
      `void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),2.8);
      float plasma=fbm(vUv*vec2(8.,4.)+vec2(time*.12,-time*.18));
      float bands=pow(.5+.5*sin(vUv.y*45.+plasma*8.-time*1.8),12.);
      float a=clamp(rim*.48+bands*.12+plasma*.03,0.,.65);gl_FragColor=vec4(tint*(1.2+rim*2.+bands*3.)*(.7+energy*.3),a);}`,
    );
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 64, 40),
      material,
    );
    mesh.position.set(x, y, 0.66);
    group.add(mesh);
    return mesh;
  };
  const plume = (x: number, y: number, color: number, dark = false) => {
    const material = shader(
      color,
      `void main(){vec2 p=vUv;float n=fbm(p*vec2(4.,7.)+vec2(sin(time*.2),-time*.35));
      float width=mix(.08,.42,p.y);float center=.5+.12*sin(p.y*8.+time*.45);
      float a=exp(-pow((p.x-center)/width,2.)*2.)*smoothstep(.0,.15,p.y)*(1.-smoothstep(.55,1.,p.y))*n*.22;
      gl_FragColor=vec4(tint*${dark ? ".35" : "1.0"},a*(.6+energy*.7));}`,
    );
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), material);
    mesh.position.set(x, y + 0.72, 0.1);
    group.add(mesh);
  };
  if (style === "cyberpunk") {
    const x = -0.36,
      y = 1.42;
    const hologram = shader(
      0x43edff,
      `void main(){float scan=.6+.4*sin(vUv.y*420.-time*3.);float edge=pow(abs(vUv.x-.5)*2.,8.);
      float sweep=exp(-pow(fract(vUv.y-time*.14)-.5,2.)*600.);float a=.025+edge*.1+sweep*.055;
      gl_FragColor=vec4(tint*(1.+sweep*3.)*scan,a);}`,
    );
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(compact ? 3.45 : 4.3, 1.08),
      hologram,
    );
    screen.position.set(x, y, 0.197);
    group.add(screen);
  }
  if (style === "steampunk") {
    plume(-2.63, 1.85, 0xe4d5bc);
  }
  if (style === "dieselpunk") plume(-2.91, 2.75, 0x73786c, true);
  if (style === "arcane") {
    orb(0, 0.57, 1.4, 0xa780ff);
    const seal = shader(
      0xd5b2ff,
      `void main(){vec2 p=vUv-.5;float r=length(p);float angle=fract(atan(p.x,p.y)/6.2831853+1.);float ring=1.-smoothstep(.004,.010,abs(r-.44));float lit=step(angle,charge)*step(.001,charge);gl_FragColor=vec4(tint*(1.+lit*3.),ring*(.10+lit*.7));}`,
    );
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(3.95, 3.95), seal);
    halo.position.set(0, 0.57, 1.74);
    group.add(halo);
  }
  const count = compact ? 36 : style === "arcane" ? 130 : 70;
  const positions = new Float32Array(count * 3),
    seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    seeds[i] = (i * 0.61803398875) % 1;
    positions[i * 3] = (seeds[i] - 0.5) * 8;
    positions[i * 3 + 1] = ((i % 13) / 13) * 4 - 2;
    positions[i * 3 + 2] = 0.4;
  }
  const particlesGeometry = new THREE.BufferGeometry();
  particlesGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
  );
  const particleMaterial = resources.material(
    new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        tint: {
          value: new THREE.Color(
            style === "arcane"
              ? 0xd4b2ff
              : style === "cyberpunk"
                ? 0x55efff
                : 0xd8a568,
          ),
        },
        pointScale: { value: compact ? 1.8 : 2.6 },
      },
      vertexShader: `uniform float pointScale;void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(pointScale*15./max(2.,-p.z),1.,5.);gl_Position=projectionMatrix*p;}`,
      fragmentShader: `uniform vec3 tint;void main(){float r=length(gl_PointCoord-.5);float a=exp(-r*r*22.)*.42;gl_FragColor=vec4(tint*2.,a);}`,
      transparent: true,
      depthWrite: false,
    }),
  );
  const particles = new THREE.Points(particlesGeometry, particleMaterial);
  particles.frustumCulled = false;
  if (style !== "soviet") group.add(particles);
  else particlesGeometry.dispose();
  animated.push((time) => {
    for (let i = 0; i < count; i++) {
      const t =
        seeds[i] * Math.PI * 2 + time * (style === "arcane" ? 0.17 : 0.04);
      const radius = 1.4 + seeds[(i + 11) % count] * 1.6;
      positions[i * 3] = Math.sin(t) * radius * (compact ? 0.67 : 1.35);
      positions[i * 3 + 1] =
        style === "arcane"
          ? Math.cos(t) * radius * 0.65 + (compact ? 1 : 0.2)
          : ((seeds[i] * 4 + time * 0.13) % 4) - 2;
      positions[i * 3 + 2] = Math.cos(t) * 0.3 + 0.6;
    }
    particlesGeometry.attributes.position.needsUpdate = true;
  });
  return {
    group,
    update(time: number, energy: number, charge: number) {
      for (const material of shaders) {
        material.uniforms.time.value = time;
        material.uniforms.energy.value = energy;
        material.uniforms.charge.value = charge;
      }
      if (style !== "soviet")
        animated.forEach((update) => update(time, energy));
    },
  };
}
