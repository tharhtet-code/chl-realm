import * as THREE from 'three';
import type {
  CosmeticSlot,
  TreasureChest,
  WorldPortal,
  WorldProp,
  WorldTheme,
} from '../types/game';
import { COSMETIC_CATALOG, WORLD_HEIGHT, WORLD_WIDTH } from '../worlds/worldDefinitions';
import { buildDetailedLandmark } from './landmarkModels';

export const MAP_SCALE = 0.08;

export function mapToWorld3D(x: number, y: number): { wx: number; wz: number } {
  return {
    wx: (x - WORLD_WIDTH / 2) * MAP_SCALE,
    wz: (y - WORLD_HEIGHT / 2) * MAP_SCALE,
  };
}

export function world3DToMap(wx: number, wz: number): { x: number; y: number } {
  return {
    x: wx / MAP_SCALE + WORLD_WIDTH / 2,
    y: wz / MAP_SCALE + WORLD_HEIGHT / 2,
  };
}

/**
 * Generates a crisp Open Sans 2D Canvas Sprite Billboard for 3D Nameplates,
 * Quest Indicators, and Proximity Chat Bubbles.
 */
export function createTextBillboard(params: {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  chatBubble?: string | null;
  isPrimary?: boolean;
}): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (params.chatBubble) {
    const bubbleText =
      params.chatBubble.length > 38
        ? `${params.chatBubble.slice(0, 38)}…`
        : params.chatBubble;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    roundRect(ctx, 20, 8, 472, 52, 14);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#facc15';
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = '700 20px "Open Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`💬 "${bubbleText}"`, 256, 41);
  } else if (params.badge) {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
    roundRect(ctx, 86, 14, 340, 44, 22);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = params.badgeColor || '#facc15';
    ctx.stroke();

    ctx.fillStyle = params.badgeColor || '#facc15';
    ctx.font = '700 19px "Open Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(params.badge, 256, 43);
  }

  ctx.fillStyle = params.isPrimary
    ? 'rgba(15, 23, 42, 0.92)'
    : 'rgba(2, 6, 23, 0.84)';
  roundRect(ctx, 48, 74, 416, 74, 16);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = params.isPrimary ? '#38bdf8' : '#64748b';
  ctx.stroke();

  ctx.fillStyle = params.isPrimary ? '#38bdf8' : '#f8fafc';
  ctx.font = '700 23px "Open Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(params.title, 256, 106);

  if (params.subtitle) {
    ctx.fillStyle = '#fde047';
    ctx.font = '600 17px "Open Sans", system-ui, sans-serif';
    ctx.fillText(params.subtitle, 256, 134);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4.7, 1.75, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface FantasyCharacterRig {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  capeMesh: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  staffOrb: THREE.Mesh;
  cosmeticsGroup: THREE.Group;
  petMesh: THREE.Object3D | null;
  billboard: THREE.Sprite;
  lastSignature: string;
}

/**
 * Builds a stylized 3D Chibi Fantasy Adventurer / MCP rig with high polygon density
 * for smooth silhouettes on mobile screens.
 */
export function createFantasyCharacterRig(params: {
  tunicColor: string;
  accentColor: string;
  isLocalPlayer?: boolean;
}): FantasyCharacterRig {
  const group = new THREE.Group();

  // High-segment ground aura ring (36 segments)
  const auraGeo = new THREE.RingGeometry(0.65, 0.94, 36);
  auraGeo.rotateX(-Math.PI / 2);
  const auraMat = new THREE.MeshBasicMaterial({
    color: params.isLocalPlayer ? '#38bdf8' : params.accentColor,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: params.isLocalPlayer ? 0.8 : 0.38,
  });
  const auraMesh = new THREE.Mesh(auraGeo, auraMat);
  auraMesh.position.y = 0.04;
  group.add(auraMesh);

  // Articulated Legs with rounded boots (16 radial segments)
  const legGeo = new THREE.CylinderGeometry(0.16, 0.14, 0.65, 16, 2);
  const legMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.55 });
  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.22, 0.32, 0);
  const rightLeg = new THREE.Mesh(legGeo, legMat.clone());
  rightLeg.position.set(0.22, 0.32, 0);
  group.add(leftLeg, rightLeg);

  // Tunic / Torso with higher radial & height subdivisions (22x4)
  const bodyGeo = new THREE.ConeGeometry(0.64, 1.28, 22, 4);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: params.tunicColor,
    roughness: 0.42,
    metalness: 0.18,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = 1.05;
  group.add(bodyMesh);

  // Pauldrons (Shoulder Armor)
  const pauldronGeo = new THREE.SphereGeometry(0.22, 16, 14);
  const pauldronMat = new THREE.MeshStandardMaterial({
    color: params.accentColor,
    metalness: 0.45,
    roughness: 0.35,
  });
  const leftPauldron = new THREE.Mesh(pauldronGeo, pauldronMat);
  leftPauldron.position.set(-0.48, 1.44, 0);
  const rightPauldron = new THREE.Mesh(pauldronGeo, pauldronMat);
  rightPauldron.position.set(0.48, 1.44, 0);
  group.add(leftPauldron, rightPauldron);

  // Golden Belt Collar (14x28 segments)
  const beltGeo = new THREE.TorusGeometry(0.43, 0.065, 14, 28);
  beltGeo.rotateX(Math.PI / 2);
  const beltMat = new THREE.MeshStandardMaterial({
    color: '#facc15',
    metalness: 0.65,
    roughness: 0.28,
  });
  const beltMesh = new THREE.Mesh(beltGeo, beltMat);
  beltMesh.position.y = 0.92;
  group.add(beltMesh);

  // Flowing Subdivided Fantasy Cloak
  const capeGeo = new THREE.PlaneGeometry(0.96, 1.18, 6, 6);
  const capeMat = new THREE.MeshStandardMaterial({
    color: params.accentColor,
    side: THREE.DoubleSide,
    roughness: 0.5,
  });
  const capeMesh = new THREE.Mesh(capeGeo, capeMat);
  capeMesh.position.set(0, 1.05, -0.43);
  capeMesh.rotation.x = 0.22;
  group.add(capeMesh);

  // Arms (16 radial segments)
  const armGeo = new THREE.CylinderGeometry(0.13, 0.11, 0.62, 16, 2);
  const armMat = new THREE.MeshStandardMaterial({ color: params.tunicColor, roughness: 0.5 });
  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-0.56, 1.15, 0);
  leftArm.rotation.z = 0.25;
  const rightArm = new THREE.Mesh(armGeo, armMat);
  rightArm.position.set(0.56, 1.15, 0);
  rightArm.rotation.z = -0.25;
  group.add(leftArm, rightArm);

  // Arcane Staff with Subdivided Crystal Orb
  const staffShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 1.68, 14),
    new THREE.MeshStandardMaterial({ color: '#fde047', metalness: 0.65, roughness: 0.25 })
  );
  staffShaft.position.set(0.18, 0.2, 0.22);
  rightArm.add(staffShaft);

  const staffOrb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.2, 2),
    new THREE.MeshBasicMaterial({ color: params.accentColor })
  );
  staffOrb.position.set(0, 0.92, 0);
  staffShaft.add(staffOrb);

  // Smooth Chibi Head (26x20 segments)
  const headGeo = new THREE.SphereGeometry(0.49, 26, 20);
  const headMat = new THREE.MeshStandardMaterial({ color: '#fde68a', roughness: 0.48 });
  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.position.y = 1.92;
  group.add(headMesh);

  // Eyes (14x14 segments)
  const eyeGeo = new THREE.SphereGeometry(0.068, 14, 14);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#0f172a' });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.16, 1.95, 0.43);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.16, 1.95, 0.43);
  group.add(leftEye, rightEye);

  const cosmeticsGroup = new THREE.Group();
  group.add(cosmeticsGroup);

  const billboard = createTextBillboard({
    title: 'Novice',
    isPrimary: params.isLocalPlayer,
  });
  billboard.position.set(0, 3.4, 0);
  group.add(billboard);

  return {
    group,
    bodyMesh,
    capeMesh,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    staffOrb,
    cosmeticsGroup,
    petMesh: null,
    billboard,
    lastSignature: '',
  };
}

export function syncCharacterCosmetics(
  rig: FantasyCharacterRig,
  tunicColor: string,
  equipped?: Partial<Record<CosmeticSlot, string>>
): void {
  (rig.bodyMesh.material as THREE.MeshStandardMaterial).color.set(tunicColor);

  while (rig.cosmeticsGroup.children.length > 0) {
    rig.cosmeticsGroup.remove(rig.cosmeticsGroup.children[0]);
  }
  rig.petMesh = null;

  const hatId = equipped?.hat;
  if (hatId && COSMETIC_CATALOG[hatId]) {
    const hItem = COSMETIC_CATALOG[hatId];
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 0.08, 24),
      new THREE.MeshStandardMaterial({ color: hItem.colorHex, roughness: 0.4 })
    );
    brim.position.y = 2.32;
    const spire = new THREE.Mesh(
      new THREE.ConeGeometry(0.44, 0.88, 22),
      new THREE.MeshStandardMaterial({ color: hItem.accentHex, roughness: 0.35 })
    );
    spire.position.y = 2.75;
    rig.cosmeticsGroup.add(brim, spire);
  } else {
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.51, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.7 })
    );
    hair.position.y = 1.94;
    rig.cosmeticsGroup.add(hair);
  }

  const glassesId = equipped?.glasses;
  if (glassesId && COSMETIC_CATALOG[glassesId]) {
    const gItem = COSMETIC_CATALOG[glassesId];
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.16, 0.25, 2, 2, 2),
      new THREE.MeshBasicMaterial({ color: gItem.colorHex })
    );
    visor.position.set(0, 1.96, 0.39);
    rig.cosmeticsGroup.add(visor);
  }

  const outfitId = equipped?.outfit;
  if (outfitId && COSMETIC_CATALOG[outfitId]) {
    const oItem = COSMETIC_CATALOG[outfitId];
    (rig.capeMesh.material as THREE.MeshStandardMaterial).color.set(oItem.colorHex);
    const tabard = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.75, 0.12, 2, 2, 2),
      new THREE.MeshStandardMaterial({ color: oItem.accentHex, metalness: 0.3 })
    );
    tabard.position.set(0, 1.02, 0.39);
    tabard.rotation.x = -0.25;
    rig.cosmeticsGroup.add(tabard);
  }

  const bootsId = equipped?.boots;
  const bootColor =
    bootsId && COSMETIC_CATALOG[bootsId] ? COSMETIC_CATALOG[bootsId].colorHex : '#1e293b';
  (rig.leftLeg.material as THREE.MeshStandardMaterial).color.set(bootColor);
  (rig.rightLeg.material as THREE.MeshStandardMaterial).color.set(bootColor);

  const petId = equipped?.pet;
  if (petId && COSMETIC_CATALOG[petId]) {
    const pItem = COSMETIC_CATALOG[petId];
    const petGroup = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 18, 16),
      new THREE.MeshStandardMaterial({
        color: pItem.colorHex,
        emissive: pItem.colorHex,
        emissiveIntensity: 0.4,
      })
    );
    const basket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.08, 0.14, 14),
      new THREE.MeshStandardMaterial({ color: '#b45309' })
    );
    basket.position.y = -0.35;
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.04, 12, 28),
      new THREE.MeshBasicMaterial({ color: pItem.accentHex })
    );
    halo.rotation.x = Math.PI / 2;
    petGroup.add(core, basket, halo);
    petGroup.position.set(1.15, 2.3, 0);
    rig.cosmeticsGroup.add(petGroup);
    rig.petMesh = petGroup;
  }
}

/**
 * Builds high-detail multi-part 3D Myanmar City Landmarks + Business Sector Facilities
 * via `buildDetailedLandmark` (lathed stupas, pyatthat roofs, lattice tower cranes,
 * glass shopping malls, sawtooth factories, container gantry cranes, and islands).
 */
export function createFantasyPropMesh(prop: WorldProp, theme: WorldTheme): THREE.Group {
  const centerX = prop.x + prop.w / 2;
  const centerY = prop.y + prop.h / 2;
  const { wx, wz } = mapToWorld3D(centerX, centerY);

  const width3D = Math.max(3.6, prop.w * MAP_SCALE);
  const depth3D = Math.max(3.1, prop.h * MAP_SCALE);

  const group = buildDetailedLandmark(prop, theme, width3D, depth3D);
  group.position.set(wx, 0, wz);

  if (prop.label) {
    const bounds = new THREE.Box3().setFromObject(group);
    const localHeight = Number.isFinite(bounds.max.y) ? bounds.max.y : 4.2;
    const labelSprite = createTextBillboard({
      title: prop.label,
      badgeColor: theme.accentHex,
    });
    labelSprite.position.set(0, Math.min(10.8, Math.max(4.4, localHeight + 0.95)), 0);
    labelSprite.scale.set(4.1, 1.5, 1);
    group.add(labelSprite);
  }

  return group;
}

/**
 * Builds an ornate Myanmar Portal Waygate with stepped stone plinth, twin carved pillars,
 * golden capitals, pyatthat crown, and swirling multi-ring energy vortex.
 */
export function createFantasyWaygateMesh(
  portal: WorldPortal,
  isUnlocked: boolean
): THREE.Group {
  const group = new THREE.Group();
  const { wx, wz } = mapToWorld3D(portal.x, portal.y);
  group.position.set(wx, 0, wz);

  const color = isUnlocked ? portal.color : '#64748b';
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.72 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: isUnlocked ? '#facc15' : '#94a3b8',
    metalness: 0.75,
    roughness: 0.25,
  });

  // Stepped Stone Sanctuary Base
  const base1 = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.75, 0.22, 24), stoneMat);
  base1.position.y = 0.11;
  const base2 = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.35, 0.2, 24), goldMat);
  base2.position.y = 0.32;
  group.add(base1, base2);

  // Twin Carved Gateway Pillars with Capitals
  for (const sx of [-1.75, 1.75]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 2.85, 16), stoneMat);
    col.position.set(sx, 1.75, 0);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.55, 12), goldMat);
    cap.position.set(sx, 3.45, 0);
    group.add(col, cap);
  }

  // Pyatthat Arch Lintel
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.24, 0.48), goldMat);
  lintel.position.y = 3.35;
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.95, 8), goldMat);
  crown.position.y = 3.92;
  group.add(lintel, crown);

  // High-segment Arcane Torus Ring
  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(1.52, 0.22, 20, 44),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: isUnlocked ? 0.65 : 0.12,
      roughness: 0.22,
      metalness: 0.4,
    })
  );
  arch.position.y = 1.9;
  group.add(arch);

  const vortex = new THREE.Mesh(
    new THREE.CircleGeometry(1.32, 36),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: isUnlocked ? 0.62 : 0.2,
      side: THREE.DoubleSide,
    })
  );
  vortex.position.y = 1.9;
  vortex.name = 'portal_vortex';
  group.add(vortex);

  const sprite = createTextBillboard({
    title: portal.label,
    badge: isUnlocked ? '🌀 PORTAL GATE' : '🔒 PORTAL LOCKED',
    badgeColor: isUnlocked ? '#38bdf8' : '#94a3b8',
  });
  sprite.position.set(0, 4.9, 0);
  sprite.scale.set(4.4, 1.6, 1);
  group.add(sprite);

  return group;
}

/**
 * Builds an ornate Bagan Lacquerware & Brass Treasure Coffer.
 */
export function createFantasyChestMesh(
  chest: TreasureChest,
  isOpened: boolean
): THREE.Group {
  const group = new THREE.Group();
  const { wx, wz } = mapToWorld3D(chest.x, chest.y);
  group.position.set(wx, 0, wz);

  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.28, 0.18, 20),
    new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.7 })
  );
  plinth.position.y = 0.09;
  group.add(plinth);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: isOpened ? '#475569' : '#9a3412',
    roughness: 0.38,
    metalness: 0.2,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: isOpened ? '#64748b' : '#facc15',
    metalness: 0.78,
    roughness: 0.22,
  });

  const box = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.88, 1.02, 2, 2, 2), bodyMat);
  box.position.y = 0.62;
  group.add(box);

  // Brass straps & lockplate
  for (const bx of [-0.48, 0.48]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.92, 1.06), goldMat);
    strap.position.set(bx, 0.62, 0);
    group.add(strap);
  }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.12), goldMat);
  lock.position.set(0, 0.85, 0.53);
  group.add(lock);

  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.51, 0.51, 1.45, 22, 1, false, 0, Math.PI),
    goldMat
  );
  lid.rotation.z = Math.PI / 2;
  lid.position.y = 1.06;
  if (isOpened) lid.rotation.x = -0.55;
  group.add(lid);

  const sprite = createTextBillboard({
    title: chest.label,
    badge: isOpened ? '✓ CHEST CLAIMED' : '✨ Q1 TREASURE CHEST',
    badgeColor: isOpened ? '#94a3b8' : '#fde047',
  });
  sprite.position.set(0, 2.75, 0);
  sprite.scale.set(3.9, 1.45, 1);
  group.add(sprite);

  return group;
}

/**
 * Builds an octagonal Myanmar Shrine Quest Spot Beacon with corner pillars,
 * dual spinning rune rings, and a faceted floating crystal.
 */
export function createQuestRuneBeaconMesh(
  coords: [number, number],
  title: string,
  isCompleted: boolean
): THREE.Group {
  const group = new THREE.Group();
  const { wx, wz } = mapToWorld3D(coords[0], coords[1]);
  group.position.set(wx, 0, wz);

  const color = isCompleted ? '#22c55e' : '#facc15';
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.65 });

  // Octagonal shrine base
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.65, 0.24, 8), stoneMat);
  dais.position.y = 0.12;
  group.add(dais);

  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.9, 10), stoneMat);
    post.position.set(Math.cos(a) * 1.25, 0.55, Math.sin(a) * 1.25);
    group.add(post);
  }

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.08, 1.48, 36),
    new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.26;
  group.add(ring);

  const orbitRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.045, 12, 32),
    new THREE.MeshBasicMaterial({ color })
  );
  orbitRing.position.y = 1.85;
  orbitRing.rotation.x = Math.PI / 3;
  orbitRing.name = 'spin_ring';
  group.add(orbitRing);

  const crystal = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.66, 2),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.68,
      roughness: 0.18,
      metalness: 0.35,
    })
  );
  crystal.position.y = 1.85;
  crystal.name = 'quest_crystal';
  group.add(crystal);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.85, 4.1, 22, 1, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
    })
  );
  beam.position.y = 2.05;
  group.add(beam);

  const sprite = createTextBillboard({
    title,
    subtitle: `Quest Spot [${coords[0]}, ${coords[1]}]`,
    badge: isCompleted ? '✓ QUEST CLEARED' : '⚡ QUEST SPOT',
    badgeColor: color,
  });
  sprite.position.set(0, 4.05, 0);
  sprite.scale.set(4.3, 1.55, 1);
  group.add(sprite);

  return group;
}
