import * as THREE from 'three';
import type { WorldProp, WorldTheme } from '../types/game';
import { Kit, glowMat, hashString, jitterGeometry, mulberry32, scaleUV, stdMat, windowTexture } from './meshKit';

/**
 * Detailed Myanmar city landmarks + City Holdings business facilities.
 *
 * Every builder models in local space centred on the prop footprint:
 *   +X = east, -Z = north (toward the map's top edge), +Z = south (facing the default camera).
 * W/D are the footprint in world units, S is a uniform detail scale.
 */

type Builder = (k: Kit, W: number, D: number, S: number, prop: WorldProp, theme: WorldTheme) => void;

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// Shared Myanmar architectural elements
// ---------------------------------------------------------------------------

/** Classic Myanmar bell-stupa silhouette (base mouldings → bell → bands → lotus → banana bud). */
function stupaProfile(r: number, h: number): Array<[number, number]> {
  return [
    [0, 0],
    [r, 0],
    [r, 0.06 * h],
    [r * 0.94, 0.09 * h],
    [r * 0.97, 0.12 * h],
    [r * 0.88, 0.16 * h],
    [r * 0.9, 0.19 * h],
    [r * 0.82, 0.22 * h],
    [r * 0.84, 0.25 * h],
    [r * 0.8, 0.3 * h],
    [r * 0.78, 0.38 * h],
    [r * 0.7, 0.46 * h],
    [r * 0.56, 0.54 * h],
    [r * 0.42, 0.6 * h],
    [r * 0.36, 0.62 * h],
    [r * 0.4, 0.645 * h],
    [r * 0.33, 0.67 * h],
    [r * 0.31, 0.69 * h],
    [r * 0.33, 0.71 * h],
    [r * 0.26, 0.73 * h],
    [r * 0.28, 0.75 * h],
    [r * 0.21, 0.77 * h],
    [r * 0.25, 0.8 * h],
    [r * 0.15, 0.835 * h],
    [r * 0.165, 0.86 * h],
    [r * 0.13, 0.91 * h],
    [r * 0.07, 0.96 * h],
    [0, h],
  ];
}

/** Curvilinear Bagan temple spire (sikhara). */
function sikharaProfile(r: number, h: number): Array<[number, number]> {
  return [
    [0, 0],
    [r, 0],
    [r * 0.97, 0.12 * h],
    [r * 0.9, 0.3 * h],
    [r * 0.76, 0.5 * h],
    [r * 0.56, 0.68 * h],
    [r * 0.36, 0.82 * h],
    [r * 0.2, 0.92 * h],
    [r * 0.08, 0.98 * h],
    [0, h],
  ];
}

/** Hti umbrella finial with tiered rings, vane and diamond orb (spins slowly). */
function hti(k: Kit, x: number, y: number, z: number, s: number): void {
  const h = k.group('spin_ring', x, y, z);
  const gold = stdMat('#facc15', { metal: 0.85, rough: 0.2 });
  for (let i = 0; i < 6; i++) {
    h.torus(0.2 * s * (1 - i * 0.13), 0.035 * s, gold, 0, i * 0.11 * s, 0, true, 16);
  }
  h.cyl(0.02 * s, 0.03 * s, 0.9 * s, 6, gold, 0, 0, 0);
  h.box(0.02 * s, 0.14 * s, 0.24 * s, gold, 0, 0.78 * s, 0.12 * s);
  h.mesh(new THREE.OctahedronGeometry(0.075 * s, 0), glowMat('#ffffff', 1.4), 0, 0.98 * s, 0);
}

/** Multi-tiered Myanmar pyatthat roof (flared teak/gold tiers with corner finials). */
function pyatthat(k: Kit, x: number, y: number, z: number, base: number, tiers: number, roof: string, trim: string): number {
  const roofMat = stdMat(roof, { rough: 0.5, metal: 0.15 });
  const trimMat = stdMat(trim, { metal: 0.75, rough: 0.25 });
  let cy = y;
  for (let i = 0; i < tiers; i++) {
    const s = base * (1 - i / (tiers + 1.4));
    const rh = s * 0.32;
    const roofMesh = k.mesh(new THREE.ConeGeometry(s * 0.78, rh, 4, 1, true), roofMat, x, cy + rh / 2, z);
    roofMesh.rotation.y = Math.PI / 4;
    (roofMesh.material as THREE.Material).side = THREE.DoubleSide;
    const eave = k.box(s * 1.12, 0.04 * base, s * 1.12, trimMat, x, cy + 0.02 * base, z);
    eave.rotation.y = 0;
    for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      k.cone(0.045 * base, 0.18 * base, 5, trimMat, x + cx * s * 0.55, cy, z + cz * s * 0.55);
    }
    k.box(s * 0.42, rh * 0.75, s * 0.42, stdMat('#7c2d12'), x, cy + rh + rh * 0.37, z);
    cy += rh * 1.65;
  }
  k.cone(0.06 * base, 0.55 * base, 8, trimMat, x, cy, z);
  return cy + 0.55 * base;
}

function archDoor(k: Kit, w: number, h: number, x: number, y: number, z: number, rotY = 0, color = '#1c1410'): void {
  const g = k.group('', x, y, z);
  g.g.rotation.y = rotY;
  g.box(w, h, 0.06, color, 0, h / 2, 0);
  const top = g.mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.06, 12, 1, false, 0, Math.PI), color, 0, h, 0);
  top.rotation.x = Math.PI / 2;
  top.rotation.z = Math.PI / 2;
  top.rotation.y = Math.PI / 2;
  g.box(w * 1.3, 0.08, 0.1, stdMat('#facc15', { metal: 0.7, rough: 0.3 }), 0, h + w / 2 + 0.06, 0.02);
}

function chinthe(k: Kit, x: number, z: number, s: number, rotY: number): void {
  const g = k.group('', x, 0.4, z);
  g.g.rotation.y = rotY;
  const white = stdMat('#f8fafc', { rough: 0.4 });
  const gold = stdMat('#facc15', { metal: 0.7, rough: 0.3 });
  g.slab(0.5 * s, 0.25 * s, 0.7 * s, '#cbd5e1', 0, 0, 0);
  g.box(0.32 * s, 0.42 * s, 0.5 * s, white, 0, 0.45 * s, -0.05 * s);
  g.sphere(0.2 * s, white, 0, 0.78 * s, 0.12 * s, 10, 8);
  g.torus(0.18 * s, 0.05 * s, gold, 0, 0.7 * s, 0.1 * s, false, 12);
  g.box(0.1 * s, 0.06 * s, 0.05 * s, '#dc2626', 0, 0.73 * s, 0.3 * s);
}

function palmTree(k: Kit, x: number, y: number, z: number, s: number, seed: number): void {
  const rng = mulberry32(seed);
  const trunk = stdMat('#8b6b43', { rough: 0.8 });
  const leaf = stdMat('#3f8f3a', { side: THREE.DoubleSide, rough: 0.6 });
  let px = x;
  let pz = z;
  const lean = rng() * Math.PI * 2;
  let py = y;
  for (let i = 0; i < 4; i++) {
    const nx = px + Math.cos(lean) * 0.12 * s;
    const nz = pz + Math.sin(lean) * 0.12 * s;
    k.beam(V(px, py, pz), V(nx, py + 0.75 * s, nz), 0.09 * s * (1 - i * 0.12), trunk, true);
    px = nx;
    pz = nz;
    py += 0.75 * s;
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rng();
    const fr = k.mesh(new THREE.PlaneGeometry(0.28 * s, 1.3 * s, 1, 3), leaf, px + Math.cos(a) * 0.5 * s, py - 0.15 * s, pz + Math.sin(a) * 0.5 * s);
    fr.rotation.order = 'YXZ';
    fr.rotation.y = -a + Math.PI / 2;
    fr.rotation.x = 1.15;
  }
  for (let i = 0; i < 3; i++) {
    k.sphere(0.08 * s, '#5b3a1e', px + Math.cos(i * 2.1) * 0.12 * s, py - 0.12 * s, pz + Math.sin(i * 2.1) * 0.12 * s, 6, 5);
  }
}

function pineTree(k: Kit, x: number, y: number, z: number, s: number, snowy: boolean): void {
  k.cyl(0.08 * s, 0.11 * s, 0.6 * s, 6, '#5b3a1e', x, y, z);
  const green = stdMat('#1f5f3a', { flat: true });
  for (let i = 0; i < 3; i++) {
    const r = (0.62 - i * 0.16) * s;
    const yy = y + 0.45 * s + i * 0.48 * s;
    k.cone(r, 0.85 * s, 8, green, x, yy, z);
    if (snowy) k.cone(r * 0.55, 0.36 * s, 8, '#f8fafc', x, yy + 0.52 * s, z);
  }
}

// ---------------------------------------------------------------------------
// The Hub — Ancient Bagan
// ---------------------------------------------------------------------------

const baganStupa: Builder = (k, W, D, S) => {
  const base = Math.min(W, D);
  const brick = stdMat('#b4532a', { rough: 0.85 });
  const plaster = stdMat('#efe2c4', { rough: 0.7 });
  const gold = stdMat('#f5c542', { metal: 0.8, rough: 0.22 });
  let y = 0.45;
  for (let t = 0; t < 3; t++) {
    const size = base * (0.96 - t * 0.2);
    const h = 0.42 * S;
    k.slab(size, h, size, brick, 0, y, 0);
    k.slab(size + 0.08, 0.07, size + 0.08, plaster, 0, y + h - 0.035, 0);
    // stairways on all four sides
    if (t < 2) {
      for (let side = 0; side < 4; side++) {
        const a = (side * Math.PI) / 2;
        for (let st = 0; st < 4; st++) {
          const out = size / 2 + 0.1 + st * 0.12;
          const sh = h * (1 - st / 4);
          const m = k.slab(0.55 * S, sh, 0.14, brick, Math.sin(a) * out, y, Math.cos(a) * out);
          m.rotation.y = a;
        }
      }
      // corner mini-stupas
      for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        k.lathe(stupaProfile(0.17 * S, 0.75 * S), 12, gold, (cx * size) / 2 - cx * 0.18, y + h, (cz * size) / 2 - cz * 0.18);
      }
    }
    y += h;
  }
  // octagonal drum + great golden bell
  k.cyl(base * 0.3, base * 0.32, 0.3 * S, 8, plaster, 0, y, 0);
  y += 0.3 * S;
  const bellH = 3.4 * S;
  k.lathe(stupaProfile(base * 0.3, bellH), 28, gold, 0, y, 0);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const petal = k.cone(0.07 * S, 0.22 * S, 4, gold, Math.cos(a) * base * 0.27, y + bellH * 0.24, Math.sin(a) * base * 0.27);
    petal.rotation.z = 0.4 * Math.cos(a);
  }
  hti(k, 0, y + bellH - 0.05, 0, S);
};

const baganTemple: Builder = (k, W, D, S, prop) => {
  const base = Math.min(W, D);
  const isAnanda = (prop.label ?? '').includes('Ananda');
  const body = stdMat(isAnanda ? '#f6efe0' : '#e8d9bb', { rough: 0.75 });
  const trim = stdMat('#c2410c', { rough: 0.7 });
  const gold = stdMat('#f5c542', { metal: 0.8, rough: 0.22 });
  const cube = base * 0.62;
  const y0 = 0.45;
  // lower sanctum
  k.slab(cube, 1.5 * S, cube, body, 0, y0, 0);
  k.slab(cube + 0.12, 0.12, cube + 0.12, trim, 0, y0 + 1.5 * S, 0);
  // four projecting porches with pediments and arched doorways
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2;
    const out = cube / 2 + 0.25 * S;
    const g = k.group('', Math.sin(a) * out, y0, Math.cos(a) * out);
    g.g.rotation.y = a;
    g.slab(0.95 * S, 1.25 * S, 0.5 * S, body, 0, 0, 0);
    const ped = g.mesh(new THREE.ConeGeometry(0.62 * S, 0.7 * S, 4), body, 0, 1.25 * S + 0.35 * S, 0);
    ped.rotation.y = Math.PI / 4;
    ped.scale.z = 0.45;
    archDoor(g, 0.42 * S, 0.62 * S, 0, 0.02, 0.26 * S);
    g.cone(0.05 * S, 0.3 * S, 6, gold, 0, 1.25 * S + 0.66 * S, 0);
  }
  // receding terraces with corner stupas
  let y = y0 + 1.62 * S;
  for (let t = 0; t < 3; t++) {
    const s = cube * (0.9 - t * 0.16);
    k.slab(s, 0.28 * S, s, body, 0, y, 0);
    k.slab(s + 0.06, 0.05, s + 0.06, trim, 0, y + 0.28 * S, 0);
    for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      k.lathe(stupaProfile(0.1 * S, 0.45 * S), 10, gold, (cx * s) / 2 - cx * 0.1, y + 0.28 * S, (cz * s) / 2 - cz * 0.1);
    }
    y += 0.33 * S;
  }
  // upper shrine with windows
  const up = cube * 0.42;
  k.slab(up, 0.9 * S, up, body, 0, y, 0);
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2;
    archDoor(k, 0.22 * S, 0.35 * S, Math.sin(a) * (up / 2 + 0.01), y + 0.15 * S, Math.cos(a) * (up / 2 + 0.01), a);
  }
  y += 0.9 * S;
  // ribbed golden sikhara
  const spire = k.lathe(sikharaProfile(up * 0.52, 2.6 * S), 12, stdMat('#f5c542', { metal: 0.8, rough: 0.25, flat: true }), 0, y, 0);
  spire.rotation.y = Math.PI / 12;
  hti(k, 0, y + 2.55 * S, 0, S * 0.85);
};

const baganBalloon: Builder = (k, W, D, S, prop) => {
  // launch field marker on the ground
  k.mesh(new THREE.RingGeometry(1.0 * S, 1.25 * S, 28).rotateX(-Math.PI / 2), stdMat('#fde68a', { side: THREE.DoubleSide }), 0, 0.03, 0);
  const b = k.group('float_balloon', 0, 5.4 * S, 0);
  const seed = hashString(prop.label ?? 'balloon');
  const palettes = [
    ['#dc2626', '#facc15', '#f97316'],
    ['#7c3aed', '#facc15', '#ec4899'],
    ['#0ea5e9', '#facc15', '#22c55e'],
  ];
  const pal = palettes[seed % palettes.length];
  const profile: Array<[number, number]> = [
    [0.18, -1.55],
    [0.42, -1.25],
    [0.85, -0.7],
    [1.2, 0],
    [1.32, 0.55],
    [1.22, 1.05],
    [0.9, 1.45],
    [0.45, 1.68],
    [0, 1.74],
  ].map(([r, h]) => [r * S, h * S] as [number, number]);
  const gores = 12;
  for (let i = 0; i < gores; i++) {
    const pts = profile.map(([r, h]) => new THREE.Vector2(Math.max(0.001, r), h));
    const geo = new THREE.LatheGeometry(pts, 3, (i / gores) * Math.PI * 2, (Math.PI * 2) / gores);
    b.mesh(geo, stdMat(pal[i % 3], { rough: 0.45, emissive: pal[i % 3], glow: 0.12, side: THREE.DoubleSide }));
  }
  b.torus(1.2 * S, 0.05 * S, '#fef3c7', 0, 0, 0, true, 28);
  b.torus(0.86 * S, 0.04 * S, '#fef3c7', 0, -0.7 * S, 0, true, 24);
  // ropes, wicker basket and burner flame
  for (const [rx, rz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    b.beam(V(rx * 0.2 * S, -1.55 * S, rz * 0.2 * S), V(rx * 0.26 * S, -2.3 * S, rz * 0.26 * S), 0.012 * S, '#78350f', true);
  }
  b.slab(0.6 * S, 0.42 * S, 0.6 * S, stdMat('#92400e', { rough: 0.9 }), 0, -2.72 * S, 0);
  b.slab(0.66 * S, 0.06 * S, 0.66 * S, '#5b3a1e', 0, -2.34 * S, 0);
  b.cone(0.12 * S, 0.34 * S, 8, glowMat('#fb923c', 1.6), 0, -2.2 * S, 0);
};

// ---------------------------------------------------------------------------
// Retail Realm — Yangon
// ---------------------------------------------------------------------------

const shwedagon: Builder = (k, W, D, S) => {
  const base = Math.min(W, D);
  const marble = stdMat('#f1ece1', { rough: 0.5 });
  const gold = stdMat('#facc15', { metal: 0.9, rough: 0.18 });
  const red = stdMat('#b91c1c', { rough: 0.5 });
  // raised marble platform with gold trim and four stairways
  k.slab(base * 0.98, 0.5 * S, base * 0.98, marble, 0, 0.42, 0);
  k.slab(base, 0.07, base, gold, 0, 0.42 + 0.5 * S, 0);
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2;
    const st = k.group('', Math.sin(a) * (base / 2 + 0.3), 0.42, Math.cos(a) * (base / 2 + 0.3));
    st.g.rotation.y = a;
    for (let s = 0; s < 4; s++) st.slab(0.9 * S, 0.5 * S * (1 - s / 4), 0.16, marble, 0, 0, s * 0.15);
    // tazaung entrance pavilion
    st.slab(0.12, 0.9 * S, 0.12, red, -0.5 * S, 0.5 * S, -0.1);
    st.slab(0.12, 0.9 * S, 0.12, red, 0.5 * S, 0.5 * S, -0.1);
    pyatthat(st, 0, 1.4 * S, -0.1, 1.15 * S, 3, '#b91c1c', '#facc15');
  }
  chinthe(k, -0.75 * S, base / 2 + 1.0, S, 0);
  chinthe(k, 0.75 * S, base / 2 + 1.0, S, 0);
  const y = 0.42 + 0.57 * S;
  // eight planetary-post shrines around the stupa
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const r = base * 0.4;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    k.slab(0.36 * S, 0.45 * S, 0.36 * S, marble, x, y, z);
    k.lathe(stupaProfile(0.15 * S, 0.7 * S), 10, gold, x, y + 0.45 * S, z);
  }
  // octagonal terraces + great golden stupa
  k.cyl(base * 0.3, base * 0.33, 0.35 * S, 8, gold, 0, y, 0);
  k.cyl(base * 0.27, base * 0.29, 0.3 * S, 8, gold, 0, y + 0.35 * S, 0);
  const sy = y + 0.65 * S;
  const H = 4.8 * S;
  k.lathe(stupaProfile(base * 0.27, H), 32, gold, 0, sy, 0);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    k.cone(0.06 * S, 0.24 * S, 4, gold, Math.cos(a) * base * 0.1, sy + H * 0.8, Math.sin(a) * base * 0.1);
  }
  hti(k, 0, sy + H - 0.05, 0, S * 1.15);
};

const shoppingMall: Builder = (k, W, D, S, prop, theme) => {
  const concrete = stdMat('#e7e5e4', { rough: 0.5 });
  const glassTex = windowTexture('#3b0764', '#60a5fa', '#fde68a');
  const glass = stdMat('#ffffff', { map: glassTex, emissiveMap: glassTex, emissive: '#ffffff', glow: 0.35, metal: 0.4, rough: 0.2 });
  const brand = stdMat(theme.primaryHex, { metal: 0.35, rough: 0.35 });
  const bw = W * 0.88;
  const bd = D * 0.72;
  const floors = 3;
  const fh = 0.85 * S;
  let y = 0.45;
  for (let f = 0; f < floors; f++) {
    k.slab(bw + 0.1, 0.12, bd + 0.1, concrete, 0, y, -0.2);
    const geo = scaleUV(new THREE.BoxGeometry(bw, fh - 0.12, bd), Math.round(bw * 1.2), 1);
    k.mesh(geo, glass, 0, y + 0.12 + (fh - 0.12) / 2, -0.2);
    // vertical mullions on the street facade
    for (let m = 0; m <= 8; m++) {
      k.box(0.05, fh - 0.12, 0.05, concrete, -bw / 2 + (bw * m) / 8, y + 0.12 + (fh - 0.12) / 2, -0.2 + bd / 2 + 0.03);
    }
    y += fh;
  }
  k.slab(bw + 0.2, 0.18, bd + 0.2, brand, 0, y, -0.2);
  // glass atrium dome with ribs
  k.dome(bw * 0.18, stdMat('#93c5fd', { opacity: 0.7, metal: 0.5, rough: 0.1, emissive: '#a855f7', glow: 0.25 }), 0, y + 0.18, -0.2, 20);
  for (let i = 0; i < 6; i++) {
    const rib = k.mesh(new THREE.TorusGeometry(bw * 0.18, 0.025, 4, 18, Math.PI), concrete, 0, y + 0.18, -0.2);
    rib.rotation.y = (i / 6) * Math.PI;
  }
  // entrance canopy, columns and brand sign
  k.slab(bw * 0.5, 0.1, 0.9, brand, 0, 0.45 + 1.15 * S, bd / 2 + 0.25);
  for (const cx of [-1, -0.33, 0.33, 1]) k.cyl(0.05, 0.05, 1.15 * S, 8, concrete, cx * bw * 0.23, 0.45, bd / 2 + 0.62);
  k.sign((prop.label ?? 'CITY MALL').split(' ').slice(0, 2).join(' ').toUpperCase(), theme.primaryHex, '#fde047', bw * 0.55, 0.42 * S, 0, 0.45 + fh * 2.5, -0.2 + bd / 2 + 0.06);
  // rooftop AC units + garden + flags
  for (let i = 0; i < 4; i++) k.slab(0.4, 0.3, 0.4, '#94a3b8', -bw * 0.35 + i * 0.5, y + 0.18, -0.2 - bd * 0.3);
  k.slab(bw * 0.25, 0.15, bd * 0.3, '#16a34a', bw * 0.3, y + 0.18, -0.2);
  for (const fx of [-1, 1]) {
    k.cyl(0.025, 0.025, 1.5, 6, '#cbd5e1', fx * bw * 0.45, y + 0.18, -0.2 + bd / 2);
    k.box(0.45, 0.28, 0.02, brand, fx * bw * 0.45 + 0.23, y + 1.5, -0.2 + bd / 2);
  }
  // planters along the plaza
  for (let i = 0; i < 5; i++) {
    const px = -bw / 2 + 0.3 + (i * (bw - 0.6)) / 4;
    if (Math.abs(px) < bw * 0.25) continue;
    k.slab(0.36, 0.25, 0.36, concrete, px, 0.45, bd / 2 + 0.6);
    k.sphere(0.24, '#15803d', px, 0.45 + 0.42, bd / 2 + 0.6, 8, 6);
  }
};

const marketHall: Builder = (k, W, D, S, prop, theme) => {
  const steel = stdMat('#cbd5e1', { metal: 0.5, rough: 0.35 });
  const floor = stdMat('#f5f5f4', { rough: 0.5 });
  k.slab(W * 0.94, 0.06, D * 0.86, floor, 0, 0.42, 0);
  const cols = 5;
  for (let i = 0; i < cols; i++) {
    const x = -W * 0.44 + (i * W * 0.88) / (cols - 1);
    for (const z of [-D * 0.38, D * 0.38]) k.cyl(0.06, 0.06, 1.7 * S, 8, steel, x, 0.45, z);
  }
  // pitched roof + striped awnings
  const roof = k.mesh(new THREE.CylinderGeometry(D * 0.5, D * 0.5, W * 0.96, 3, 1), stdMat(theme.primaryHex, { rough: 0.5 }), 0, 0.45 + 1.7 * S + D * 0.22, 0);
  roof.rotation.z = Math.PI / 2;
  roof.rotation.x = Math.PI;
  roof.scale.set(1, 1, 0.55);
  const stripes = 10;
  for (let i = 0; i < stripes; i++) {
    const aw = k.box(W * 0.9 / stripes, 0.04, 0.7, i % 2 ? '#ffffff' : theme.primaryHex, -W * 0.45 + (W * 0.9 * (i + 0.5)) / stripes, 0.45 + 1.45 * S, D * 0.42 + 0.25);
    aw.rotation.x = 0.35;
  }
  // shelving aisles with colourful products
  const rng = mulberry32(hashString(prop.label ?? 'market'));
  const productColors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#facc15', '#14b8a6'];
  for (let row = 0; row < 3; row++) {
    const z = -D * 0.25 + row * D * 0.22;
    k.slab(W * 0.72, 0.9 * S, 0.24, steel, 0, 0.48, z);
    for (let lvl = 0; lvl < 3; lvl++) {
      for (let p = 0; p < 12; p++) {
        const x = -W * 0.34 + (p * W * 0.68) / 11;
        const pc = productColors[Math.floor(rng() * productColors.length)];
        k.slab(0.16, 0.18, 0.08, pc, x, 0.52 + lvl * 0.3 * S, z + 0.15);
      }
    }
  }
  // fresh produce crates
  for (let c = 0; c < 4; c++) {
    const x = -W * 0.3 + c * W * 0.2;
    k.slab(0.55, 0.3, 0.4, '#a16207', x, 0.48, D * 0.32);
    for (let f = 0; f < 6; f++) {
      k.sphere(0.08, ['#f97316', '#84cc16', '#ef4444', '#facc15'][c], x - 0.18 + (f % 3) * 0.18, 0.86, D * 0.32 - 0.08 + Math.floor(f / 3) * 0.16, 6, 5);
    }
  }
  k.sign((prop.label ?? 'MARKET').toUpperCase(), '#1e1b4b', '#fde047', W * 0.5, 0.36 * S, 0, 0.45 + 1.85 * S, D * 0.5 + 0.02);
};

const posCounter: Builder = (k, W, D, S, prop, theme) => {
  const brand = stdMat(theme.primaryHex, { rough: 0.4 });
  k.slab(W * 0.9, 0.06, D * 0.85, '#e7e5e4', 0, 0.42, 0);
  for (let lane = 0; lane < 2; lane++) {
    const x = -W * 0.2 + lane * W * 0.4;
    k.slab(0.5, 0.75 * S, 1.6, brand, x, 0.48, 0);
    k.slab(0.42, 0.04, 1.2, '#1f2937', x, 0.48 + 0.75 * S, -0.15); // conveyor belt
    k.slab(0.3, 0.22, 0.24, '#334155', x, 0.48 + 0.75 * S, 0.55); // register
    const screen = k.box(0.28, 0.2, 0.03, glowMat('#38bdf8', 0.9), x, 0.48 + 0.75 * S + 0.42, 0.5);
    screen.rotation.x = -0.3;
    k.cyl(0.03, 0.03, 1.4 * S, 6, '#94a3b8', x + 0.3, 0.48, -0.7);
    k.box(0.3, 0.3, 0.05, glowMat('#22c55e', 1), x + 0.3, 0.48 + 1.4 * S, -0.7);
  }
  // queue rope posts
  for (let i = 0; i < 5; i++) {
    k.cyl(0.035, 0.05, 0.7, 8, '#facc15', -W * 0.38 + i * W * 0.19, 0.45, D * 0.36);
  }
  k.slab(W * 0.95, 0.08, D * 0.9, brand, 0, 0.45 + 1.9 * S, 0);
  for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) k.cyl(0.05, 0.05, 1.9 * S, 8, '#e5e7eb', cx * W * 0.44, 0.45, cz * D * 0.4);
  k.sign('POS CHECKOUT', theme.primaryHex, '#fde047', W * 0.6, 0.3 * S, 0, 0.45 + 2.15 * S, D * 0.45);
};

// ---------------------------------------------------------------------------
// Food & Beverage — Mandalay
// ---------------------------------------------------------------------------

const mandalayMoatTower: Builder = (k, W, D, S) => {
  const brick = stdMat('#9f3a2a', { rough: 0.85 });
  const dark = stdMat('#7f1d1d', { rough: 0.8 });
  const wallH = 1.4 * S;
  const wallD = 0.6 * S;
  k.slab(W * 0.98, wallH, wallD, brick, 0, 0.42, -D * 0.12);
  // pointed merlons along the battlement
  const n = Math.floor(W / 0.42);
  for (let i = 0; i < n; i++) {
    const x = -W * 0.48 + (i + 0.5) * (W * 0.96) / n;
    k.slab(0.24, 0.24, wallD * 0.5, brick, x, 0.42 + wallH, -D * 0.12 + wallD * 0.2);
    const cap = k.cone(0.17, 0.2, 4, brick, x, 0.42 + wallH + 0.24, -D * 0.12 + wallD * 0.2);
    cap.rotation.y = Math.PI / 4;
  }
  // central bastion with 7-tier pyatthat gate tower
  k.slab(1.9 * S, wallH + 0.6 * S, 1.6 * S, brick, 0, 0.42, -D * 0.1);
  archDoor(k, 0.62 * S, 0.8 * S, 0, 0.42, -D * 0.1 + 0.81 * S, 0, '#1c1410');
  const deck = 0.42 + wallH + 0.6 * S;
  k.slab(2.1 * S, 0.1, 1.8 * S, '#facc15', 0, deck, -D * 0.1);
  k.slab(1.1 * S, 0.5 * S, 1.1 * S, dark, 0, deck + 0.1, -D * 0.1);
  pyatthat(k, 0, deck + 0.6 * S, -D * 0.1, 1.7 * S, 7, '#7c2d12', '#facc15');
  // side bastions with 3-tier pavilions
  for (const sx of [-1, 1]) {
    const x = sx * W * 0.4;
    k.slab(1.0 * S, wallH + 0.3 * S, 1.0 * S, brick, x, 0.42, -D * 0.12);
    pyatthat(k, x, 0.42 + wallH + 0.3 * S, -D * 0.12, 1.05 * S, 3, '#7c2d12', '#facc15');
  }
  // moat in front with teak footbridge
  k.slab(W * 0.98, 0.06, D * 0.32, stdMat('#0e7490', { emissive: '#0891b2', glow: 0.25, rough: 0.15, metal: 0.3 }), 0, 0.43, D * 0.28);
  k.slab(0.9 * S, 0.1, D * 0.36, '#8b5a2b', 0, 0.5, D * 0.28);
  for (const sx of [-1, 1]) k.slab(0.05, 0.25, D * 0.36, '#5b3a1e', sx * 0.43 * S, 0.6, D * 0.28);
};

const ubeinBridge: Builder = (k, W, D, S) => {
  const teak = stdMat('#8b5a2b', { rough: 0.85 });
  const dark = stdMat('#5b3a1e', { rough: 0.9 });
  k.slab(W * 1.05, 0.05, D * 0.95, stdMat('#0e7490', { emissive: '#0891b2', glow: 0.25, rough: 0.15, metal: 0.3 }), 0, 0.0, 0);
  const segs = 22;
  const len = W * 1.02;
  const deckY = (i: number) => 1.0 * S + Math.sin((Math.PI * i) / segs) * 0.35 * S;
  for (let i = 0; i < segs; i++) {
    const x0 = -len / 2 + (len * i) / segs;
    const x1 = x0 + len / segs;
    const y0 = deckY(i);
    const y1 = deckY(i + 1);
    const plank = k.box(len / segs + 0.02, 0.08, 0.7 * S, teak, (x0 + x1) / 2, (y0 + y1) / 2, 0);
    plank.rotation.z = Math.atan2(y1 - y0, x1 - x0);
    for (const z of [-0.36 * S, 0.36 * S]) {
      k.beam(V(x0, 0, z), V(x0, y0, z), 0.05 * S, dark, true);
      k.beam(V(x0, y0 + 0.35 * S, z), V(x1, y1 + 0.35 * S, z), 0.025 * S, teak);
      k.beam(V(x0, y0, z), V(x0, y0 + 0.38 * S, z), 0.025 * S, teak);
    }
    k.beam(V(x0, y0 - 0.25 * S, -0.36 * S), V(x0, y0 - 0.25 * S, 0.36 * S), 0.04 * S, dark);
  }
  // mid-span rest pavilion
  const py = deckY(segs / 2);
  for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) k.cyl(0.04 * S, 0.04 * S, 0.8 * S, 6, teak, cx * 0.35 * S, py, cz * 0.33 * S);
  pyatthat(k, 0, py + 0.8 * S, 0, 1.1 * S, 3, '#5b3a1e', '#facc15');
  // monk with umbrella crossing the bridge (iconic U Bein scene)
  const mx = len * 0.22;
  const my = deckY(Math.round(segs * 0.72));
  k.cyl(0.13 * S, 0.18 * S, 0.6 * S, 10, '#b45309', mx, my, 0);
  k.sphere(0.11 * S, '#d6a477', mx, my + 0.72 * S, 0, 10, 8);
  k.cyl(0.01, 0.01, 0.5 * S, 4, '#1f2937', mx + 0.12 * S, my + 0.55 * S, 0);
  k.cone(0.32 * S, 0.14 * S, 10, '#dc2626', mx + 0.12 * S, my + 1.0 * S, 0);
};

const bakeryKitchen: Builder = (k, W, D, S, prop, theme) => {
  const cream = stdMat('#fde7c7', { rough: 0.7 });
  const brick = stdMat('#a2412a', { rough: 0.9 });
  const tile = stdMat('#b91c1c', { rough: 0.55 });
  const hx = -W * 0.18;
  const hw = W * 0.55;
  const hd = D * 0.6;
  k.slab(hw, 1.5 * S, hd, cream, hx, 0.42, -D * 0.12);
  const roof = k.mesh(new THREE.CylinderGeometry(hd * 0.62, hd * 0.62, hw * 1.08, 3), tile, hx, 0.42 + 1.5 * S + hd * 0.3, -D * 0.12);
  roof.rotation.z = Math.PI / 2;
  roof.rotation.x = -Math.PI / 2;
  roof.scale.set(1, 1, 0.7);
  for (let i = 0; i < 3; i++) {
    k.box(0.4 * S, 0.45 * S, 0.04, glowMat('#fde68a', 0.6), hx - hw * 0.3 + i * hw * 0.3, 0.42 + 0.9 * S, -D * 0.12 + hd / 2 + 0.01);
  }
  archDoor(k, 0.45 * S, 0.7 * S, hx + hw * 0.36, 0.42, -D * 0.12 + hd / 2 + 0.02, 0, '#7c2d12');
  // striped awning
  for (let i = 0; i < 8; i++) {
    const a = k.box(hw / 8, 0.04, 0.7, i % 2 ? '#ffffff' : theme.primaryHex, hx - hw / 2 + (hw * (i + 0.5)) / 8, 0.42 + 1.3 * S, -D * 0.12 + hd / 2 + 0.3);
    a.rotation.x = 0.4;
  }
  // wood-fired brick kiln with glowing mouth and smoking chimney
  const kx = W * 0.3;
  const kz = D * 0.05;
  k.cyl(0.85 * S, 0.9 * S, 0.45 * S, 16, brick, kx, 0.42, kz);
  k.dome(0.85 * S, brick, kx, 0.42 + 0.45 * S, kz, 18);
  k.mesh(new THREE.CircleGeometry(0.3 * S, 14, 0, Math.PI), glowMat('#fb923c', 1.8), kx, 0.42 + 0.45 * S, kz + 0.86 * S);
  k.cyl(0.18 * S, 0.22 * S, 1.6 * S, 10, brick, kx + 0.35 * S, 0.42 + 0.8 * S, kz - 0.35 * S);
  const smoke = k.group('smoke_puff', kx + 0.35 * S, 0.42 + 2.5 * S, kz - 0.35 * S);
  for (let i = 0; i < 3; i++) smoke.sphere(0.22 * S * (1 + i * 0.3), stdMat('#e5e7eb', { opacity: 0.55 }), i * 0.12, i * 0.42 * S, 0, 8, 6);
  // bread display with loaves
  k.slab(1.4 * S, 0.6 * S, 0.5 * S, '#8b5a2b', -W * 0.12, 0.42, D * 0.38);
  for (let i = 0; i < 6; i++) {
    const loaf = k.mesh(new THREE.CapsuleGeometry(0.07 * S, 0.18 * S, 4, 8), '#d97706', -W * 0.12 - 0.55 * S + i * 0.22 * S, 0.42 + 0.68 * S, D * 0.38);
    loaf.rotation.z = Math.PI / 2;
  }
  k.sign((prop.label ?? 'BAKERY').toUpperCase(), '#7f1d1d', '#fde047', hw * 0.8, 0.32 * S, hx, 0.42 + 1.75 * S, -D * 0.12 + hd / 2 + 0.05);
};

const cafePatio: Builder = (k, W, D, S, prop, theme) => {
  k.slab(W * 0.95, 0.08, D * 0.9, '#a16207', 0, 0.42, 0);
  // kiosk with espresso machine
  k.slab(W * 0.35, 1.1 * S, D * 0.3, '#fef3c7', -W * 0.28, 0.5, -D * 0.28);
  k.slab(W * 0.37, 0.08, D * 0.36, theme.primaryHex, -W * 0.28, 0.5 + 1.1 * S, -D * 0.26);
  k.slab(0.3, 0.32, 0.25, stdMat('#94a3b8', { metal: 0.8, rough: 0.2 }), -W * 0.28, 0.5 + 0.75 * S, -D * 0.12);
  k.sign('ESPRESSO', '#7f1d1d', '#fef3c7', W * 0.3, 0.22 * S, -W * 0.28, 0.5 + 1.35 * S, -D * 0.12);
  // tables + umbrellas + chairs
  const umbrellaCols = ['#dc2626', '#fef3c7', '#dc2626'];
  for (let t = 0; t < 3; t++) {
    const x = -W * 0.05 + t * W * 0.2;
    const z = D * 0.12 + (t % 2) * D * 0.18;
    k.cyl(0.03, 0.06, 0.6 * S, 6, '#334155', x, 0.5, z);
    k.cyl(0.32 * S, 0.32 * S, 0.04, 14, '#f8fafc', x, 0.5 + 0.6 * S, z);
    k.cyl(0.02, 0.02, 1.5 * S, 6, '#e5e7eb', x, 0.5, z);
    k.cone(0.75 * S, 0.35 * S, 8, stdMat(umbrellaCols[t], { side: THREE.DoubleSide }), x, 0.5 + 1.4 * S, z);
    for (const cx of [-1, 1]) {
      k.slab(0.24 * S, 0.35 * S, 0.24 * S, '#78350f', x + cx * 0.5 * S, 0.5, z);
      k.slab(0.24 * S, 0.35 * S, 0.04, '#78350f', x + cx * 0.5 * S, 0.5 + 0.35 * S, z - 0.12 * S);
    }
  }
  // string lights between corner posts
  const corners: Array<[number, number]> = [[-W * 0.45, D * 0.42], [W * 0.45, D * 0.42], [W * 0.45, -D * 0.42]];
  for (const [cx, cz] of corners) k.cyl(0.03, 0.03, 1.8 * S, 6, '#334155', cx, 0.5, cz);
  for (let seg = 0; seg < corners.length - 1; seg++) {
    const [ax, az] = corners[seg];
    const [bx, bz] = corners[seg + 1];
    for (let i = 1; i < 9; i++) {
      const t = i / 9;
      const sag = Math.sin(t * Math.PI) * 0.25 * S;
      k.sphere(0.05, glowMat(i % 2 ? '#fde68a' : '#fb7185', 1.5), ax + (bx - ax) * t, 0.5 + 1.75 * S - sag, az + (bz - az) * t, 6, 4);
    }
  }
  for (const [px, pz] of [[-W * 0.42, D * 0.05], [W * 0.42, D * 0.05]]) {
    k.cyl(0.16, 0.12, 0.3, 8, '#b45309', px, 0.5, pz);
    k.sphere(0.25, '#16a34a', px, 0.5 + 0.48, pz, 8, 6);
  }
};

// ---------------------------------------------------------------------------
// Manufacturing & Agriculture — Taunggyi & Inle
// ---------------------------------------------------------------------------

const shanTerraces: Builder = (k, W, D, S) => {
  const soil = stdMat('#7c4a24', { rough: 0.95 });
  const wall = stdMat('#78716c', { rough: 0.9, flat: true });
  const tea = stdMat('#166534', { rough: 0.8 });
  const tiers = 4;
  let y = 0.42;
  for (let t = 0; t < tiers; t++) {
    const s = 1 - t * 0.2;
    const tw = W * s;
    const td = D * s;
    const th = 0.38 * S;
    k.slab(tw, th, td, soil, 0, y, 0);
    k.slab(tw + 0.04, 0.12, td + 0.04, wall, 0, y, 0);
    k.slab(tw, 0.05, td, t % 2 ? '#4d7c0f' : '#65a30d', 0, y + th, 0);
    // tea bush rows on the exposed front strip
    const strip = (D * 0.2) / 2;
    const rows = t === tiers - 1 ? 0 : 1;
    for (let r = 0; r < rows; r++) {
      const z = td / 2 - strip / 2;
      const n = Math.floor(tw / 0.38);
      for (let i = 0; i < n; i++) {
        k.sphere(0.15 * S, tea, -tw / 2 + 0.2 + i * ((tw - 0.4) / Math.max(1, n - 1)), y + th + 0.1, z, 6, 5);
      }
    }
    // irrigation cascade
    k.slab(0.22, 0.04, td * 0.2, stdMat('#38bdf8', { emissive: '#0ea5e9', glow: 0.35 }), tw * 0.28, y + th + 0.03, td / 2 - (D * 0.1) / 2);
    y += th;
  }
  // Shan stilt hut on the top tier
  const hx = -W * 0.12;
  for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) k.cyl(0.04, 0.04, 0.45 * S, 6, '#5b3a1e', hx + cx * 0.42 * S, y + 0.05, cz * 0.32 * S);
  k.slab(1.0 * S, 0.06, 0.8 * S, '#8b5a2b', hx, y + 0.5 * S, 0);
  k.slab(0.9 * S, 0.55 * S, 0.7 * S, '#d6b77a', hx, y + 0.56 * S, 0);
  const roof = k.cone(0.85 * S, 0.65 * S, 4, stdMat('#a16207', { rough: 1, flat: true }), hx, y + 1.1 * S, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.8;
  // scarecrow
  const sx = W * 0.2;
  k.cyl(0.03, 0.03, 1.1 * S, 5, '#78350f', sx, y, 0.1);
  k.box(0.7 * S, 0.04, 0.04, '#78350f', sx, y + 0.8 * S, 0.1);
  k.sphere(0.12 * S, '#fde68a', sx, y + 1.18 * S, 0.1, 8, 6);
  k.cone(0.24 * S, 0.18 * S, 10, '#ca8a04', sx, y + 1.26 * S, 0.1);
};

const inleFloatingGarden: Builder = (k, W, D, S) => {
  k.slab(W * 1.05, 0.08, D * 1.0, stdMat('#0e7490', { emissive: '#0891b2', glow: 0.25, rough: 0.15, metal: 0.3 }), 0, -0.02, 0);
  const rows = 4;
  for (let r = 0; r < rows; r++) {
    const z = -D * 0.36 + r * D * 0.2;
    k.slab(W * 0.78, 0.1, D * 0.1, '#5b3a1e', -W * 0.08, 0.04, z);
    const n = Math.floor((W * 0.74) / 0.36);
    for (let i = 0; i < n; i++) {
      const x = -W * 0.45 + 0.2 + i * 0.36;
      k.cyl(0.012, 0.012, 0.65 * S, 4, '#a16207', x, 0.12, z);
      k.sphere(0.13 * S, '#15803d', x, 0.12 + 0.3 * S, z, 6, 5);
      if (i % 2 === 0) k.sphere(0.05 * S, '#dc2626', x + 0.06, 0.12 + 0.24 * S, z + 0.08, 5, 4);
    }
  }
  // leg-rowing fisherman with conical net basket
  const bx = W * 0.36;
  const bz = D * 0.22;
  const hull = k.mesh(new THREE.CylinderGeometry(0.16 * S, 0.12 * S, 2.2 * S, 6), '#3f2a14', bx, 0.06, bz);
  hull.rotation.x = Math.PI / 2;
  hull.scale.set(1, 1, 0.45);
  k.cyl(0.08 * S, 0.1 * S, 0.55 * S, 8, '#1e3a8a', bx, 0.12, bz + 0.85 * S);
  k.sphere(0.09 * S, '#d6a477', bx, 0.12 + 0.66 * S, bz + 0.85 * S, 8, 6);
  k.cone(0.2 * S, 0.12 * S, 10, '#ca8a04', bx, 0.12 + 0.72 * S, bz + 0.85 * S);
  k.beam(V(bx + 0.08 * S, 0.1, bz + 0.85 * S), V(bx + 0.25 * S, 0.9 * S, bz + 1.1 * S), 0.015 * S, '#a16207', true);
  k.mesh(new THREE.ConeGeometry(0.45 * S, 1.0 * S, 10, 1, true), stdMat('#d6b77a', { opacity: 0.7, side: THREE.DoubleSide }), bx, 0.6 * S, bz - 0.4 * S);
  // stilt house
  const hx = W * 0.36;
  const hz = -D * 0.25;
  for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) k.cyl(0.04, 0.04, 0.8 * S, 6, '#5b3a1e', hx + cx * 0.45 * S, -0.05, hz + cz * 0.35 * S);
  k.slab(1.1 * S, 0.06, 0.85 * S, '#8b5a2b', hx, 0.75 * S, hz);
  k.slab(0.95 * S, 0.55 * S, 0.7 * S, '#c8a165', hx, 0.81 * S, hz);
  const roof = k.cone(0.9 * S, 0.6 * S, 4, stdMat('#78350f', { flat: true }), hx, 1.36 * S, hz);
  roof.rotation.y = Math.PI / 4;
};

const factoryPlant: Builder = (k, W, D, S, prop, theme) => {
  const panel = stdMat('#64748b', { metal: 0.45, rough: 0.4 });
  const steel = stdMat('#cbd5e1', { metal: 0.75, rough: 0.25 });
  const brand = stdMat(theme.accentHex, { metal: 0.3, rough: 0.4 });
  const hw = W * 0.6;
  const hd = D * 0.62;
  const hx = -W * 0.16;
  const hh = 1.8 * S;
  k.slab(hw, hh, hd, panel, hx, 0.42, 0);
  k.slab(hw + 0.02, 0.22, hd + 0.02, brand, hx, 0.42 + hh * 0.68, 0);
  // sawtooth roof with skylight glazing
  const teeth = 4;
  for (let i = 0; i < teeth; i++) {
    const tz = -hd / 2 + (hd * (i + 0.5)) / teeth;
    const shape = new THREE.Shape();
    shape.moveTo(-hd / teeth / 2, 0);
    shape.lineTo(hd / teeth / 2, 0);
    shape.lineTo(hd / teeth / 2, 0.55 * S);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: hw, bevelEnabled: false });
    const tooth = k.mesh(geo, panel, hx - hw / 2, 0.42 + hh, tz);
    tooth.rotation.y = Math.PI / 2;
    tooth.position.x = hx - hw / 2;
    const sky = k.box(hw * 0.98, 0.5 * S, 0.03, glowMat('#bae6fd', 0.5), hx, 0.42 + hh + 0.27 * S, tz + hd / teeth / 2 - 0.02);
    sky.rotation.x = 0;
  }
  // roller doors
  for (let i = 0; i < 2; i++) {
    const dx = hx - hw * 0.22 + i * hw * 0.44;
    k.box(0.9 * S, 1.0 * S, 0.04, '#334155', dx, 0.42 + 0.5 * S, hd / 2 + 0.01);
    for (let l = 0; l < 6; l++) k.box(0.9 * S, 0.02, 0.05, '#475569', dx, 0.42 + 0.1 * S + l * 0.16 * S, hd / 2 + 0.03);
  }
  // silos with domes, bands and a catwalk
  const sx = W * 0.3;
  for (let i = 0; i < 3; i++) {
    const z = -D * 0.28 + i * D * 0.28;
    k.cyl(0.42 * S, 0.42 * S, 2.9 * S, 18, steel, sx, 0.42, z);
    k.dome(0.42 * S, steel, sx, 0.42 + 2.9 * S, z);
    for (let b = 0; b < 3; b++) k.torus(0.43 * S, 0.03, '#94a3b8', sx, 0.42 + 0.7 * S + b * 0.8 * S, z);
    k.beam(V(sx - 0.42 * S, 0.42 + 2.2 * S, z), V(hx + hw / 2, 0.42 + 1.4 * S, z * 0.6), 0.07 * S, '#94a3b8', true);
  }
  k.slab(0.22 * S, 0.06, D * 0.62, '#facc15', sx, 0.42 + 3.3 * S, 0);
  // banded smokestack with smoke
  const cx = hx - hw * 0.35;
  const cz = -hd * 0.3;
  k.cyl(0.18 * S, 0.26 * S, 3.6 * S, 12, '#e5e7eb', cx, 0.42 + hh * 0.5, cz);
  for (let b = 0; b < 2; b++) k.cyl(0.21 * S, 0.21 * S, 0.3 * S, 12, '#dc2626', cx, 0.42 + hh * 0.5 + 2.6 * S + b * 0.6 * S, cz);
  const smoke = k.group('smoke_puff', cx, 0.42 + hh * 0.5 + 3.8 * S, cz);
  for (let i = 0; i < 3; i++) smoke.sphere(0.25 * S * (1 + i * 0.35), stdMat('#e2e8f0', { opacity: 0.5 }), i * 0.15, i * 0.45 * S, 0, 8, 6);
  // conveyor with crates
  k.slab(W * 0.3, 0.1, 0.35 * S, '#1f2937', hx + hw * 0.4, 0.42 + 0.6 * S, hd / 2 + 0.55);
  for (let i = 0; i < 4; i++) k.slab(0.25 * S, 0.22 * S, 0.25 * S, '#a16207', hx + hw * 0.3 + i * 0.32 * S, 0.42 + 0.7 * S, hd / 2 + 0.55);
  k.sign((prop.label ?? 'FACTORY').toUpperCase(), '#1e1b4b', '#c7d2fe', hw * 0.7, 0.3 * S, hx, 0.42 + hh * 0.9, hd / 2 + 0.02);
};

// ---------------------------------------------------------------------------
// Ventures Valley — Putao & Myeik
// ---------------------------------------------------------------------------

const putaoPeaks: Builder = (k, W, D, S, prop) => {
  const seed = hashString(prop.label ?? 'putao');
  const rock = stdMat('#475569', { rough: 0.95, flat: true });
  const snow = stdMat('#f8fafc', { rough: 0.6, flat: true, emissive: '#bae6fd', glow: 0.12 });
  const peaks: Array<[number, number, number, number]> = [
    [-W * 0.3, 4.4 * S, 1.6 * S, -D * 0.05],
    [0, 6.0 * S, 2.2 * S, -D * 0.12],
    [W * 0.3, 4.0 * S, 1.5 * S, -D * 0.02],
    [W * 0.12, 3.0 * S, 1.2 * S, D * 0.22],
  ];
  peaks.forEach(([x, h, r, z], i) => {
    const g = jitterGeometry(new THREE.ConeGeometry(r, h, 11, 5), r * 0.22, seed + i, h / 2 - 0.01);
    k.mesh(g, rock, x, 0.42 + h / 2, z);
    const cap = jitterGeometry(new THREE.ConeGeometry(r * 0.5, h * 0.42, 11, 3), r * 0.1, seed + i + 50, h * 0.21 - 0.01);
    k.mesh(cap, snow, x, 0.42 + h - h * 0.21 + 0.02, z);
  });
  const rng = mulberry32(seed);
  for (let i = 0; i < 9; i++) {
    const a = rng() * Math.PI * 2;
    pineTree(k, Math.cos(a) * W * 0.46, 0.42, D * 0.25 + Math.sin(a) * D * 0.18, (0.7 + rng() * 0.4) * S, true);
  }
  // cryo-server cabin
  const cx = -W * 0.1;
  const cz = D * 0.32;
  k.slab(1.1 * S, 0.75 * S, 0.8 * S, '#e2e8f0', cx, 0.42, cz);
  k.box(0.6 * S, 0.3 * S, 0.03, glowMat('#22d3ee', 1.1), cx, 0.42 + 0.42 * S, cz + 0.41 * S);
  const roof = k.cone(0.85 * S, 0.45 * S, 4, '#334155', cx, 0.42 + 0.75 * S, cz);
  roof.rotation.y = Math.PI / 4;
  k.cyl(0.02, 0.02, 1.2 * S, 5, '#94a3b8', cx + 0.45 * S, 0.42 + 0.75 * S, cz);
  k.sphere(0.07 * S, glowMat('#34d399', 1.6), cx + 0.45 * S, 0.42 + 1.95 * S, cz, 8, 6);
};

const serverPod: Builder = (k, W, D, S, prop, theme) => {
  k.slab(W * 0.95, 0.1, D * 0.9, '#0f172a', 0, 0.42, 0);
  const rng = mulberry32(hashString(prop.label ?? 'rack'));
  const racks = 3;
  for (let r = 0; r < racks; r++) {
    const x = -W * 0.3 + r * W * 0.3;
    k.slab(0.75 * S, 2.6 * S, 0.9 * S, stdMat('#111827', { metal: 0.6, rough: 0.3 }), x, 0.52, 0);
    k.box(0.68 * S, 2.45 * S, 0.02, stdMat('#10b981', { opacity: 0.35, emissive: '#10b981', glow: 0.4 }), x, 0.52 + 1.3 * S, 0.46 * S);
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 2; col++) {
        const on = rng() > 0.25;
        k.box(0.22 * S, 0.06 * S, 0.02, glowMat(on ? (col ? '#34d399' : '#22d3ee') : '#064e3b', on ? 1.6 : 0.2), x - 0.16 * S + col * 0.32 * S, 0.52 + 0.3 * S + row * 0.24 * S, 0.47 * S);
      }
    }
    // roof cooling unit with fans
    k.slab(0.7 * S, 0.22 * S, 0.8 * S, '#334155', x, 0.52 + 2.6 * S, 0);
    for (const fz of [-0.2, 0.2]) k.cyl(0.14 * S, 0.14 * S, 0.04, 12, '#94a3b8', x, 0.52 + 2.82 * S, fz * S);
  }
  // overhead cable tray
  k.slab(W * 0.7, 0.06, 0.25 * S, '#facc15', 0, 0.52 + 3.1 * S, -0.2 * S);
  // holographic data ring + core
  const holo = k.group('spin_ring', 0, 0.52 + 4.0 * S, 0);
  holo.torus(1.0 * S, 0.04 * S, glowMat(theme.accentHex, 1.4), 0, 0, 0, true, 32);
  holo.torus(0.7 * S, 0.03 * S, glowMat('#22d3ee', 1.4), 0, 0.15 * S, 0, false, 28);
  holo.mesh(new THREE.IcosahedronGeometry(0.32 * S, 1), stdMat('#ecfdf5', { emissive: '#34d399', glow: 0.9, flat: true }), 0, 0, 0);
  k.cyl(0.03, 0.04, 1.6 * S, 6, '#94a3b8', W * 0.42, 0.52, -D * 0.35);
  k.sphere(0.08 * S, glowMat('#f43f5e', 1.8), W * 0.42, 0.52 + 1.65 * S, -D * 0.35, 8, 6);
};

const myeikIsland: Builder = (k, W, D, S, prop) => {
  const R = Math.max(W, D) * 0.55;
  const seed = hashString(prop.label ?? 'myeik');
  k.mesh(new THREE.CircleGeometry(R, 32).rotateX(-Math.PI / 2), stdMat('#0e7490', { emissive: '#06b6d4', glow: 0.2, rough: 0.15, metal: 0.3 }), 0, 0.03, 0);
  k.cyl(R * 0.72, R * 0.8, 0.25, 24, '#f5deb3', 0, 0, 0);
  const rock = stdMat('#57534e', { rough: 0.95, flat: true });
  const jungle = stdMat('#166534', { rough: 0.8, flat: true });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const r = (0.8 + (i % 2) * 0.35) * S;
    const g = jitterGeometry(new THREE.DodecahedronGeometry(r, 1), r * 0.25, seed + i);
    k.mesh(g, rock, Math.cos(a) * R * 0.3, 0.25 + r * 0.55, Math.sin(a) * R * 0.25);
  }
  const hill = jitterGeometry(new THREE.IcosahedronGeometry(R * 0.42, 1), R * 0.08, seed + 9);
  const hm = k.mesh(hill, jungle, 0, 0.6 * S, -R * 0.05);
  hm.scale.y = 0.55;
  palmTree(k, -R * 0.45, 0.25, R * 0.35, 0.8 * S, seed + 1);
  palmTree(k, R * 0.5, 0.25, R * 0.2, 0.75 * S, seed + 2);
  palmTree(k, R * 0.05, 0.25, R * 0.55, 0.7 * S, seed + 3);
  // glowing pearl dome + floating pearl
  k.dome(0.75 * S, stdMat('#ecfdf5', { emissive: '#99f6e4', glow: 0.45, opacity: 0.85, metal: 0.4, rough: 0.1 }), 0, 1.15 * S, -R * 0.05);
  const pearl = k.group('spin_ring', 0, 2.6 * S, -R * 0.05);
  pearl.sphere(0.32 * S, stdMat('#f8fafc', { emissive: '#5eead4', glow: 0.7, metal: 0.6, rough: 0.08 }), 0, 0, 0, 20, 14);
  pearl.torus(0.55 * S, 0.025 * S, glowMat('#34d399', 1.3), 0, 0, 0, true, 28);
  // open oyster shell + pier
  const shell = k.mesh(new THREE.SphereGeometry(0.35 * S, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#e7e5e4', R * 0.45, 0.3, -R * 0.3);
  shell.rotation.x = Math.PI;
  shell.scale.y = 0.4;
  const lid = k.mesh(new THREE.SphereGeometry(0.35 * S, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#d6d3d1', R * 0.45, 0.42, -R * 0.42);
  lid.rotation.x = -0.9;
  lid.scale.y = 0.4;
  k.slab(0.5 * S, 0.06, R * 0.6, '#8b5a2b', 0, 0.2, R * 0.9);
};

// ---------------------------------------------------------------------------
// Property Estates — Mawlamyaing
// ---------------------------------------------------------------------------

const ridgeTower: Builder = (k, W, D, S, prop, theme) => {
  const tex = windowTexture('#1e3a8a', '#93c5fd', '#fef9c3');
  const glass = stdMat('#ffffff', { map: tex, emissiveMap: tex, emissive: '#ffffff', glow: 0.32, metal: 0.55, rough: 0.18 });
  const frame = stdMat('#e2e8f0', { metal: 0.5, rough: 0.3 });
  // green ridge mound with Kyaikthanlan-style golden pagoda
  const mound = k.mesh(new THREE.SphereGeometry(W * 0.32, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), stdMat('#4d7c0f', { flat: true }), -W * 0.3, 0.42, D * 0.05);
  mound.scale.y = 0.35;
  k.lathe(stupaProfile(0.45 * S, 2.0 * S), 20, stdMat('#facc15', { metal: 0.85, rough: 0.2 }), -W * 0.3, 0.42 + W * 0.11, D * 0.05);
  hti(k, -W * 0.3, 0.42 + W * 0.11 + 1.95 * S, D * 0.05, 0.6 * S);
  // stepped glass skyscraper
  const tx = W * 0.16;
  let y = 0.42;
  const tiers: Array<[number, number]> = [
    [W * 0.42, 2.6 * S],
    [W * 0.33, 2.2 * S],
    [W * 0.24, 1.8 * S],
  ];
  for (const [tw, th] of tiers) {
    const geo = scaleUV(new THREE.BoxGeometry(tw, th, tw * 0.8), Math.max(2, Math.round(tw * 1.6)), Math.max(2, Math.round(th * 1.6)));
    k.mesh(geo, glass, tx, y + th / 2, 0);
    k.slab(tw + 0.08, 0.1, tw * 0.8 + 0.08, frame, tx, y + th, 0);
    for (const cx of [-1, 1]) for (const cz of [-1, 1]) k.box(0.06, th, 0.06, frame, tx + (cx * tw) / 2, y + th / 2, (cz * tw * 0.8) / 2);
    y += th + 0.1;
  }
  // helipad crown + spire
  k.cyl(W * 0.12, W * 0.12, 0.08, 20, '#334155', tx, y, 0);
  k.torus(W * 0.08, 0.025, '#facc15', tx, y + 0.09, 0, true, 24);
  k.cyl(0.03, 0.05, 1.4 * S, 6, frame, tx + W * 0.08, y, -W * 0.06);
  k.sphere(0.07, glowMat('#ef4444', 1.8), tx + W * 0.08, y + 1.45 * S, -W * 0.06, 8, 6);
  k.sign('CITY PROPERTIES', theme.primaryHex, '#ffffff', W * 0.36, 0.3 * S, tx, 0.42 + 2.2 * S, W * 0.17 + 0.02);
};

const salesGallery: Builder = (k, W, D, S, prop, theme) => {
  const white = stdMat('#f8fafc', { rough: 0.4 });
  const glass = stdMat('#bfdbfe', { opacity: 0.45, metal: 0.4, rough: 0.05 });
  k.slab(W * 0.9, 0.1, D * 0.82, '#e2e8f0', 0, 0.42, 0);
  const gw = W * 0.8;
  const gd = D * 0.66;
  const gh = 1.35 * S;
  k.slab(gw + 0.6, 0.16, gd + 0.6, white, 0, 0.52 + gh, 0);
  for (const cx of [-1, 1]) for (const cz of [-1, 1]) k.cyl(0.05, 0.05, gh, 8, white, (cx * gw) / 2, 0.52, (cz * gd) / 2);
  k.box(gw, gh, 0.03, glass, 0, 0.52 + gh / 2, gd / 2);
  k.box(gw, gh, 0.03, glass, 0, 0.52 + gh / 2, -gd / 2);
  k.box(0.03, gh, gd, glass, gw / 2, 0.52 + gh / 2, 0);
  k.box(0.03, gh, gd, glass, -gw / 2, 0.52 + gh / 2, 0);
  // blueprint table with scale models
  k.slab(gw * 0.6, 0.6 * S, gd * 0.5, '#334155', 0, 0.52, 0);
  const bp = k.box(gw * 0.58, 0.02, gd * 0.48, stdMat('#1d4ed8', { emissive: '#3b82f6', glow: 0.45 }), 0, 0.52 + 0.61 * S, 0);
  bp.rotation.y = 0;
  for (let i = 0; i < 5; i++) {
    const h = (0.2 + (i % 3) * 0.15) * S;
    k.slab(0.16 * S, h, 0.16 * S, i % 2 ? '#e2e8f0' : '#93c5fd', -gw * 0.22 + i * gw * 0.11, 0.52 + 0.62 * S, (i % 2 ? 0.1 : -0.1) * S);
  }
  for (let f = 0; f < 3; f++) {
    const fx = -W * 0.42 + f * 0.45;
    k.cyl(0.025, 0.025, 2.0 * S, 6, '#cbd5e1', fx, 0.52, D * 0.42);
    k.box(0.5, 0.3, 0.02, theme.primaryHex, fx + 0.26, 0.52 + 1.85 * S, D * 0.42);
  }
  k.sign((prop.label ?? 'SALES GALLERY').toUpperCase(), theme.primaryHex, '#ffffff', gw * 0.7, 0.28 * S, 0, 0.52 + gh + 0.38, gd / 2 + 0.31);
};

const towerCrane: Builder = (k, W, D, S, prop, theme) => {
  const yellow = stdMat('#facc15', { metal: 0.4, rough: 0.45 });
  const concrete = stdMat('#a8a29e', { rough: 0.85 });
  // building under construction: column grid + slabs + safety net
  const bx = -W * 0.18;
  const bw = W * 0.5;
  const bd = D * 0.6;
  const levels = 4;
  for (let l = 0; l < levels; l++) {
    const y = 0.42 + l * 0.8 * S;
    k.slab(bw, 0.1, bd, concrete, bx, y, 0);
    if (l === levels - 1) break;
    for (let cx = 0; cx < 3; cx++) for (let cz = 0; cz < 3; cz++) {
      k.box(0.12, 0.8 * S, 0.12, concrete, bx - bw / 2 + 0.1 + (cx * (bw - 0.2)) / 2, y + 0.4 * S, -bd / 2 + 0.1 + (cz * (bd - 0.2)) / 2);
    }
  }
  k.box(bw * 0.98, 0.8 * S * 2, 0.02, stdMat('#16a34a', { opacity: 0.45, side: THREE.DoubleSide }), bx, 0.42 + 0.8 * S * 1.5, bd / 2 + 0.05);
  // lattice mast
  const mx = W * 0.28;
  const mz = 0;
  const mastH = 6.8 * S;
  const m = 0.32 * S;
  k.slab(1.0 * S, 0.3, 1.0 * S, concrete, mx, 0.42, mz);
  const corners: Array<[number, number]> = [[-m, -m], [m, -m], [m, m], [-m, m]];
  for (const [cx, cz] of corners) k.box(0.06 * S, mastH, 0.06 * S, yellow, mx + cx, 0.72 + mastH / 2, mz + cz);
  const step = 0.6 * S;
  for (let y = 0.72; y < 0.72 + mastH - step; y += step) {
    for (let s = 0; s < 4; s++) {
      const [ax, az] = corners[s];
      const [bx2, bz2] = corners[(s + 1) % 4];
      k.beam(V(mx + ax, y, mz + az), V(mx + bx2, y + step, mz + bz2), 0.03 * S, yellow);
    }
  }
  // slewing jib assembly (rotates slowly)
  const top = k.group('crane_slew', mx, 0.72 + mastH, mz);
  top.slab(0.8 * S, 0.5 * S, 0.8 * S, '#e5e7eb', 0, 0, 0);
  top.box(0.45 * S, 0.4 * S, 0.02, glowMat('#93c5fd', 0.4), 0, 0.25 * S, 0.41 * S);
  const apex = top.cone(0.35 * S, 1.3 * S, 4, yellow, 0, 0.5 * S, 0);
  apex.rotation.y = Math.PI / 4;
  const jibL = 5.2 * S;
  const jh = 0.35 * S;
  for (const z of [-0.16 * S, 0.16 * S]) {
    top.beam(V(-1.8 * S, 0.5 * S, z), V(jibL, 0.5 * S, z), 0.05 * S, yellow);
  }
  top.beam(V(0, 0.5 * S + jh, 0), V(jibL, 0.5 * S + jh * 0.4, 0), 0.05 * S, yellow);
  for (let x = 0; x < jibL; x += 0.5 * S) {
    top.beam(V(x, 0.5 * S, -0.16 * S), V(x + 0.5 * S, 0.5 * S + jh * 0.7, 0), 0.025 * S, yellow);
    top.beam(V(x, 0.5 * S, 0.16 * S), V(x + 0.5 * S, 0.5 * S + jh * 0.7, 0), 0.025 * S, yellow);
  }
  top.beam(V(0, 1.8 * S, 0), V(jibL * 0.7, 0.5 * S + jh, 0), 0.015 * S, '#475569', true);
  top.beam(V(0, 1.8 * S, 0), V(-1.6 * S, 0.6 * S, 0), 0.015 * S, '#475569', true);
  for (let i = 0; i < 3; i++) top.slab(0.3 * S, 0.45 * S, 0.5 * S, concrete, -1.1 * S - i * 0.3 * S, 0.12 * S, 0);
  // trolley, cable, hook block and a hanging steel beam
  const tx = jibL * 0.62;
  top.slab(0.3 * S, 0.12 * S, 0.36 * S, '#334155', tx, 0.38 * S, 0);
  top.beam(V(tx, 0.38 * S, 0), V(tx, -2.6 * S, 0), 0.012 * S, '#1f2937', true);
  top.slab(0.18 * S, 0.24 * S, 0.12 * S, '#f97316', tx, -2.84 * S, 0);
  top.box(1.4 * S, 0.1 * S, 0.12 * S, '#dc2626', tx, -3.0 * S, 0);
  top.sign('CITY PROPERTIES', theme.primaryHex, '#ffffff', 1.5 * S, 0.3 * S, 1.6 * S, 0.5 * S + jh + 0.25 * S, 0.2 * S);
};

// ---------------------------------------------------------------------------
// Distribution — Dawei
// ---------------------------------------------------------------------------

const containerColors = ['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#0891b2', '#7c3aed', '#e11d48', '#f8fafc'];

function container(k: Kit, x: number, y: number, z: number, color: string, S: number, rotY = 0): void {
  const c = k.group('', x, y, z);
  c.g.rotation.y = rotY;
  c.slab(1.2 * S, 0.5 * S, 0.5 * S, color, 0, 0, 0);
  for (let r = 0; r < 7; r++) c.box(0.025, 0.46 * S, 0.52 * S, '#00000033' === color ? color : stdMat(color, { rough: 0.9 }), -0.55 * S + r * 0.18 * S, 0.25 * S, 0);
}

const daweiPortCrane: Builder = (k, W, D, S, prop, theme) => {
  const concrete = stdMat('#9ca3af', { rough: 0.85 });
  const crane = stdMat('#0ea5e9', { metal: 0.45, rough: 0.4 });
  const gold = stdMat('#f59e0b', { metal: 0.5, rough: 0.35 });
  k.slab(W * 0.98, 0.08, D * 0.9, concrete, 0, 0.42, 0);
  k.slab(W * 0.98, 0.03, 0.12, '#facc15', 0, 0.5, -D * 0.4);
  for (let i = 0; i < 7; i++) {
    const x = -W * 0.45 + (i * W * 0.9) / 6;
    k.cyl(0.08, 0.1, 0.22, 8, '#1f2937', x, 0.5, -D * 0.36);
    const fender = k.cyl(0.1, 0.1, 0.35, 10, '#111827', x, 0.2, -D * 0.46);
    fender.rotation.x = Math.PI / 2;
  }
  // ship-to-shore gantry crane
  const gx = -W * 0.1;
  const legH = 3.6 * S;
  const pw = 1.1 * S;
  const pd = 1.4 * S;
  for (const cx of [-1, 1]) for (const cz of [-1, 1]) {
    k.box(0.16 * S, legH, 0.16 * S, crane, gx + cx * pw, 0.5 + legH / 2, cz * pd * 0.5);
    k.slab(0.35 * S, 0.18 * S, 0.5 * S, '#334155', gx + cx * pw, 0.5, cz * pd * 0.5);
  }
  for (const cz of [-1, 1]) k.box(pw * 2 + 0.2, 0.18 * S, 0.18 * S, crane, gx, 0.5 + legH * 0.55, cz * pd * 0.5);
  for (const cx of [-1, 1]) k.beam(V(gx + cx * pw, 0.5 + 0.2, -pd * 0.5), V(gx + cx * pw, 0.5 + legH * 0.55, pd * 0.5), 0.06 * S, crane);
  // boom reaching over the water (north)
  const boomY = 0.5 + legH;
  for (const cx of [-1, 1]) k.beam(V(gx + cx * 0.35 * S, boomY, pd * 0.9), V(gx + cx * 0.35 * S, boomY, -D * 0.5 - 4.2 * S), 0.16 * S, crane);
  for (let z = pd * 0.9; z > -D * 0.5 - 4.2 * S; z -= 0.6 * S) k.box(0.7 * S, 0.06 * S, 0.06 * S, crane, gx, boomY, z);
  k.slab(1.1 * S, 0.7 * S, 1.2 * S, gold, gx, boomY + 0.08 * S, pd * 0.6);
  for (const cx of [-1, 1]) k.beam(V(gx + cx * 0.35 * S, boomY, 0), V(gx, boomY + 2.0 * S, -0.2 * S), 0.09 * S, crane);
  k.beam(V(gx, boomY + 2.0 * S, -0.2 * S), V(gx, boomY, -D * 0.5 - 3.4 * S), 0.02 * S, '#1f2937', true);
  k.beam(V(gx, boomY + 2.0 * S, -0.2 * S), V(gx, boomY, pd * 0.9), 0.02 * S, '#1f2937', true);
  // trolley + spreader lifting a container
  const tz = -D * 0.5 - 1.6 * S;
  k.slab(0.6 * S, 0.22 * S, 0.5 * S, gold, gx, boomY - 0.25 * S, tz);
  for (const cx of [-1, 1]) k.beam(V(gx + cx * 0.2 * S, boomY - 0.25 * S, tz), V(gx + cx * 0.4 * S, boomY - 2.3 * S, tz), 0.012 * S, '#1f2937', true);
  container(k, gx, boomY - 2.85 * S, tz, '#dc2626', S, Math.PI / 2);
  // container stacks on the quay
  const rng = mulberry32(hashString(prop.label ?? 'port'));
  for (let col = 0; col < 3; col++) for (let row = 0; row < 2; row++) {
    const h = 1 + Math.floor(rng() * 3);
    for (let s = 0; s < h; s++) {
      container(k, W * 0.22 + col * 0.0, 0.5 + s * 0.5 * S, -D * 0.2 + row * 0.55 * S + col * 1.2 * S * 0 + col * 0.55 * S * 2, containerColors[Math.floor(rng() * containerColors.length)], S);
    }
  }
  k.sign('DAWEI DEEP-SEA PORT', '#0c4a6e', '#fde68a', pw * 1.8, 0.3 * S, gx, 0.5 + legH * 0.55 + 0.3 * S, pd * 0.5 + 0.1);
  void theme;
};

const warehouseDepot: Builder = (k, W, D, S, prop, theme) => {
  const corrugated = canvasStripe();
  const wall = stdMat('#cbd5e1', { map: corrugated, metal: 0.35, rough: 0.5 });
  const roofMat = stdMat('#d97706', { metal: 0.45, rough: 0.4, side: THREE.DoubleSide });
  const ww = W * 0.86;
  const wd = D * 0.66;
  const wh = 1.6 * S;
  const geo = scaleUV(new THREE.BoxGeometry(ww, wh, wd), ww * 3, 1);
  k.mesh(geo, wall, 0, 0.5 + wh / 2, -D * 0.08);
  const roof = k.mesh(new THREE.CylinderGeometry(wd / 2, wd / 2, ww, 20, 1, true, -Math.PI / 2, Math.PI), roofMat, 0, 0.5 + wh, -D * 0.08);
  roof.rotation.z = Math.PI / 2;
  roof.scale.set(0.45, 1, 1);
  for (let i = 0; i <= 6; i++) {
    const rib = k.mesh(new THREE.TorusGeometry(wd / 2, 0.03, 4, 16, Math.PI), '#92400e', -ww / 2 + (i * ww) / 6, 0.5 + wh, -D * 0.08);
    rib.rotation.y = Math.PI / 2;
    rib.scale.set(1, 0.45, 1);
  }
  // loading dock with roller doors and bumpers
  k.slab(ww, 0.45, 0.9, '#9ca3af', 0, 0.42, -D * 0.08 + wd / 2 + 0.45);
  for (let i = 0; i < 3; i++) {
    const dx = -ww * 0.3 + i * ww * 0.3;
    k.box(0.95 * S, 1.05 * S, 0.04, '#475569', dx, 0.87 + 0.52 * S, -D * 0.08 + wd / 2 + 0.01);
    for (let l = 0; l < 7; l++) k.box(0.95 * S, 0.02, 0.05, '#64748b', dx, 0.9 + l * 0.15 * S, -D * 0.08 + wd / 2 + 0.03);
    for (const bx of [-1, 1]) k.slab(0.1, 0.25, 0.08, '#111827', dx + bx * 0.5 * S, 0.6, -D * 0.08 + wd / 2 + 0.92);
    k.box(1.1 * S, 0.06, 0.6, theme.accentHex, dx, 0.87 + 1.2 * S, -D * 0.08 + wd / 2 + 0.3);
  }
  // pallet racks + forklift
  const rx = ww / 2 + 0.2;
  for (let lvl = 0; lvl < 3; lvl++) {
    k.slab(0.1, 0.04, 1.6 * S, '#f97316', rx, 0.5 + lvl * 0.55 * S, 0);
    for (let b = 0; b < 3; b++) k.slab(0.36, 0.34 * S, 0.4 * S, '#c08a4f', rx, 0.54 + lvl * 0.55 * S, -0.5 * S + b * 0.5 * S);
  }
  for (const z of [-0.8 * S, 0.8 * S]) k.box(0.06, 1.7 * S, 0.06, '#1d4ed8', rx, 0.5 + 0.85 * S, z);
  const fx = -ww / 2 + 0.6;
  const fz = -D * 0.08 + wd / 2 + 1.5;
  k.slab(0.5 * S, 0.4 * S, 0.8 * S, '#facc15', fx, 0.5, fz);
  k.slab(0.42 * S, 0.04, 0.5 * S, '#1f2937', fx, 0.5 + 0.9 * S, fz + 0.05);
  for (const cx of [-1, 1]) k.box(0.04, 0.9 * S, 0.04, '#1f2937', fx + cx * 0.2 * S, 0.5 + 0.45 * S + 0.4 * S, fz - 0.22 * S);
  for (const cx of [-1, 1]) k.box(0.05, 0.03, 0.6 * S, '#9ca3af', fx + cx * 0.12 * S, 0.53, fz - 0.6 * S);
  k.sign((prop.label ?? 'DEPOT').split('(')[0].trim().toUpperCase(), '#0c4a6e', '#fde68a', ww * 0.55, 0.32 * S, 0, 0.5 + wh - 0.25, -D * 0.08 + wd / 2 + 0.03);
};

function canvasStripe(): THREE.Texture {
  return windowTextureLike();
}

function windowTextureLike(): THREE.Texture {
  // Corrugated vertical metal stripes (reuses canvas cache under a unique key)
  return stripeTexture('#e2e8f0', '#94a3b8');
}

import { canvasTexture } from './meshKit';
function stripeTexture(a: string, b: string): THREE.Texture {
  return canvasTexture(`stripe|${a}|${b}`, 32, 8, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, a);
    g.addColorStop(0.5, b);
    g.addColorStop(1, a);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

const truckYard: Builder = (k, W, D, S, prop, theme) => {
  k.slab(W * 0.96, 0.06, D * 0.9, '#6b7280', 0, 0.42, 0);
  for (let i = 0; i < 4; i++) k.box(0.06, 0.01, D * 0.7, '#f8fafc', -W * 0.36 + i * W * 0.24, 0.49, 0);
  // dock canopy
  k.slab(W * 0.9, 0.1, 1.0, theme.accentHex, 0, 0.48 + 2.0 * S, -D * 0.36);
  for (let i = 0; i < 4; i++) k.cyl(0.05, 0.05, 2.0 * S, 8, '#cbd5e1', -W * 0.42 + i * W * 0.28, 0.48, -D * 0.36 + 0.4);
  // two delivery trucks with brand stripes
  for (let t = 0; t < 2; t++) {
    const tx = -W * 0.24 + t * W * 0.48;
    const g = k.group('', tx, 0.48, D * 0.05);
    g.slab(0.95 * S, 1.0 * S, 2.1 * S, '#f8fafc', 0, 0.3 * S, -0.3 * S);
    g.box(0.97 * S, 0.18 * S, 2.12 * S, theme.accentHex, 0, 0.3 * S + 0.55 * S, -0.3 * S);
    g.box(0.97 * S, 0.06 * S, 2.12 * S, '#0ea5e9', 0, 0.3 * S + 0.38 * S, -0.3 * S);
    g.slab(0.9 * S, 0.75 * S, 0.7 * S, t ? '#0284c7' : '#f59e0b', 0, 0.3 * S, 1.05 * S);
    g.box(0.8 * S, 0.3 * S, 0.02, stdMat('#1e293b', { metal: 0.6, rough: 0.1 }), 0, 0.3 * S + 0.55 * S, 1.41 * S);
    g.slab(0.92 * S, 0.12 * S, 0.1 * S, '#334155', 0, 0.22 * S, 1.42 * S);
    for (const hx of [-1, 1]) g.box(0.12 * S, 0.08 * S, 0.02, glowMat('#fef9c3', 1.2), hx * 0.32 * S, 0.42 * S, 1.42 * S);
    for (const wz of [1.05 * S, -0.2 * S, -1.0 * S]) {
      for (const wx of [-1, 1]) {
        const wheel = g.cyl(0.2 * S, 0.2 * S, 0.14 * S, 12, '#111827', wx * 0.47 * S, 0, wz);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.y = 0.2 * S;
      }
    }
  }
  // pallets, cones and bollards
  for (let p = 0; p < 3; p++) {
    k.slab(0.6 * S, 0.1, 0.6 * S, '#a16207', W * 0.4, 0.48 + p * 0.45 * S, D * 0.32);
    k.slab(0.5 * S, 0.33 * S, 0.5 * S, '#c08a4f', W * 0.4, 0.58 + p * 0.45 * S, D * 0.32);
  }
  for (let c = 0; c < 4; c++) k.cone(0.1, 0.3, 8, '#f97316', -W * 0.42 + c * 0.35, 0.48, D * 0.42);
  void prop;
};

// ---------------------------------------------------------------------------
// Registry + entry point
// ---------------------------------------------------------------------------

const BUILDERS: Partial<Record<WorldProp['kind'], Builder>> = {
  bagan_stupa: (k, W, D, S, prop, theme) =>
    /Temple|Ananda/i.test(prop.label ?? '') ? baganTemple(k, W, D, S, prop, theme) : baganStupa(k, W, D, S, prop, theme),
  bagan_balloon: baganBalloon,
  shwedagon_spire: shwedagon,
  shopping_mall: shoppingMall,
  supermarket_shelf: marketHall,
  pos_counter: posCounter,
  mandalay_moat_tower: mandalayMoatTower,
  ubein_bridge: ubeinBridge,
  bakery_oven: bakeryKitchen,
  cafe_table: cafePatio,
  shan_terrace_farm: shanTerraces,
  crop_plot: inleFloatingGarden,
  factory_vat: factoryPlant,
  putao_snow_peak: putaoPeaks,
  server_rack: serverPod,
  data_node: myeikIsland,
  mawlamyaing_ridge_tower: ridgeTower,
  blueprint_table: salesGallery,
  crane_pillar: towerCrane,
  dawei_port_crane: daweiPortCrane,
  warehouse_rack: warehouseDepot,
  delivery_truck: truckYard,
};

/** Kinds that sit in water or the sky and therefore get no stone plinth. */
const NO_PLINTH = new Set<WorldProp['kind']>(['ubein_bridge', 'crop_plot', 'data_node', 'bagan_balloon']);

export function buildDetailedLandmark(prop: WorldProp, theme: WorldTheme, W: number, D: number): THREE.Group {
  const root = new THREE.Group();
  const k = new Kit(root);
  const S = Math.min(1.7, Math.max(0.9, Math.min(W, D) / 5.2));

  if (!NO_PLINTH.has(prop.kind)) {
    const stone = stdMat('#57534e', { rough: 0.8 });
    const trim = stdMat('#a8a29e', { rough: 0.7 });
    k.slab(W + 0.3, 0.22, D + 0.3, stone, 0, 0, 0);
    k.slab(W, 0.2, D, trim, 0, 0.22, 0);
  }

  const builder = BUILDERS[prop.kind];
  if (builder) {
    builder(k, W, D, S, prop, theme);
  } else {
    k.cyl(W * 0.3, W * 0.36, 2.4 * S, 18, stdMat(theme.primaryHex, { rough: 0.4 }), 0, 0.42, 0);
    k.sphere(W * 0.18, glowMat(theme.accentHex, 0.8), 0, 0.42 + 2.6 * S, 0);
  }

  mergeStaticMeshesSafe(root);
  return root;
}

import { mergeStaticMeshes } from './meshKit';
function mergeStaticMeshesSafe(root: THREE.Object3D): void {
  try {
    mergeStaticMeshes(root);
  } catch (err) {
    console.warn('[CHL Realm] Landmark merge skipped:', err);
  }
}
