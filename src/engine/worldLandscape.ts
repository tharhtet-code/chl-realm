import * as THREE from 'three';
import type {
  ColleaguePresence,
  PlayerState,
  QuestDefinition,
  WorldPortal,
  WorldTheme,
} from '../types/game';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../worlds/worldDefinitions';
import { MAP_SCALE, mapToWorld3D } from './fantasy3DModels';
import {
  Kit,
  fbm2D,
  glowMat,
  hashString,
  jitterGeometry,
  mergeStaticMeshes,
  mulberry32,
  smoothstep,
  stdMat,
} from './meshKit';

export type RoadStyle =
  | 'causeway'
  | 'sand_trail'
  | 'asphalt'
  | 'royal_brick'
  | 'boardwalk'
  | 'farm_track'
  | 'factory_road'
  | 'neon_circuit'
  | 'boulevard'
  | 'highway';

export interface RoadPolyline {
  points: Array<[number, number]>; // map coordinates [0..WORLD_WIDTH, 0..WORLD_HEIGHT]
  width: number; // map units
  style: RoadStyle;
  label?: string;
}

export interface PlazaZone {
  x: number;
  y: number;
  rx: number;
  ry: number;
  style: 'gold_stone' | 'modern_tile' | 'royal_courtyard' | 'cyber_deck' | 'asphalt_apron';
}

export interface WaterZone {
  x: number;
  y: number;
  rx: number;
  ry: number;
  shape: 'ellipse' | 'rect';
  color: string;
  label?: string;
}

export interface WorldMapPlan {
  roads: RoadPolyline[];
  plazas: PlazaZone[];
  waters: WaterZone[];
  northShoreWater: boolean;
  northShoreLabel?: string;
}

interface StyleColors {
  fill: string;
  border: string;
  centerLine?: string;
  dashed?: boolean;
}

export const ROAD_STYLE_COLORS: Record<RoadStyle, StyleColors> = {
  causeway: { fill: '#b4532a', border: '#fde68a', centerLine: '#f59e0b', dashed: false },
  sand_trail: { fill: '#d6a86e', border: '#92400e' },
  asphalt: { fill: '#334155', border: '#cbd5e1', centerLine: '#f8fafc', dashed: true },
  royal_brick: { fill: '#991b1b', border: '#facc15', centerLine: '#fde68a', dashed: false },
  boardwalk: { fill: '#925c2e', border: '#5b3a1e' },
  farm_track: { fill: '#a1622f', border: '#65a30d' },
  factory_road: { fill: '#475569', border: '#facc15', centerLine: '#facc15', dashed: true },
  neon_circuit: { fill: '#064e3b', border: '#34d399', centerLine: '#22d3ee', dashed: true },
  boulevard: { fill: '#3b4c6b', border: '#e2e8f0', centerLine: '#93c5fd', dashed: true },
  highway: { fill: '#1f2937', border: '#f59e0b', centerLine: '#facc15', dashed: true },
};

/**
 * Computes the deterministic cartographic road, trail, plaza, and water layout
 * for a 2x World Map (1520 x 880). Shared by both the 3D Landscape Builder and
 * the 2D HUD Mini-Map so roads & landmarks match 1:1.
 */
export function computeWorldMapPlan(
  theme: WorldTheme,
  quests: QuestDefinition[]
): WorldMapPlan {
  const roads: RoadPolyline[] = [];
  const plazas: PlazaZone[] = [];
  const waters: WaterZone[] = [];
  let northShoreWater = false;
  let northShoreLabel: string | undefined;

  const cx = WORLD_WIDTH / 2; // 760
  const [sx, sy] = theme.spawnsAt;

  switch (theme.landscapeType) {
    case 'bagan_plains': {
      northShoreWater = true;
      northShoreLabel = 'Irrawaddy River';
      // Sacred lotus ponds in the Bagan plains
      waters.push(
        { x: 240, y: 560, rx: 85, ry: 48, shape: 'ellipse', color: '#0284c7', label: 'Lotus Pond' },
        { x: 1290, y: 300, rx: 78, ry: 45, shape: 'ellipse', color: '#0284c7', label: 'Sacred Tank' }
      );
      plazas.push(
        { x: cx, y: 460, rx: 105, ry: 82, style: 'gold_stone' },
        { x: cx, y: 290, rx: 62, ry: 46, style: 'gold_stone' }
      );
      // Grand Royal Brick Causeways to the 6 Sector Portals & East-West Axis
      roads.push(
        { points: [[cx, 130], [cx, 460], [cx, 760]], width: 40, style: 'causeway', label: 'Ananda Royal Causeway' },
        { points: [[150, 460], [430, 460], [cx, 460], [1090, 460], [1370, 460]], width: 36, style: 'causeway', label: 'Bagan East-West Way' },
        { points: [[260, 170], [460, 310], [cx, 460]], width: 32, style: 'causeway' },
        { points: [[1260, 170], [1060, 310], [cx, 460]], width: 32, style: 'causeway' },
        { points: [[260, 730], [490, 620], [cx, 460]], width: 32, style: 'causeway' },
        { points: [[1260, 730], [1040, 620], [cx, 460]], width: 32, style: 'causeway' },
        // Outer Sandy Ox-Cart & Pilgrim Trails
        { points: [[260, 170], [532, 240], [760, 260], [992, 240], [1260, 170]], width: 24, style: 'sand_trail', label: 'Pagoda Pilgrim Trail' },
        { points: [[260, 730], [585, 720], [760, 760], [980, 720], [1260, 730]], width: 24, style: 'sand_trail' },
        { points: [[260, 170], [185, 340], [180, 460], [210, 620], [260, 730]], width: 22, style: 'sand_trail' },
        { points: [[1260, 170], [1340, 340], [1330, 440], [1310, 610], [1260, 730]], width: 22, style: 'sand_trail' }
      );
      break;
    }

    case 'yangon_shopping_center': {
      // Kandawgyi Royal Lake on the northwest & east park pockets
      waters.push(
        { x: 225, y: 205, rx: 120, ry: 68, shape: 'ellipse', color: '#0284c7', label: 'Kandawgyi Lake' },
        { x: 1350, y: 380, rx: 85, ry: 56, shape: 'ellipse', color: '#0369a1', label: 'Inya Park Pond' }
      );
      plazas.push(
        { x: cx, y: 470, rx: 98, ry: 74, style: 'modern_tile' },
        { x: cx, y: 240, rx: 72, ry: 52, style: 'gold_stone' },
        { x: sx, y: sy, rx: 68, ry: 52, style: 'modern_tile' }
      );
      roads.push(
        { points: [[cx, 780], [cx, 650], [cx, 470], [cx, 250]], width: 42, style: 'asphalt', label: 'Shwedagon Pagoda Rd' },
        { points: [[180, 470], [420, 470], [cx, 470], [1090, 470], [1350, 470]], width: 40, style: 'asphalt', label: 'Pyay Shopping Ave' },
        { points: [[280, 310], [490, 310], [cx, 310], [1030, 310], [1280, 310]], width: 32, style: 'asphalt', label: 'Kabar Aye Blvd' },
        { points: [[280, 650], [550, 650], [cx, 650], [1080, 650], [1295, 650]], width: 32, style: 'asphalt' },
        { points: [[280, 310], [280, 470], [280, 650]], width: 30, style: 'asphalt' },
        { points: [[1280, 310], [1280, 470], [1280, 650]], width: 30, style: 'asphalt' },
        { points: [[140, 210], [225, 205], [320, 250], [420, 310]], width: 22, style: 'boardwalk', label: 'Kandawgyi Teak Walk' }
      );
      break;
    }

    case 'mandalay_moat_kitchens': {
      northShoreWater = true;
      northShoreLabel = 'Mandalay Royal Moat';
      // Taungthaman Lake beneath U Bein Teak Bridge
      waters.push(
        { x: 370, y: 232, rx: 145, ry: 58, shape: 'ellipse', color: '#0e7490', label: 'Taungthaman Lake' },
        { x: 762, y: 155, rx: 185, ry: 42, shape: 'rect', color: '#0369a1', label: 'Palace South Moat' }
      );
      plazas.push(
        { x: cx, y: 470, rx: 92, ry: 70, style: 'royal_courtyard' },
        { x: sx, y: sy, rx: 66, ry: 50, style: 'royal_courtyard' }
      );
      // Orthogonal Mandalay Royal Grid + Teak Boardwalks
      roads.push(
        { points: [[cx, 780], [cx, 610], [cx, 470], [cx, 240]], width: 40, style: 'royal_brick', label: '26th Royal Moat Rd' },
        { points: [[190, 470], [450, 470], [cx, 470], [1080, 470], [1340, 470]], width: 38, style: 'royal_brick', label: '78th Culinary Blvd' },
        { points: [[220, 610], [450, 610], [cx, 610], [1080, 610], [1310, 610]], width: 30, style: 'asphalt' },
        { points: [[450, 320], [cx, 320], [1160, 320], [1310, 320]], width: 30, style: 'royal_brick' },
        { points: [[450, 320], [450, 470], [450, 610]], width: 28, style: 'royal_brick' },
        { points: [[1080, 320], [1080, 470], [1080, 690]], width: 28, style: 'royal_brick' },
        { points: [[260, 232], [370, 232], [470, 290]], width: 24, style: 'boardwalk', label: 'U Bein Pier Walk' },
        { points: [[220, 610], [330, 540], [450, 470]], width: 22, style: 'boardwalk' }
      );
      break;
    }

    case 'taunggyi_farms_factory': {
      // Inle Lake basin in SW + weaving pond in N + central irrigation stream
      waters.push(
        { x: 375, y: 595, rx: 145, ry: 72, shape: 'ellipse', color: '#0e7490', label: 'Inle Floating Lake' },
        { x: 590, y: 212, rx: 95, ry: 48, shape: 'ellipse', color: '#0284c7', label: 'Lotus Pond' },
        { x: 700, y: 440, rx: 22, ry: 310, shape: 'rect', color: '#0284c7', label: 'Shan Canal' }
      );
      plazas.push(
        { x: cx, y: 470, rx: 85, ry: 66, style: 'modern_tile' },
        { x: 1060, y: 430, rx: 95, ry: 72, style: 'asphalt_apron' }
      );
      // West: Shan Dirt Trails & Inle Boardwalks -> Central Canal Bridge -> East: Concrete Factory Roads
      roads.push(
        { points: [[180, 450], [430, 460], [700, 460], [cx, 460]], width: 30, style: 'farm_track', label: 'Shan Harvest Trail' },
        { points: [[310, 260], [430, 340], [430, 460], [520, 560], [cx, 650]], width: 26, style: 'farm_track' },
        { points: [[220, 320], [310, 260], [480, 220], [660, 280]], width: 22, style: 'farm_track' },
        { points: [[245, 595], [380, 620], [510, 595]], width: 22, style: 'boardwalk', label: 'Inle Stilt Walk' },
        // East industrial concrete roads
        { points: [[cx, 780], [cx, 650], [cx, 460], [cx, 300]], width: 38, style: 'factory_road', label: 'ISO Plant Corridor' },
        { points: [[cx, 460], [1060, 460], [1340, 460]], width: 38, style: 'factory_road' },
        { points: [[880, 280], [1020, 280], [1310, 250]], width: 30, style: 'factory_road' },
        { points: [[1060, 280], [1060, 460], [1060, 660], [1240, 720]], width: 32, style: 'factory_road' },
        { points: [[cx, 650], [1060, 650], [1280, 560]], width: 28, style: 'factory_road' }
      );
      break;
    }

    case 'putao_myeik_incubator': {
      // Myeik Andaman Lagoon islands in SW and SE
      waters.push(
        { x: 365, y: 455, rx: 165, ry: 175, shape: 'ellipse', color: '#0891b2', label: 'Myeik West Lagoon' },
        { x: 1190, y: 655, rx: 135, ry: 95, shape: 'ellipse', color: '#0891b2', label: 'Lampi Coral Bay' }
      );
      plazas.push(
        { x: cx, y: 430, rx: 96, ry: 74, style: 'cyber_deck' },
        { x: sx, y: sy, rx: 68, ry: 52, style: 'cyber_deck' }
      );
      roads.push(
        { points: [[cx, 780], [cx, 650], [cx, 430], [cx, 235]], width: 38, style: 'neon_circuit', label: 'Putao-Myeik Fiber Spine' },
        { points: [[520, 430], [cx, 430], [1080, 430], [1340, 430]], width: 36, style: 'neon_circuit', label: 'Quantum Bus Way' },
        { points: [[760, 290], [965, 330], [1185, 330], [1310, 240]], width: 30, style: 'neon_circuit' },
        { points: [[200, 680], [480, 650], [cx, 650], [1040, 650]], width: 28, style: 'neon_circuit' },
        // Over-water island boardwalks
        { points: [[230, 210], [350, 345], [520, 430]], width: 24, style: 'boardwalk', label: 'Pearl Island Sky-Bridge' },
        { points: [[350, 345], [390, 575], [540, 640]], width: 24, style: 'boardwalk' },
        { points: [[1040, 650], [1190, 655], [1320, 560]], width: 24, style: 'boardwalk' }
      );
      break;
    }

    case 'mawlamyaing_skyline': {
      northShoreWater = true;
      northShoreLabel = 'Thanlwin (Salween) River';
      waters.push(
        { x: cx, y: 470, rx: 42, ry: 42, shape: 'ellipse', color: '#38bdf8', label: 'Atrium Fountain' }
      );
      plazas.push(
        { x: cx, y: 470, rx: 108, ry: 86, style: 'modern_tile' },
        { x: sx, y: sy, rx: 68, ry: 52, style: 'modern_tile' }
      );
      roads.push(
        { points: [[160, 285], [440, 285], [cx, 285], [1090, 285], [1360, 285]], width: 38, style: 'boulevard', label: 'Strand Waterfront Pkwy' },
        { points: [[cx, 780], [cx, 650], [cx, 470], [cx, 240]], width: 42, style: 'boulevard', label: 'Mawlamyaing Ridge Ave' },
        { points: [[180, 470], [440, 470], [cx, 470], [1080, 470], [1340, 470]], width: 38, style: 'boulevard', label: 'City Properties Blvd' },
        { points: [[240, 635], [440, 635], [cx, 635], [1080, 635], [1280, 635]], width: 32, style: 'boulevard' },
        { points: [[310, 285], [310, 470], [310, 635]], width: 28, style: 'boulevard' },
        { points: [[1210, 285], [1210, 470], [1210, 635]], width: 28, style: 'boulevard' }
      );
      break;
    }

    case 'dawei_warehouse_port': {
      northShoreWater = true;
      northShoreLabel = 'Andaman Deep-Sea Port';
      plazas.push(
        { x: cx, y: 455, rx: 98, ry: 72, style: 'asphalt_apron' },
        { x: 480, y: 380, rx: 85, ry: 68, style: 'asphalt_apron' },
        { x: 1060, y: 440, rx: 92, ry: 72, style: 'asphalt_apron' }
      );
      roads.push(
        { points: [[180, 225], [520, 225], [cx, 225], [1090, 225], [1360, 225]], width: 42, style: 'highway', label: 'Dawei Port Quay Apron' },
        { points: [[cx, 780], [cx, 640], [cx, 455], [cx, 225]], width: 44, style: 'highway', label: 'Pahtama Port Expy' },
        { points: [[180, 455], [480, 455], [cx, 455], [1060, 455], [1360, 455]], width: 42, style: 'highway', label: 'National Logistics Hwy 8' },
        { points: [[220, 640], [520, 640], [cx, 640], [1020, 640], [1330, 640]], width: 36, style: 'highway' },
        { points: [[510, 225], [510, 455], [510, 640]], width: 34, style: 'highway' },
        { points: [[1090, 225], [1090, 455], [1090, 640]], width: 34, style: 'highway' }
      );
      break;
    }
  }

  // Ensure every Portal, NPC, Quest Spot & Treasure Chest connects smoothly via a spur trail
  const secondaryStyle: RoadStyle =
    theme.landscapeType === 'bagan_plains'
      ? 'sand_trail'
      : theme.landscapeType === 'dawei_warehouse_port'
        ? 'highway'
        : theme.landscapeType === 'putao_myeik_incubator'
          ? 'neon_circuit'
          : theme.landscapeType === 'taunggyi_farms_factory'
            ? 'farm_track'
            : theme.landscapeType === 'mandalay_moat_kitchens'
              ? 'royal_brick'
              : theme.landscapeType === 'mawlamyaing_skyline'
                ? 'boulevard'
                : 'asphalt';

  const targets: Array<[number, number]> = [
    ...theme.portals.map((p): [number, number] => [p.x, p.y]),
    ...theme.npcs.map((n): [number, number] => [n.x, n.y]),
    ...quests.map((q): [number, number] => [q.spawn_location[0], q.spawn_location[1]]),
    ...theme.chests.map((c): [number, number] => [c.x, c.y]),
  ];

  for (const [tx, ty] of targets) {
    const nearest = nearestPointOnRoads(tx, ty, roads);
    if (nearest.dist > 34 && nearest.dist < 280) {
      const style: RoadStyle = isInsideWater(tx, ty, waters) ? 'boardwalk' : secondaryStyle;
      roads.push({
        points: [
          [nearest.x, nearest.y],
          [tx, ty],
        ],
        width: 20,
        style,
      });
    }
  }

  return { roads, plazas, waters, northShoreWater, northShoreLabel };
}

function nearestPointOnRoads(
  px: number,
  py: number,
  roads: RoadPolyline[]
): { x: number; y: number; dist: number; halfWidth: number } {
  let bestX = px;
  let bestY = py;
  let bestDist = Infinity;
  let bestHalf = 16;

  for (const r of roads) {
    for (let i = 0; i < r.points.length - 1; i++) {
      const [ax, ay] = r.points[i];
      const [bx, by] = r.points[i + 1];
      const vx = bx - ax;
      const vy = by - ay;
      const len2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2));
      const qx = ax + vx * t;
      const qy = ay + vy * t;
      const d = Math.hypot(px - qx, py - qy);
      if (d < bestDist) {
        bestDist = d;
        bestX = qx;
        bestY = qy;
        bestHalf = r.width / 2;
      }
    }
  }
  return { x: bestX, y: bestY, dist: bestDist, halfWidth: bestHalf };
}

function isInsideWater(mx: number, my: number, waters: WaterZone[], margin = 0): boolean {
  for (const w of waters) {
    if (w.shape === 'rect') {
      if (Math.abs(mx - w.x) <= w.rx + margin && Math.abs(my - w.y) <= w.ry + margin) return true;
    } else {
      const nx = (mx - w.x) / (w.rx + margin);
      const ny = (my - w.y) / (w.ry + margin);
      if (nx * nx + ny * ny <= 1) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Painted 2D Cartographic Ground Texture for the 2x 3D Terrain
// ---------------------------------------------------------------------------

function buildTerrainMapTexture(theme: WorldTheme, plan: WorldMapPlan): THREE.CanvasTexture {
  const cw = 2048;
  const ch = 1186; // matches 1520:880 aspect ratio
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;

  const sx = cw / WORLD_WIDTH;
  const sy = ch / WORLD_HEIGHT;

  // 1. Biome Base Gradient & Natural Patchwork
  const baseGrad = ctx.createLinearGradient(0, 0, cw, ch);
  switch (theme.landscapeType) {
    case 'bagan_plains':
      baseGrad.addColorStop(0, '#6c3b1c');
      baseGrad.addColorStop(0.5, '#7c4622');
      baseGrad.addColorStop(1, '#582f14');
      break;
    case 'yangon_shopping_center':
      baseGrad.addColorStop(0, '#1f4d36');
      baseGrad.addColorStop(0.5, '#2b224f');
      baseGrad.addColorStop(1, '#233b2e');
      break;
    case 'mandalay_moat_kitchens':
      baseGrad.addColorStop(0, '#4f1d1d');
      baseGrad.addColorStop(0.55, '#5c261c');
      baseGrad.addColorStop(1, '#3b1812');
      break;
    case 'taunggyi_farms_factory': {
      // West = lush Shan green terraces; East = industrial slate yard
      const splitGrad = ctx.createLinearGradient(0, 0, cw, 0);
      splitGrad.addColorStop(0, '#1e5631');
      splitGrad.addColorStop(0.45, '#276738');
      splitGrad.addColorStop(0.52, '#334155');
      splitGrad.addColorStop(1, '#273449');
      ctx.fillStyle = splitGrad;
      ctx.fillRect(0, 0, cw, ch);
      break;
    }
    case 'putao_myeik_incubator': {
      // North = frosty alpine slate/snow; Center = dark emerald tech grid; South = sandy turquoise island rim
      const nsGrad = ctx.createLinearGradient(0, 0, 0, ch);
      nsGrad.addColorStop(0, '#cbd5e1');
      nsGrad.addColorStop(0.24, '#0f3d36');
      nsGrad.addColorStop(0.74, '#063730');
      nsGrad.addColorStop(1, '#134e4a');
      ctx.fillStyle = nsGrad;
      ctx.fillRect(0, 0, cw, ch);
      break;
    }
    case 'mawlamyaing_skyline':
      baseGrad.addColorStop(0, '#1e3a5f');
      baseGrad.addColorStop(0.5, '#244b3c');
      baseGrad.addColorStop(1, '#1e3557');
      break;
    case 'dawei_warehouse_port': {
      const portGrad = ctx.createLinearGradient(0, 0, 0, ch);
      portGrad.addColorStop(0, '#475569');
      portGrad.addColorStop(0.35, '#3b4656');
      portGrad.addColorStop(0.75, '#574631');
      portGrad.addColorStop(1, '#4b5835');
      ctx.fillStyle = portGrad;
      ctx.fillRect(0, 0, cw, ch);
      break;
    }
  }

  if (
    theme.landscapeType !== 'taunggyi_farms_factory' &&
    theme.landscapeType !== 'putao_myeik_incubator' &&
    theme.landscapeType !== 'dawei_warehouse_port'
  ) {
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, cw, ch);
  }

  // 2. Organic Soil / Grass / Sand / Snow Dappled Texture Patches
  const rng = mulberry32(hashString(theme.id) + 101);
  for (let i = 0; i < 420; i++) {
    const px = rng() * cw;
    const py = rng() * ch;
    const rx = 18 + rng() * 68;
    const ry = 14 + rng() * 48;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rng() * Math.PI);
    ctx.fillStyle =
      rng() > 0.5 ? 'rgba(255, 255, 255, 0.045)' : 'rgba(0, 0, 0, 0.07)';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Subtle cartographic contour rings & grid lines (World Map feel)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1.5;
  for (let gx = 0; gx < cw; gx += 128) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, ch);
    ctx.stroke();
  }
  for (let gy = 0; gy < ch; gy += 128) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(cw, gy);
    ctx.stroke();
  }

  // Farm field stripes in Western Taunggyi
  if (theme.landscapeType === 'taunggyi_farms_factory') {
    for (let fy = 90; fy < ch - 90; fy += 22) {
      ctx.fillStyle = fy % 44 === 0 ? 'rgba(132, 204, 22, 0.14)' : 'rgba(21, 128, 61, 0.14)';
      ctx.fillRect(40, fy, cw * 0.42, 10);
    }
  }

  // Container yard bay markings in Dawei
  if (theme.landscapeType === 'dawei_warehouse_port') {
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.24)';
    ctx.lineWidth = 2;
    for (let bx = 180; bx < cw - 180; bx += 120) {
      ctx.strokeRect(bx, 60, 90, 155);
    }
  }

  // 3. Interior Water Bodies with Sandy / Stone Shoreline Halos
  for (const w of plan.waters) {
    const wx = w.x * sx;
    const wy = w.y * sy;
    const wrx = w.rx * sx;
    const wry = w.ry * sy;

    ctx.save();
    if (w.shape === 'rect') {
      ctx.fillStyle = '#d6b77a';
      ctx.fillRect(wx - wrx - 10, wy - wry - 10, (wrx + 10) * 2, (wry + 10) * 2);
      ctx.fillStyle = w.color;
      ctx.fillRect(wx - wrx, wy - wry, wrx * 2, wry * 2);
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.55)';
      ctx.lineWidth = 4;
      ctx.strokeRect(wx - wrx + 5, wy - wry + 5, wrx * 2 - 10, wry * 2 - 10);
    } else {
      ctx.fillStyle = '#e7cda0';
      ctx.beginPath();
      ctx.ellipse(wx, wy, wrx + 12, wry + 12, 0, 0, Math.PI * 2);
      ctx.fill();

      const wGrad = ctx.createRadialGradient(wx, wy, 6, wx, wy, Math.max(wrx, wry));
      wGrad.addColorStop(0, '#38bdf8');
      wGrad.addColorStop(0.65, w.color);
      wGrad.addColorStop(1, '#0c4a6e');
      ctx.fillStyle = wGrad;
      ctx.beginPath();
      ctx.ellipse(wx, wy, wrx, wry, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(224, 242, 254, 0.55)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.ellipse(wx, wy, wrx * 0.88, wry * 0.88, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 4. Plazas & Courtyards
  for (const p of plan.plazas) {
    const px = p.x * sx;
    const py = p.y * sy;
    const prx = p.rx * sx;
    const pry = p.ry * sy;
    const palette =
      p.style === 'gold_stone'
        ? { outer: '#facc15', fill: '#92400e', inner: '#fde68a' }
        : p.style === 'royal_courtyard'
          ? { outer: '#facc15', fill: '#7f1d1d', inner: '#fca5a5' }
          : p.style === 'cyber_deck'
            ? { outer: '#34d399', fill: '#064e3b', inner: '#22d3ee' }
            : p.style === 'asphalt_apron'
              ? { outer: '#f59e0b', fill: '#334155', inner: '#94a3b8' }
              : { outer: '#e2e8f0', fill: '#475569', inner: '#93c5fd' };

    ctx.fillStyle = palette.outer;
    ctx.beginPath();
    ctx.ellipse(px, py, prx + 8, pry + 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.fill;
    ctx.beginPath();
    ctx.ellipse(px, py, prx, pry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = palette.inner;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(px, py, prx * 0.72, pry * 0.72, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(px, py, prx * 0.36, pry * 0.36, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 5. Roads & Trails (Border Pass -> Surface Pass -> Lane/Plank Markings Pass)
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const strokePoly = (pts: Array<[number, number]>) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x * sx, y * sy);
      else ctx.lineTo(x * sx, y * sy);
    });
    ctx.stroke();
  };

  for (const r of plan.roads) {
    const sc = ROAD_STYLE_COLORS[r.style];
    ctx.strokeStyle = sc.border;
    ctx.lineWidth = (r.width + 7) * sx;
    ctx.setLineDash([]);
    strokePoly(r.points);
  }

  for (const r of plan.roads) {
    const sc = ROAD_STYLE_COLORS[r.style];
    ctx.strokeStyle = sc.fill;
    ctx.lineWidth = r.width * sx;
    ctx.setLineDash([]);
    strokePoly(r.points);
  }

  for (const r of plan.roads) {
    const sc = ROAD_STYLE_COLORS[r.style];
    if (r.style === 'boardwalk') {
      ctx.strokeStyle = '#5b3a1e';
      ctx.lineWidth = r.width * 0.88 * sx;
      ctx.setLineDash([4, 9]);
      strokePoly(r.points);
    } else if (sc.centerLine) {
      ctx.strokeStyle = sc.centerLine;
      ctx.lineWidth = Math.max(2.5, r.width * 0.08 * sx);
      ctx.setLineDash(sc.dashed ? [18, 16] : []);
      strokePoly(r.points);
    }
  }
  ctx.setLineDash([]);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// 3D Environmental Landscaping Builder (Terrain + Roads + Bridges + Scenery)
// ---------------------------------------------------------------------------

export function buildWorldLandscape(
  theme: WorldTheme,
  quests: QuestDefinition[]
): { group: THREE.Group; groundMesh: THREE.Mesh; plan: WorldMapPlan } {
  const group = new THREE.Group();
  const plan = computeWorldMapPlan(theme, quests);

  const islandW = WORLD_WIDTH * MAP_SCALE; // 121.6
  const islandD = WORLD_HEIGHT * MAP_SCALE; // 70.4

  // 1. Sculpted 2x Terrain Mesh with Gentle Perimeter Relief + Painted Map Texture
  const segX = 96;
  const segZ = 56;
  const topGeo = new THREE.PlaneGeometry(islandW, islandD, segX, segZ);
  topGeo.rotateX(-Math.PI / 2);
  const pos = topGeo.getAttribute('position') as THREE.BufferAttribute;
  const seed = hashString(theme.id);

  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i);
    const wz = pos.getZ(i);
    const mx = wx / MAP_SCALE + WORLD_WIDTH / 2;
    const my = wz / MAP_SCALE + WORLD_HEIGHT / 2;

    // Keep playable roads, plazas, and landmark pads flat; add gentle organic relief on outer wilds
    const roadDist = nearestPointOnRoads(mx, my, plan.roads).dist;
    const edgeFactor = Math.max(
      smoothstep(0.36, 0.5, Math.abs(wx) / islandW),
      smoothstep(0.36, 0.5, Math.abs(wz) / islandD)
    );
    const roadMask = smoothstep(24, 95, roadDist);
    const waterDepress = isInsideWater(mx, my, plan.waters, 4) ? -0.18 : 0;
    const hill =
      (fbm2D(wx * 0.06, wz * 0.06, seed, 3) - 0.35) *
      (0.35 * roadMask + 1.15 * edgeFactor);

    pos.setY(i, waterDepress + Math.max(-0.08, hill * (waterDepress < 0 ? 0 : 1)));
  }
  topGeo.computeVertexNormals();

  const mapTex = buildTerrainMapTexture(theme, plan);
  const groundMat = new THREE.MeshStandardMaterial({
    map: mapTex,
    roughness: 0.78,
    metalness: 0.06,
  });
  const groundMesh = new THREE.Mesh(topGeo, groundMat);
  groundMesh.receiveShadow = false;
  group.add(groundMesh);

  // Cliff Pedestal Skirt beneath the 2x Island
  const cliffBase = new THREE.Mesh(
    new THREE.BoxGeometry(islandW + 0.6, 2.8, islandD + 0.6, 4, 1, 4),
    stdMat(theme.floorHexA, { rough: 0.88 })
  );
  cliffBase.position.y = -1.48;
  group.add(cliffBase);

  // 2. Translucent Shimmering 3D Water Surfaces (Interior Lakes/Canals + Northern River/Sea)
  const waterMat = stdMat('#0284c7', {
    emissive: '#0369a1',
    glow: 0.28,
    rough: 0.14,
    metal: 0.45,
    opacity: 0.88,
  });

  for (const w of plan.waters) {
    const { wx, wz } = mapToWorld3D(w.x, w.y);
    const rx3 = w.rx * MAP_SCALE;
    const rz3 = w.ry * MAP_SCALE;
    const geo =
      w.shape === 'rect'
        ? new THREE.PlaneGeometry(rx3 * 2, rz3 * 2).rotateX(-Math.PI / 2)
        : new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2).scale(rx3, 1, rz3);
    const m = new THREE.Mesh(geo, waterMat);
    m.position.set(wx, -0.02, wz);
    group.add(m);
  }

  if (plan.northShoreWater) {
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(islandW + 36, 22, 8, 2).rotateX(-Math.PI / 2),
      waterMat
    );
    sea.position.set(0, -0.15, -islandD / 2 - 10.5);
    group.add(sea);
  }

  // 3. Static Scenery Container (Curbs, Bridges, Streetlamps, Signs, Trees, Rocks, Boats)
  const sceneryRoot = new THREE.Group();
  const k = new Kit(sceneryRoot);

  // 3a. Raised 3D Road Curbs, Boardwalk Planks, Stepping Stones & Water Bridges
  buildRoad3DDetails(k, theme, plan);

  // 3b. Distant Panoramic Myanmar Horizon Mountains & Silhouette Stupas
  buildHorizonBackdrop(k, theme, islandW, islandD, seed);

  // 3c. World-Specific Environmental Landscaping (Trees, Lanterns, Ships, Mini-Stupas, Rocks, Fountains)
  populateWorldScenery(k, theme, quests, plan, seed);

  // Merge all static environmental scenery into minimal draw calls
  try {
    mergeStaticMeshes(sceneryRoot);
  } catch (err) {
    console.warn('[CHL Realm] Landscape merge skipped:', err);
  }
  group.add(sceneryRoot);

  return { group, groundMesh, plan };
}

// ---------------------------------------------------------------------------
// 3D Road Curbs, Bridges, Streetlights & Directional Wayfinding Signs
// ---------------------------------------------------------------------------

function buildRoad3DDetails(k: Kit, theme: WorldTheme, plan: WorldMapPlan): void {
  const curbColor = ROAD_STYLE_COLORS[plan.roads[0]?.style ?? 'asphalt'].border;
  const curbMat = stdMat(curbColor, { rough: 0.65 });
  const woodMat = stdMat('#8b5a2b', { rough: 0.85 });
  const postMat = stdMat('#5b3a1e', { rough: 0.9 });

  for (const r of plan.roads) {
    const halfW3 = (r.width * MAP_SCALE) / 2;

    for (let s = 0; s < r.points.length - 1; s++) {
      const [ax, ay] = r.points[s];
      const [bx, by] = r.points[s + 1];
      const segLenMap = Math.hypot(bx - ax, by - ay);
      if (segLenMap < 20) continue;

      const a3 = mapToWorld3D(ax, ay);
      const b3 = mapToWorld3D(bx, by);
      const dx = b3.wx - a3.wx;
      const dz = b3.wz - a3.wz;
      const len3 = Math.hypot(dx, dz);
      const yaw = Math.atan2(dx, dz);
      const nx = Math.cos(yaw);
      const nz = -Math.sin(yaw);

      if (r.style === 'boardwalk') {
        // Raised 3D wooden boardwalk planks + support pilings
        const planks = Math.max(4, Math.floor(len3 / 0.55));
        for (let p = 0; p <= planks; p++) {
          const t = p / planks;
          const px = a3.wx + dx * t;
          const pz = a3.wz + dz * t;
          const plank = k.box(halfW3 * 1.9, 0.08, 0.36, woodMat, px, 0.14, pz);
          plank.rotation.y = yaw;
          if (p % 4 === 0) {
            k.cyl(0.06, 0.06, 0.45, 6, postMat, px + nx * halfW3 * 0.85, -0.12, pz + nz * halfW3 * 0.85);
            k.cyl(0.06, 0.06, 0.45, 6, postMat, px - nx * halfW3 * 0.85, -0.12, pz - nz * halfW3 * 0.85);
          }
        }
        continue;
      }

      // Check if segment crosses water -> add an arched stone/steel bridge deck + railings
      const midMapX = (ax + bx) / 2;
      const midMapY = (ay + by) / 2;
      if (isInsideWater(midMapX, midMapY, plan.waters, -6)) {
        const bridgeDeck = k.box(halfW3 * 2.15, 0.16, len3 * 0.55, '#cbd5e1', (a3.wx + b3.wx) / 2, 0.22, (a3.wz + b3.wz) / 2);
        bridgeDeck.rotation.y = yaw;
        for (const side of [-1, 1]) {
          const rail = k.box(0.12, 0.42, len3 * 0.55, curbMat, (a3.wx + b3.wx) / 2 + nx * side * halfW3, 0.48, (a3.wz + b3.wz) / 2 + nz * side * halfW3);
          rail.rotation.y = yaw;
        }
      }

      // Raised curb strips or trail boundary stones on major roads
      if (r.width >= 30) {
        for (const side of [-1, 1]) {
          const curb = k.box(
            0.16,
            0.09,
            len3,
            r.style === 'neon_circuit' ? glowMat('#34d399', 0.9) : curbMat,
            (a3.wx + b3.wx) / 2 + nx * side * (halfW3 + 0.08),
            0.05,
            (a3.wz + b3.wz) / 2 + nz * side * (halfW3 + 0.08)
          );
          curb.rotation.y = yaw;
        }
      } else if (r.style === 'sand_trail' || r.style === 'farm_track') {
        // Stepping stones & trail marker cairns
        const steps = Math.max(3, Math.floor(len3 / 2.6));
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          const sx = a3.wx + dx * t;
          const sz = a3.wz + dz * t;
          k.cyl(0.28, 0.32, 0.05, 7, '#a8a29e', sx, 0.02, sz);
        }
      }

      // Streetlamps / Lanterns along primary avenues (every ~13 world units)
      if (r.width >= 32 && len3 >= 10) {
        const lamps = Math.max(1, Math.floor(len3 / 13.5));
        for (let i = 1; i <= lamps; i++) {
          const t = (i - 0.5) / lamps;
          const side = i % 2 === 0 ? 1 : -1;
          const lx = a3.wx + dx * t + nx * side * (halfW3 + 0.65);
          const lz = a3.wz + dz * t + nz * side * (halfW3 + 0.65);
          const lm = mapToWorld3D(0, 0);
          void lm;
          streetLight(k, lx, lz, theme);
        }
      }

      // Named Road Signpost near midpoint of labeled roads
      if (r.label && s === 0) {
        const mx = a3.wx + dx * 0.35 + nx * (halfW3 + 1.05);
        const mz = a3.wz + dz * 0.35 + nz * (halfW3 + 1.05);
        roadSignPost(k, mx, mz, r.label, theme);
      }
    }
  }
}

function streetLight(k: Kit, x: number, z: number, theme: WorldTheme): void {
  if (theme.landscapeType === 'bagan_plains' || theme.landscapeType === 'mandalay_moat_kitchens') {
    // Traditional Myanmar Teak & Warm Lantern Post
    k.cyl(0.06, 0.09, 2.05, 8, '#78350f', x, 0, z);
    k.box(0.45, 0.06, 0.06, '#facc15', x, 2.05, z);
    k.cyl(0.14, 0.11, 0.32, 8, glowMat('#fbbf24', 1.4), x, 1.72, z);
    k.cone(0.22, 0.16, 8, '#991b1b', x, 2.04, z);
  } else if (theme.landscapeType === 'putao_myeik_incubator') {
    // Cyber Holo Pylon
    k.cyl(0.06, 0.08, 2.3, 8, '#0f172a', x, 0, z);
    k.mesh(new THREE.OctahedronGeometry(0.18, 0), glowMat('#22d3ee', 1.6), x, 2.48, z);
  } else {
    // Modern Curved Boulevard / Port Floodlight Pole
    k.cyl(0.06, 0.09, 2.55, 8, '#64748b', x, 0, z);
    k.box(0.42, 0.07, 0.18, '#334155', x, 2.58, z);
    k.box(0.32, 0.05, 0.14, glowMat('#fef08a', 1.3), x, 2.53, z);
  }
}

function roadSignPost(k: Kit, x: number, z: number, label: string, theme: WorldTheme): void {
  k.cyl(0.05, 0.06, 1.65, 8, '#475569', x, 0, z);
  k.sign(label, theme.primaryHex, '#fde047', 1.85, 0.42, x, 1.68, z);
}

// ---------------------------------------------------------------------------
// Distant Horizon Mountains, Ridges & River/Sea Ships
// ---------------------------------------------------------------------------

function buildHorizonBackdrop(
  k: Kit,
  theme: WorldTheme,
  islandW: number,
  islandD: number,
  seed: number
): void {
  const rng = mulberry32(seed + 77);
  const hillColor =
    theme.landscapeType === 'putao_myeik_incubator'
      ? '#334155'
      : theme.landscapeType === 'bagan_plains'
        ? '#7c2d12'
        : theme.floorHexB;
  const hillMat = stdMat(hillColor, { rough: 0.85, flat: true });
  const snowMat = stdMat('#f8fafc', { rough: 0.55, flat: true });
  const goldMat = stdMat('#facc15', { metal: 0.8, rough: 0.25 });

  // Northern panoramic ridge across the full 2x width
  for (let i = -7; i <= 7; i++) {
    const hx = i * (islandW / 13);
    const hz = -islandD / 2 - (theme.landscapeType === 'dawei_warehouse_port' ? 23 : 15) - (Math.abs(i) % 3) * 2.2;
    const r = 5.2 + rng() * 3.8;
    const h = 6.5 + rng() * 6.5;
    const cone = jitterGeometry(new THREE.ConeGeometry(r, h, 10, 3), r * 0.16, seed + i + 300, h / 2 - 0.01);
    k.mesh(cone, hillMat, hx, h / 2 - 1.2, hz);

    if (theme.landscapeType === 'putao_myeik_incubator') {
      k.cone(r * 0.46, h * 0.42, 10, snowMat, hx, h * 0.58 - 1.2, hz);
    } else if (
      (theme.landscapeType === 'bagan_plains' || theme.landscapeType === 'mawlamyaing_skyline') &&
      Math.abs(i) % 3 === 1
    ) {
      // Distant hilltop pagoda spire silhouette
      k.cone(0.55, 1.9, 10, goldMat, hx, h - 1.3, hz);
    }
  }

  // Dawei Deep-Sea Container Cargo Ship moored offshore in the northern port basin!
  if (theme.landscapeType === 'dawei_warehouse_port') {
    buildCargoShip(k, -6, -islandD / 2 - 9.5);
    buildCargoShip(k, 28, -islandD / 2 - 12.5);
  }

  // Irrawaddy / Thanlwin Traditional Wooden Riverboats
  if (theme.landscapeType === 'bagan_plains' || theme.landscapeType === 'mawlamyaing_skyline') {
    for (const bx of [-28, 12, 38]) {
      const bz = -islandD / 2 - 7.5;
      const hull = k.mesh(new THREE.CylinderGeometry(0.55, 0.38, 5.2, 8), '#5b3a1e', bx, -0.05, bz);
      hull.rotation.z = Math.PI / 2;
      hull.scale.set(0.55, 1, 1);
      k.cyl(0.05, 0.05, 3.4, 6, '#a16207', bx, 0.2, bz);
      const sail = k.mesh(new THREE.PlaneGeometry(2.1, 2.5), stdMat('#fef3c7', { side: THREE.DoubleSide }), bx + 0.2, 1.9, bz);
      sail.rotation.y = 0.25;
    }
  }
}

function buildCargoShip(k: Kit, x: number, z: number): void {
  const g = k.group('', x, -0.1, z);
  g.slab(18, 1.6, 4.2, '#7f1d1d', 0, 0, 0);
  g.slab(18.4, 0.9, 4.4, '#0f172a', 0, 1.4, 0);
  // Bridge superstructure
  g.slab(2.6, 2.8, 3.6, '#f8fafc', -6.4, 2.3, 0);
  g.box(2.7, 0.45, 3.7, glowMat('#38bdf8', 0.6), -6.4, 4.5, 0);
  g.cyl(0.35, 0.42, 1.5, 10, '#f59e0b', -7.2, 5.1, 0);
  // Stacked shipping containers on deck
  const cols = ['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#0891b2'];
  for (let cx = -3; cx <= 6; cx += 2.3) {
    for (let tier = 0; tier < 3; tier++) {
      for (const cz of [-1.05, 1.05]) {
        g.slab(2.05, 0.75, 1.5, cols[(Math.abs(Math.round(cx)) + tier) % cols.length], cx, 2.3 + tier * 0.76, cz);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Scattered Biome Trees, Palms, Mini-Stupas, Rocks, Fountains & Park Scenery
// ---------------------------------------------------------------------------

function populateWorldScenery(
  k: Kit,
  theme: WorldTheme,
  quests: QuestDefinition[],
  plan: WorldMapPlan,
  seed: number
): void {
  const rng = mulberry32(seed + 909);

  // Add special centerpiece props for specific plazas/lakes
  if (theme.landscapeType === 'mawlamyaing_skyline') {
    // Central Roundabout Fountain at [760, 470]
    const f = mapToWorld3D(760, 470);
    k.torus(2.8, 0.24, '#e2e8f0', f.wx, 0.24, f.wz, true, 28);
    k.cyl(0.55, 0.75, 1.2, 14, '#cbd5e1', f.wx, 0, f.wz);
    k.torus(1.25, 0.14, '#f8fafc', f.wx, 1.15, f.wz, true, 20);
    k.cone(0.45, 1.35, 12, glowMat('#7dd3fc', 1.1), f.wx, 1.2, f.wz);
  }

  if (theme.landscapeType === 'yangon_shopping_center') {
    // Golden Karaweik Pavilion Barge on Kandawgyi Lake [225, 205]
    const b = mapToWorld3D(225, 205);
    const gold = stdMat('#facc15', { metal: 0.85, rough: 0.22 });
    k.slab(3.6, 0.55, 1.8, gold, b.wx, -0.05, b.wz);
    k.slab(2.2, 0.85, 1.3, '#b91c1c', b.wx, 0.5, b.wz);
    k.cone(1.3, 1.45, 4, gold, b.wx, 1.35, b.wz);
  }

  // Clearance helper so scenery never blocks roads, landmarks, portals, NPCs, or quest spots
  const isClear = (mx: number, my: number): boolean => {
    if (mx < 75 || mx > WORLD_WIDTH - 75 || my < 80 || my > WORLD_HEIGHT - 75) return false;
    if (isInsideWater(mx, my, plan.waters, 14)) return false;

    const r = nearestPointOnRoads(mx, my, plan.roads);
    if (r.dist < r.halfWidth + 24) return false;

    for (const p of plan.plazas) {
      const nx = (mx - p.x) / (p.rx + 18);
      const ny = (my - p.y) / (p.ry + 18);
      if (nx * nx + ny * ny <= 1) return false;
    }

    for (const prop of theme.props) {
      if (
        mx >= prop.x - 28 &&
        mx <= prop.x + prop.w + 28 &&
        my >= prop.y - 28 &&
        my <= prop.y + prop.h + 28
      ) {
        return false;
      }
    }

    const pois: Array<[number, number]> = [
      theme.spawnsAt,
      ...theme.portals.map((p: WorldPortal): [number, number] => [p.x, p.y]),
      ...theme.npcs.map((n): [number, number] => [n.x, n.y]),
      ...quests.map((q): [number, number] => [q.spawn_location[0], q.spawn_location[1]]),
      ...theme.chests.map((c): [number, number] => [c.x, c.y]),
    ];
    for (const [px, py] of pois) {
      if (Math.hypot(mx - px, my - py) < 58) return false;
    }
    return true;
  };

  const placed: Array<[number, number]> = [];
  const targetCount = 92;
  let attempts = 0;

  while (placed.length < targetCount && attempts < 900) {
    attempts++;
    const mx = 85 + rng() * (WORLD_WIDTH - 170);
    const my = 90 + rng() * (WORLD_HEIGHT - 175);
    if (!isClear(mx, my)) continue;
    if (placed.some(([ox, oy]) => Math.hypot(mx - ox, my - oy) < 52)) continue;
    placed.push([mx, my]);

    const { wx, wz } = mapToWorld3D(mx, my);
    const s = 0.85 + rng() * 0.5;
    const roll = rng();

    switch (theme.landscapeType) {
      case 'bagan_plains': {
        if (roll < 0.24) {
          // Scattered Ancient Brick Mini-Stupas across the Bagan Plains
          k.slab(1.1 * s, 0.35 * s, 1.1 * s, '#9a3412', wx, 0, wz);
          k.cyl(0.28 * s, 0.48 * s, 0.85 * s, 12, '#c2410c', wx, 0.35 * s, wz);
          k.cone(0.3 * s, 0.95 * s, 12, stdMat('#f59e0b', { metal: 0.7, rough: 0.3 }), wx, 1.2 * s, wz);
        } else if (roll < 0.68) {
          // Toddy Palm or Umbrella Acacia Tree
          sceneryPalmOrCanopy(k, wx, wz, s, roll < 0.46, '#4d7c0f');
        } else {
          sceneryRockOrBush(k, wx, wz, s, '#78350f', '#65a30d', seed + attempts);
        }
        break;
      }

      case 'yangon_shopping_center': {
        if (roll < 0.55) {
          sceneryPalmOrCanopy(k, wx, wz, s, roll < 0.28, '#15803d');
        } else if (roll < 0.82) {
          // Manicured Mall Planter Box with Flowers
          k.slab(1.2 * s, 0.32, 0.65 * s, '#e2e8f0', wx, 0, wz);
          k.slab(1.05 * s, 0.22, 0.5 * s, '#16a34a', wx, 0.32, wz);
          for (const fx of [-0.32, 0, 0.32]) {
            k.sphere(0.14 * s, fx === 0 ? '#facc15' : '#ec4899', wx + fx * s, 0.62, wz, 7, 6);
          }
        } else {
          // Park Bench
          k.slab(1.1, 0.26, 0.42, '#78350f', wx, 0.12, wz);
          k.slab(1.1, 0.34, 0.08, '#78350f', wx, 0.38, wz - 0.18);
        }
        break;
      }

      case 'mandalay_moat_kitchens': {
        if (roll < 0.52) {
          sceneryPalmOrCanopy(k, wx, wz, s, false, '#166534');
        } else if (roll < 0.78) {
          // Night-Market Street Food Stall with Crimson Parasol
          k.slab(1.1 * s, 0.55 * s, 0.7 * s, '#92400e', wx, 0, wz);
          k.cyl(0.04, 0.04, 1.55 * s, 6, '#fde68a', wx, 0, wz);
          k.cone(0.95 * s, 0.42 * s, 8, '#dc2626', wx, 1.45 * s, wz);
        } else {
          sceneryRockOrBush(k, wx, wz, s, '#7f1d1d', '#15803d', seed + attempts);
        }
        break;
      }

      case 'taunggyi_farms_factory': {
        if (mx < WORLD_WIDTH * 0.5) {
          // West: Shan Cherry Blossom & Highland Pines + Hay Bales
          if (roll < 0.42) {
            sceneryPalmOrCanopy(k, wx, wz, s, false, '#f472b6'); // Pink Shan cherry blossoms!
          } else if (roll < 0.8) {
            sceneryPine(k, wx, wz, s, false);
          } else {
            k.cyl(0.42 * s, 0.42 * s, 0.55 * s, 12, '#eab308', wx, 0, wz);
          }
        } else {
          // East: Solar Panels, Pallet Stacks & Factory Greenery
          if (roll < 0.45) {
            k.cyl(0.06, 0.08, 0.65, 6, '#64748b', wx, 0, wz);
            const panel = k.box(1.35 * s, 0.06, 0.95 * s, stdMat('#1d4ed8', { metal: 0.7, rough: 0.2 }), wx, 0.68, wz);
            panel.rotation.x = 0.42;
          } else if (roll < 0.75) {
            sceneryPine(k, wx, wz, s * 0.9, false);
          } else {
            k.slab(0.95 * s, 0.55 * s, 0.95 * s, '#c08a4f', wx, 0, wz);
          }
        }
        break;
      }

      case 'putao_myeik_incubator': {
        if (my < WORLD_HEIGHT * 0.34) {
          // North Putao: Snowy Pines & Glowing Ice Crystals
          if (roll < 0.65) sceneryPine(k, wx, wz, s, true);
          else k.cone(0.38 * s, 1.35 * s, 6, glowMat('#67e8f9', 0.8), wx, 0, wz);
        } else {
          // Center/South Myeik: Tropical Palms & Bioluminescent Coral Nodes
          if (roll < 0.62) sceneryPalmOrCanopy(k, wx, wz, s, true, '#10b981');
          else k.sphere(0.35 * s, glowMat('#34d399', 0.9), wx, 0.32 * s, wz, 8, 6);
        }
        break;
      }

      case 'mawlamyaing_skyline': {
        if (roll < 0.58) {
          sceneryPalmOrCanopy(k, wx, wz, s, roll < 0.3, '#15803d');
        } else if (roll < 0.84) {
          // Sculpted Topiary Hedge & Architectural Bollard
          k.slab(1.35 * s, 0.48 * s, 0.45 * s, '#166534', wx, 0, wz);
          k.cyl(0.08, 0.08, 0.55, 8, glowMat('#93c5fd', 0.9), wx + 0.85 * s, 0, wz);
        } else {
          // Small Golden Ridge Shrine
          k.slab(0.8 * s, 0.25 * s, 0.8 * s, '#e2e8f0', wx, 0, wz);
          k.cone(0.32 * s, 1.05 * s, 10, stdMat('#facc15', { metal: 0.8, rough: 0.2 }), wx, 0.25 * s, wz);
        }
        break;
      }

      case 'dawei_warehouse_port': {
        if (roll < 0.45) {
          // Stacked Port Shipping Containers
          const cCol = ['#0284c7', '#f59e0b', '#dc2626', '#16a34a'][attempts % 4];
          k.slab(1.85 * s, 0.68 * s, 0.78 * s, cCol, wx, 0, wz);
          if (roll < 0.22) k.slab(1.85 * s, 0.68 * s, 0.78 * s, '#f8fafc', wx, 0.68 * s, wz);
        } else if (roll < 0.78) {
          // Coastal Dawei Palm Tree
          sceneryPalmOrCanopy(k, wx, wz, s, true, '#4d7c0f');
        } else {
          // Tall Port Yard Floodlight Mast
          k.cyl(0.08, 0.12, 3.8, 8, '#94a3b8', wx, 0, wz);
          k.box(0.85, 0.22, 0.2, glowMat('#fef9c3', 1.5), wx, 3.85, wz);
        }
        break;
      }
    }
  }
}

function sceneryPalmOrCanopy(
  k: Kit,
  x: number,
  z: number,
  s: number,
  isPalm: boolean,
  leafHex: string
): void {
  if (isPalm) {
    k.cyl(0.09 * s, 0.14 * s, 2.35 * s, 7, '#8b5a2b', x, 0, z);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const frond = k.box(0.24 * s, 0.05, 1.05 * s, leafHex, x + Math.sin(a) * 0.48 * s, 2.28 * s, z + Math.cos(a) * 0.48 * s);
      frond.rotation.y = a;
      frond.rotation.x = 0.42;
    }
  } else {
    k.cyl(0.12 * s, 0.17 * s, 1.15 * s, 7, '#5b3a1e', x, 0, z);
    k.sphere(0.72 * s, leafHex, x, 1.55 * s, z, 9, 7);
    k.sphere(0.52 * s, leafHex, x + 0.35 * s, 1.35 * s, z + 0.2 * s, 8, 6);
  }
}

function sceneryPine(k: Kit, x: number, z: number, s: number, snowy: boolean): void {
  k.cyl(0.1 * s, 0.14 * s, 0.7 * s, 6, '#5b3a1e', x, 0, z);
  for (let t = 0; t < 3; t++) {
    const r = (0.72 - t * 0.18) * s;
    const y = 0.55 * s + t * 0.55 * s;
    k.cone(r, 0.92 * s, 8, '#14532d', x, y, z);
    if (snowy) k.cone(r * 0.56, 0.38 * s, 8, '#f8fafc', x, y + 0.55 * s, z);
  }
}

function sceneryRockOrBush(
  k: Kit,
  x: number,
  z: number,
  s: number,
  rockHex: string,
  bushHex: string,
  seed: number
): void {
  const g = jitterGeometry(new THREE.DodecahedronGeometry(0.48 * s, 0), 0.12 * s, seed);
  k.mesh(g, stdMat(rockHex, { rough: 0.9, flat: true }), x, 0.28 * s, z);
  k.sphere(0.34 * s, bushHex, x + 0.42 * s, 0.24 * s, z + 0.2 * s, 7, 5);
}

// ---------------------------------------------------------------------------
// Live 2D Cartographic Mini-Map / World Map Renderer (HUD Overlay)
// ---------------------------------------------------------------------------

export function drawWorldMiniMap(params: {
  canvas: HTMLCanvasElement;
  theme: WorldTheme;
  plan: WorldMapPlan;
  player: PlayerState;
  quests: QuestDefinition[];
  colleagues: ColleaguePresence[];
  tick: number;
  expanded?: boolean;
}): void {
  const { canvas, theme, plan, player, quests, colleagues, tick, expanded } = params;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const sx = w / WORLD_WIDTH;
  const sy = h / WORLD_HEIGHT;

  // Base cartographic parchment / biome backdrop
  ctx.fillStyle = theme.floorHexA;
  ctx.fillRect(0, 0, w, h);

  if (theme.landscapeType === 'taunggyi_farms_factory') {
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, 0, w * 0.48, h);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(w * 0.48, 0, w * 0.52, h);
  } else if (theme.landscapeType === 'putao_myeik_incubator') {
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, w, h * 0.28);
  }

  // Northern river / sea strip
  if (plan.northShoreWater) {
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 0, w, Math.max(6, h * 0.08));
  }

  // Interior lakes, moats & canals
  for (const wz of plan.waters) {
    ctx.fillStyle = wz.color;
    ctx.beginPath();
    if (wz.shape === 'rect') {
      ctx.fillRect((wz.x - wz.rx) * sx, (wz.y - wz.ry) * sy, wz.rx * 2 * sx, wz.ry * 2 * sy);
    } else {
      ctx.ellipse(wz.x * sx, wz.y * sy, wz.rx * sx, wz.ry * sy, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Plazas
  for (const p of plan.plazas) {
    ctx.fillStyle = 'rgba(250, 204, 21, 0.24)';
    ctx.beginPath();
    ctx.ellipse(p.x * sx, p.y * sy, p.rx * sx, p.ry * sy, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Roads & trails
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const r of plan.roads) {
    const sc = ROAD_STYLE_COLORS[r.style];
    ctx.strokeStyle = sc.border;
    ctx.lineWidth = Math.max(2, (r.width + 8) * sx);
    ctx.beginPath();
    r.points.forEach(([px, py], i) => {
      if (i === 0) ctx.moveTo(px * sx, py * sy);
      else ctx.lineTo(px * sx, py * sy);
    });
    ctx.stroke();

    ctx.strokeStyle = sc.fill;
    ctx.lineWidth = Math.max(1.4, r.width * sx);
    ctx.stroke();
  }

  // Landmarks
  for (const prop of theme.props) {
    ctx.fillStyle = 'rgba(248, 250, 252, 0.32)';
    ctx.strokeStyle = theme.accentHex;
    ctx.lineWidth = 1;
    ctx.fillRect(prop.x * sx, prop.y * sy, Math.max(4, prop.w * sx), Math.max(4, prop.h * sy));
    ctx.strokeRect(prop.x * sx, prop.y * sy, Math.max(4, prop.w * sx), Math.max(4, prop.h * sy));
    if (expanded && prop.label) {
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '600 10px "Open Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        prop.label.slice(0, 18),
        (prop.x + prop.w / 2) * sx,
        prop.y * sy - 3
      );
    }
  }

  // Portals (Swirling rings)
  for (const portal of theme.portals) {
    ctx.fillStyle = portal.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(portal.x * sx, portal.y * sy, expanded ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // 5 Quest Spots
  for (const q of quests) {
    const done = player.completedQuestIds.includes(q.quest_id);
    const isActive = player.activeQuestId === q.quest_id && !done;
    const qx = q.spawn_location[0] * sx;
    const qy = q.spawn_location[1] * sy;
    if (isActive) {
      const pulse = 5 + Math.sin(tick * 0.14) * 2.5;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(qx, qy, pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = done ? '#22c55e' : '#facc15';
    ctx.beginPath();
    ctx.arc(qx, qy, expanded ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3 MCPs / NPCs
  for (const npc of theme.npcs) {
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(npc.x * sx - 3, npc.y * sy - 3, 6, 6);
    if (expanded) {
      ctx.fillStyle = '#fde047';
      ctx.font = '700 10px "Open Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(npc.name, npc.x * sx, npc.y * sy - 6);
    }
  }

  // Colleagues
  for (const c of colleagues) {
    if (c.uid === player.uid) continue;
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.arc(c.x * sx, c.y * sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Local Player Marker
  const px = player.x * sx;
  const py = player.y * sy;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0ea5e9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, expanded ? 6.5 : 4.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}
