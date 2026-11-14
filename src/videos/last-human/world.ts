// Last Human world: sky, fog, lights, basic ground plane.
// Shot-specific geometry lives in build.ts (buildTown equivalent).
// Characters & props live in cast.ts.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { Batch, Kit, kitClone, buildTown, V, lam, boxGeo } from "./build";
import { beam, bed, rep, ctex, planksHD, beamHD, stoneHD, cobbleHD, grassHD, chainHD, waterNear, waterFar, cloudHD } from "./paint";
import { Pen, fxSign } from "./toon";
import { LIGHTS, LOOK, LightPreset, WorldLook } from "./lights";
import { TONE, CHAR, LFB, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, SHOTS, camAt, V3, smooth, FOREGROUND, ShotDef } from "./story";

// ---------------- assets ----------------
// Procedural placeholder geometries for Kenney-style assets (no external GLB files needed)
const KENNEY = [
  "tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree_cone", "tree-high-round", "tree",
  "plant_bushLarge", "plant_bushDetailed", "plant_bush", "hedge",
  "flower_redA", "flower_yellowA", "flower_purpleA", "grass_large", "grass", "lily_large",
  "lantern", "cart", "stall-red", "stall-green", "stall-bench", "banner-red", "banner-green",
  "windmill", "canoe", "car", "truck", "bus", "street_light", "bench", "bin", "post_box"
];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    kitP = Promise.resolve().then(() => {
      const kit: Kit = {};
      // Create simple placeholder geometries for each asset type
      const geoCache = new Map<string, THREE.BufferGeometry>();
      const makeGeo = (name: string) => {
        if (geoCache.has(name)) return geoCache.get(name)!;
        let geo: THREE.BufferGeometry;
        if (name.startsWith("tree")) {
          // Tree: trunk + foliage cone
          const trunk = new THREE.CylinderGeometry(0.15, 0.3, 2, 8);
          trunk.translate(0, 1, 0);
          const foliage = new THREE.ConeGeometry(1.5, 4, 8);
          foliage.translate(0, 3, 0);
          const merged = new THREE.BufferGeometry();
          merged.copy(trunk);
          const posAttr = merged.getAttribute("position");
          const foliagePos = foliage.getAttribute("position");
          const newPos = new Float32Array(posAttr.count * 3 + foliagePos.count * 3);
          newPos.set(posAttr.array, 0);
          newPos.set(foliagePos.array, posAttr.count * 3);
          merged.setAttribute("position", new THREE.BufferAttribute(newPos, 3));
          // Merge normals/uvs similarly...
          geo = merged;
        } else if (name.startsWith("plant_bush") || name === "hedge") {
          geo = new THREE.SphereGeometry(1, 8, 6);
          geo.translate(0, 0.5, 0);
        } else if (name.startsWith("flower") || name.startsWith("grass") || name === "lily_large") {
          geo = new THREE.ConeGeometry(0.15, 0.5, 6);
          geo.translate(0, 0.25, 0);
        } else if (name === "lantern" || name === "street_light") {
          geo = new THREE.CylinderGeometry(0.08, 0.08, 3, 8);
          geo.translate(0, 1.5, 0);
        } else if (name === "cart") {
          geo = new THREE.BoxGeometry(1.5, 0.8, 2.5);
          geo.translate(0, 0.4, 0);
        } else if (name.startsWith("stall")) {
          geo = new THREE.BoxGeometry(3, 2.5, 2);
          geo.translate(0, 1.25, 0);
        } else if (name === "stall-bench") {
          geo = new THREE.BoxGeometry(2, 0.4, 0.5);
          geo.translate(0, 0.4, 0);
        } else if (name.startsWith("banner")) {
          geo = new THREE.PlaneGeometry(1.5, 2);
          geo.translate(0, 1.5, 0);
        } else if (name === "windmill") {
          geo = new THREE.CylinderGeometry(0.5, 1.5, 6, 8);
          geo.translate(0, 3, 0);
        } else if (name === "canoe") {
          geo = new THREE.BoxGeometry(0.8, 0.4, 4);
          geo.translate(0, 0.2, 0);
        } else if (name === "car") {
          geo = new THREE.BoxGeometry(1.8, 1.2, 4);
          geo.translate(0, 0.6, 0);
        } else if (name === "truck" || name === "bus") {
          geo = new THREE.BoxGeometry(2.5, 2.5, 8);
          geo.translate(0, 1.25, 0);
        } else if (name === "bench") {
          geo = new THREE.BoxGeometry(1.5, 0.4, 0.5);
          geo.translate(0, 0.4, 0);
        } else if (name === "bin" || name === "post_box") {
          geo = new THREE.CylinderGeometry(0.3, 0.3, 1, 8);
          geo.translate(0, 0.5, 0);
        } else {
          geo = new THREE.BoxGeometry(1, 1, 1);
        }
        geoCache.set(name, geo);
        return geo;
      };
      for (const n of KENNEY) {
        const geo = makeGeo(n);
        const obj = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8 }));
        (obj as any).userData = { assetName: n };
        kit[n] = obj;
      }
      return kit;
    });
  }
  return kitP;
};

// sun disc / halo textures
const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = 255;
    im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});

// sight lines for culling
const sightLines = (): { o: THREE.Vector3; d: THREE.Vector3; len: number; core: boolean }[] => {
  const out: { o: THREE.Vector3; d: THREE.Vector3; len: number; core: boolean }[] = [];
  for (const s of SHOTS) for (let f = s.a - 8; f < s.b + 8; f += 2) {
    const c = camAt(s.id, Math.max(0, f));
    const o = V(...c.pos), look = V(...c.look);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
    const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
    for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
      out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
  }
  return out;
};

type Mats = Record<string, THREE.Material>;

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi!: THREE.HemisphereLight;
  private sun!: THREE.DirectionalLight;
  private fill!: THREE.DirectionalLight;
  private sky!: THREE.Mesh;
  private skyMat!: THREE.ShaderMaterial;
  private fog!: THREE.Fog;
  private WU!: Record<string, THREE.IUniform>;
  private sunDisc!: THREE.Sprite;
  private sunHalo!: THREE.Sprite;
  private mats: Mats = {};
  private ground!: THREE.Mesh;
  private buildings!: THREE.Group;
  private kit: Kit;

  constructor(kit: Kit) {
    this.kit = kit;
    this.buildScene();
  }

  private buildScene() {
    // Sky shader
    const vs = `varying vec3 vDir; void main(){ vDir = normalize((modelViewMatrix * vec4(position,1.0)).xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
    const fs = `
      uniform vec3 top; uniform vec3 horizon; uniform float sunY; uniform vec3 sunCol;
      varying vec3 vDir;
      void main(){
        float h = smoothstep(-0.1, 0.3, vDir.y);
        vec3 c = mix(horizon, top, h);
        float sun = pow(max(0.0, vDir.y - sunY), 32.0);
        c += sunCol * sun * 0.8;
        gl_FragColor = vec4(c, 1.0);
      }
    `;
    this.skyMat = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, side: THREE.BackSide, depthWrite: false, uniforms: { top: { value: new THREE.Color("#3e7fd2") }, horizon: { value: new THREE.Color("#b8d0ec") }, sunY: { value: 0.7 }, sunCol: { value: new THREE.Color("#fff8e0") } } });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), this.skyMat);
    this.root.add(this.sky);
    this.WU = this.skyMat.uniforms as any;

    // Fog
    this.fog = new THREE.Fog("#b8d0ec", 25, 420);

    // Lights
    const day = LIGHTS.day;
    this.hemi = new THREE.HemisphereLight(new THREE.Color(day.lit[0], day.lit[1], day.lit[2]), new THREE.Color(day.shade[0], day.shade[1], day.shade[2]), 0.6);
    this.root.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, day.keyI ?? 1.0);
    this.sun.position.set(100, 200, 50);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 500;
    this.sun.shadow.camera.left = -200;
    this.sun.shadow.camera.right = 200;
    this.sun.shadow.camera.top = 200;
    this.sun.shadow.camera.bottom = -200;
    this.root.add(this.sun);

    this.fill = new THREE.DirectionalLight(0xffffff, 0.3);
    this.fill.position.set(-50, 100, -50);
    this.root.add(this.fill);

    // Sun disc + halo sprites (procedural)
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), transparent: true, depthWrite: false }));
    this.sunDisc.scale.set(80, 80, 1);
    this.root.add(this.sunDisc);
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.sunHalo.scale.set(300, 300, 1);
    this.root.add(this.sunHalo);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(800, 800, 40, 40);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a4a3a, roughness: 0.9, metalness: 0.05 });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.root.add(this.ground);

    // Buildings group (populated per shot in update)
    this.buildings = new THREE.Group();
    this.root.add(this.buildings);

    // Kenney kit assets will be instantiated by buildTown equivalent in build.ts
    // We'll call a simplified build here
    this.buildEnvironment();
  }

  private buildEnvironment() {
    // Basic street layout - simple blocks for buildings
    const blockMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8, metalness: 0.1 });
    for (let i = -10; i <= 10; i++) {
      for (let j = -10; j <= 10; j++) {
        if (Math.abs(i) < 3 && Math.abs(j) < 3) continue; // keep center clear
        if (Math.random() > 0.3) continue;
        const h = 8 + Math.random() * 12;
        const w = 6 + Math.random() * 8;
        const d = 6 + Math.random() * 8;
        const geo = new THREE.BoxGeometry(w, h, d);
        const b = new THREE.Mesh(geo, blockMat);
        b.position.set(i * 18, h / 2, j * 18);
        b.castShadow = true;
        b.receiveShadow = true;
        this.buildings.add(b);
      }
    }
  }

  // Main update per frame
  update(id: number, f: number, camera: THREE.PerspectiveCamera, scene: THREE.Scene): THREE.Vector3 {
    const shot = SHOTS[id - 1];
    const cam = camAt(id, f);
    const lightPreset = LIGHTS[shot.light] ?? LIGHTS.day;
    const look = LOOK[shot.light] ?? LOOK.day;

    // Camera
    camera.position.set(...cam.pos);
    camera.lookAt(...cam.look);
    camera.fov = cam.fov;
    camera.rotation.z = cam.roll;
    camera.updateProjectionMatrix();

    // Sun position from light preset
    const az = lightPreset.az * Math.PI / 180;
    const el = lightPreset.el * Math.PI / 180;
    const sunDir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    this.sun.position.copy(sunDir.clone().multiplyScalar(300));
    this.sun.target.position.set(0, 0, 0);
    this.sun.intensity = lightPreset.keyI ?? 1.0;
    this.sun.color.set(lightPreset.keyCol ?? 0xffffff);

    // Hemisphere light
    this.hemi.color.set(lightPreset.lit[0], lightPreset.lit[1], lightPreset.lit[2]);
    this.hemi.groundColor.set(lightPreset.shade[0], lightPreset.shade[1], lightPreset.shade[2]);
    this.hemi.intensity = lightPreset.hemiI ?? 0.6;

    // Fill light
    this.fill.intensity = lightPreset.fillI ?? 0.3;

    // Sky uniforms
    this.WU.top.value.set(look.skyTop);
    this.WU.horizon.value.set(look.skyHorizon);
    this.WU.sunY.value = Math.sin(el);
    this.WU.sunCol.value.set(lightPreset.keyCol ?? 0xfff8e0);

    // Fog
    this.fog.color.set(look.fog);
    this.fog.near = look.fogNear;
    this.fog.far = look.fogFar;

    // Sun sprites
    this.sunDisc.position.copy(sunDir.clone().multiplyScalar(500));
    this.sunHalo.position.copy(sunDir.clone().multiplyScalar(500));

    // Cull buildings outside sight lines (simplified)
    this.buildings.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        // Frustum culling would go here
        obj.visible = true;
      }
    });

    // Return look target for DOF
    return new THREE.Vector3(...cam.look);
  }
}