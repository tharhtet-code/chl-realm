import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Shared low-level procedural modelling kit used by the detailed landmark builders
 * and the world landscape generator.
 *
 * - Cached materials (one material instance per colour/finish combination)
 * - Cached canvas textures (signs, windows, road surfaces)
 * - Seeded RNG + value noise for deterministic, repeatable worlds
 * - Static mesh merging so every landmark renders in a handful of draw calls on mobile
 */

// ---------------------------------------------------------------------------
// Deterministic randomness & noise
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise2D(x: number, y: number, seed = 1): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function fbm2D(x: number, y: number, seed = 1, octaves = 4): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise2D(x * freq, y * freq, seed + o * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------
// Material + texture caches
// ---------------------------------------------------------------------------

export interface MatOpts {
  metal?: number;
  rough?: number;
  emissive?: string;
  glow?: number;
  opacity?: number;
  side?: THREE.Side;
  map?: THREE.Texture | null;
  emissiveMap?: THREE.Texture | null;
  flat?: boolean;
  vertexColors?: boolean;
  polygonOffset?: number;
}

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

export function stdMat(color: string, o: MatOpts = {}): THREE.MeshStandardMaterial {
  const key = [
    color,
    o.metal ?? 0.08,
    o.rough ?? 0.62,
    o.emissive ?? '',
    o.glow ?? 0,
    o.opacity ?? 1,
    o.side ?? THREE.FrontSide,
    o.map?.uuid ?? '',
    o.emissiveMap?.uuid ?? '',
    o.flat ? 1 : 0,
    o.vertexColors ? 1 : 0,
    o.polygonOffset ?? 0,
  ].join('|');
  let m = materialCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      metalness: o.metal ?? 0.08,
      roughness: o.rough ?? 0.62,
      emissive: o.emissive ?? '#000000',
      emissiveIntensity: o.glow ?? 0,
      transparent: (o.opacity ?? 1) < 1,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
      map: o.map ?? null,
      emissiveMap: o.emissiveMap ?? null,
      flatShading: o.flat ?? false,
      vertexColors: o.vertexColors ?? false,
    });
    if (o.polygonOffset) {
      m.polygonOffset = true;
      m.polygonOffsetFactor = -1;
      m.polygonOffsetUnits = -o.polygonOffset;
    }
    if ((o.opacity ?? 1) < 1) m.depthWrite = false;
    materialCache.set(key, m);
  }
  return m;
}

/** Emissive "light" material (lamp bulbs, LEDs, glowing runes). */
export function glowMat(color: string, glow = 1.2): THREE.MeshStandardMaterial {
  return stdMat(color, { emissive: color, glow, rough: 0.3 });
}

const textureCache = new Map<string, THREE.CanvasTexture>();

export function canvasTexture(
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeat = true
): THREE.CanvasTexture {
  let tex = textureCache.get(key);
  if (tex) return tex;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, w, h);
  tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.anisotropy = 4;
  textureCache.set(key, tex);
  return tex;
}

/** Lit building window grid (tiles per UV unit = 1 window). */
export function windowTexture(frame: string, glass: string, lit: string): THREE.CanvasTexture {
  return canvasTexture(`win|${frame}|${glass}|${lit}`, 64, 64, (ctx, w, h) => {
    ctx.fillStyle = frame;
    ctx.fillRect(0, 0, w, h);
    const rng = mulberry32(hashString(glass + lit));
    for (let gy = 0; gy < 2; gy++) {
      for (let gx = 0; gx < 2; gx++) {
        ctx.fillStyle = rng() > 0.55 ? lit : glass;
        ctx.fillRect(gx * 32 + 5, gy * 32 + 6, 22, 20);
      }
    }
  });
}

/** Sign board texture with crisp Open Sans lettering. */
export function signTexture(text: string, bg: string, fg: string): THREE.CanvasTexture {
  return canvasTexture(
    `sign|${text}|${bg}|${fg}`,
    512,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = fg;
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = fg;
      let size = 64;
      ctx.font = `800 ${size}px "Open Sans", system-ui, sans-serif`;
      while (ctx.measureText(text).width > w - 48 && size > 22) {
        size -= 4;
        ctx.font = `800 ${size}px "Open Sans", system-ui, sans-serif`;
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2, h / 2 + 4);
    },
    false
  );
}

/** Multiply a geometry's UVs so repeating textures tile per world unit. */
export function scaleUV<T extends THREE.BufferGeometry>(geo: T, u: number, v: number): T {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
  }
  uv.needsUpdate = true;
  return geo;
}

/** Position-hashed vertex jitter (keeps seams closed) for organic rocks & peaks. */
export function jitterGeometry<T extends THREE.BufferGeometry>(
  geo: T,
  amount: number,
  seed: number,
  keepAboveY = Infinity
): T {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (y >= keepAboveY) continue;
    const kx = Math.round(x * 1000);
    const ky = Math.round(y * 1000);
    const kz = Math.round(z * 1000);
    const n1 = hash2(kx + kz * 7, ky, seed) - 0.5;
    const n2 = hash2(ky + kx * 3, kz, seed + 9) - 0.5;
    const n3 = hash2(kz + ky * 5, kx, seed + 21) - 0.5;
    pos.setXYZ(i, x + n1 * amount, y + n2 * amount * 0.6, z + n3 * amount);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Kit: terse primitive placement helpers
// ---------------------------------------------------------------------------

type MatLike = string | THREE.Material;
const toMat = (m: MatLike): THREE.Material => (typeof m === 'string' ? stdMat(m) : m);

export class Kit {
  constructor(public g: THREE.Object3D) {}

  mesh(geo: THREE.BufferGeometry, m: MatLike, x = 0, y = 0, z = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(geo, toMat(m));
    mesh.position.set(x, y, z);
    this.g.add(mesh);
    return mesh;
  }

  /** Box whose position is its centre. */
  box(w: number, h: number, d: number, m: MatLike, x = 0, y = 0, z = 0): THREE.Mesh {
    return this.mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z);
  }

  /** Box resting on `y` (bottom face at y). */
  slab(w: number, h: number, d: number, m: MatLike, x = 0, y = 0, z = 0): THREE.Mesh {
    return this.box(w, h, d, m, x, y + h / 2, z);
  }

  cyl(rt: number, rb: number, h: number, seg: number, m: MatLike, x = 0, y = 0, z = 0): THREE.Mesh {
    return this.mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y + h / 2, z);
  }

  cone(r: number, h: number, seg: number, m: MatLike, x = 0, y = 0, z = 0): THREE.Mesh {
    return this.mesh(new THREE.ConeGeometry(r, h, seg), m, x, y + h / 2, z);
  }

  sphere(r: number, m: MatLike, x = 0, y = 0, z = 0, ws = 14, hs = 10): THREE.Mesh {
    return this.mesh(new THREE.SphereGeometry(r, ws, hs), m, x, y, z);
  }

  dome(r: number, m: MatLike, x = 0, y = 0, z = 0, seg = 18): THREE.Mesh {
    return this.mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg / 2), 0, Math.PI * 2, 0, Math.PI / 2), m, x, y, z);
  }

  torus(R: number, r: number, m: MatLike, x = 0, y = 0, z = 0, flat = true, ts = 24): THREE.Mesh {
    const t = this.mesh(new THREE.TorusGeometry(R, r, 8, ts), m, x, y, z);
    if (flat) t.rotation.x = Math.PI / 2;
    return t;
  }

  lathe(profile: Array<[number, number]>, seg: number, m: MatLike, x = 0, y = 0, z = 0): THREE.Mesh {
    const pts = profile.map(([r, h]) => new THREE.Vector2(Math.max(0.0001, r), h));
    return this.mesh(new THREE.LatheGeometry(pts, seg), m, x, y, z);
  }

  /** Thin beam between two 3D points (lattice cranes, ropes, braces). */
  beam(a: THREE.Vector3, b: THREE.Vector3, thickness: number, m: MatLike, round = false): THREE.Mesh {
    const len = a.distanceTo(b);
    const geo = round
      ? new THREE.CylinderGeometry(thickness, thickness, len, 6)
      : new THREE.BoxGeometry(thickness, len, thickness);
    const mesh = this.mesh(geo, m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    const dir = new THREE.Vector3().subVectors(b, a).normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return mesh;
  }

  /** Flat sign board facing +Z. */
  sign(text: string, bg: string, fg: string, w: number, h: number, x: number, y: number, z: number, rotY = 0): THREE.Mesh {
    const key = `signmat|${text}|${bg}|${fg}`;
    let mat = signMatCache.get(key);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ map: signTexture(text, bg, fg), side: THREE.DoubleSide });
      signMatCache.set(key, mat);
    }
    const mesh = this.mesh(new THREE.PlaneGeometry(w, h), mat, x, y, z);
    mesh.rotation.y = rotY;
    return mesh;
  }

  group(name = '', x = 0, y = 0, z = 0): Kit {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    this.g.add(g);
    return new Kit(g);
  }
}

const signMatCache = new Map<string, THREE.MeshBasicMaterial>();

// ---------------------------------------------------------------------------
// Static mesh merging (draw-call reduction for mobile GPUs)
// ---------------------------------------------------------------------------

/**
 * Merges every un-named static mesh under `root` into one mesh per material.
 * Named objects (e.g. `spin_ring`, `float_balloon`, `smoke_puff`, `crane_slew`) are kept
 * as separate animated nodes and merged internally on their own.
 */
export function mergeStaticMeshes(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const toRemove: THREE.Mesh[] = [];
  const namedChildren: THREE.Object3D[] = [];

  const visit = (obj: THREE.Object3D) => {
    for (const child of [...obj.children]) {
      if (child.name) {
        namedChildren.push(child);
        continue;
      }
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && !(mesh as unknown as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(mesh.material)) {
        const rel = new THREE.Matrix4().multiplyMatrices(rootInv, mesh.matrixWorld);
        let geo = mesh.geometry.clone();
        if (geo.index) geo = geo.toNonIndexed();
        for (const name of Object.keys(geo.attributes)) {
          if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
        }
        if (!geo.getAttribute('uv')) {
          geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.getAttribute('position').count * 2), 2));
        }
        geo.applyMatrix4(rel);
        const mat = mesh.material as THREE.Material;
        const list = buckets.get(mat) ?? [];
        list.push(geo);
        buckets.set(mat, list);
        toRemove.push(mesh);
      }
      visit(child);
    }
  };
  visit(root);

  for (const mesh of toRemove) {
    mesh.parent?.remove(mesh);
    mesh.geometry.dispose();
  }
  // Remove now-empty helper groups (un-named, no children)
  const prune = (obj: THREE.Object3D) => {
    for (const child of [...obj.children]) {
      if (child.name) continue;
      prune(child);
      if (!(child as THREE.Mesh).isMesh && !(child as THREE.Sprite).isSprite && child.children.length === 0 && child.type === 'Group') {
        obj.remove(child);
      }
    }
  };
  prune(root);

  for (const [mat, geos] of buckets) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, mat);
    root.add(mesh);
    for (const g of geos) if (g !== merged) g.dispose();
  }

  for (const named of namedChildren) mergeStaticMeshes(named);
}

/** Converts a modelled template into per-material geometry parts (for InstancedMesh). */
export function templateParts(build: (k: Kit) => void): Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }> {
  const root = new THREE.Group();
  build(new Kit(root));
  mergeStaticMeshes(root);
  const parts: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }> = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) parts.push({ geometry: m.geometry, material: m.material as THREE.Material });
  });
  return parts;
}

export function disposeGroupGeometries(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine) {
      m.geometry?.dispose();
    }
  });
}
