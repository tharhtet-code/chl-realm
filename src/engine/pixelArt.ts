import type {
  CosmeticSlot,
  TreasureChest,
  WorldNpc,
  WorldPortal,
  WorldProp,
  WorldTheme,
} from '../types/game';
import { COSMETIC_CATALOG } from '../worlds/worldDefinitions';

export function drawWorldBackground(
  ctx: CanvasRenderingContext2D,
  theme: WorldTheme,
  width: number,
  height: number,
  tick: number
): void {
  const tileSize = 32;
  ctx.fillStyle = theme.wallHex;
  ctx.fillRect(0, 0, width, height);

  // Inner walkable floor with 16-bit checkerboard tiles
  for (let y = tileSize; y < height - tileSize; y += tileSize) {
    for (let x = tileSize; x < width - tileSize; x += tileSize) {
      const isEven = ((x / tileSize) + (y / tileSize)) % 2 === 0;
      ctx.fillStyle = isEven ? theme.floorHexA : theme.floorHexB;
      ctx.fillRect(x, y, tileSize, tileSize);

      // Subtle 16-bit pixel corner accent
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(x + 2, y + 2, 4, 4);
    }
  }

  // Distribution Badlands special Light Blue & Gold gradient road stripe
  if (theme.id === 'Distribution_Badlands') {
    const grad = ctx.createLinearGradient(60, 180, width - 60, 260);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
    grad.addColorStop(1, 'rgba(245, 158, 11, 0.28)');
    ctx.fillStyle = grad;
    ctx.fillRect(48, 195, width - 96, 56);
  }

  // Manufacturing & Agriculture hybrid biome split (Left: Farmlands, Right: High-Tech Plant)
  if (theme.id === 'Manufacturing_Agri_Zone') {
    ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
    ctx.fillRect(32, 32, width / 2 - 32, height - 64);
    ctx.strokeStyle = '#818cf8';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(width / 2, 32);
    ctx.lineTo(width / 2, height - 32);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Outer 16-bit beveled border
  ctx.lineWidth = 4;
  ctx.strokeStyle = theme.primaryHex === '#0f172a' ? '#94a3b8' : theme.primaryHex;
  ctx.strokeRect(30, 30, width - 60, height - 60);

  // Animated circuit/plaza center lines in The HUB
  if (theme.id === 'The_HUB') {
    const cx = width / 2;
    const cy = height / 2;
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.18)';
    ctx.lineWidth = 2;
    for (const portal of theme.portals) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(portal.x, portal.y);
      ctx.stroke();
    }
  }

  // Top-left retro water-mark banner inside canvas
  ctx.fillStyle = 'rgba(2, 6, 23, 0.65)';
  ctx.fillRect(40, 38, 250, 24);
  ctx.fillStyle = theme.accentHex;
  ctx.font = 'bold 11px "Courier New", monospace';
  const pulse = Math.sin(tick * 0.08) > 0 ? '●' : '○';
  ctx.fillText(`${pulse} ${theme.name.toUpperCase()}`, 48, 54);
}

export function drawWorldProp(
  ctx: CanvasRenderingContext2D,
  prop: WorldProp,
  theme: WorldTheme,
  tick: number
): void {
  const { x, y, w, h, kind, label } = prop;

  // Drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(x + 4, y + 6, w, h);

  switch (kind) {
    case 'supermarket_shelf': {
      ctx.fillStyle = '#581c87';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#d8b4fe';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      // Colorful 16-bit grocery items on shelves
      const itemColors = ['#facc15', '#4ade80', '#f472b6', '#38bdf8'];
      for (let i = 0; i < w - 12; i += 14) {
        ctx.fillStyle = itemColors[(i / 14) % itemColors.length];
        ctx.fillRect(x + 6 + i, y + 6, 8, 8);
        ctx.fillStyle = itemColors[((i / 14) + 2) % itemColors.length];
        ctx.fillRect(x + 6 + i, y + 20, 8, 8);
      }
      break;
    }
    case 'pos_counter': {
      ctx.fillStyle = '#7e22ce';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(x + 8, y + 6, 16, 12); // Register screen
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x + 10, y + 8, 12, 8);
      break;
    }
    case 'bakery_oven': {
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = Math.sin(tick * 0.15) > 0 ? '#f97316' : '#facc15';
      ctx.fillRect(x + 10, y + 12, w - 20, h - 22); // Glowing oven window
      break;
    }
    case 'cafe_table': {
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#fef2f2';
      ctx.fillRect(x + 14, y + 10, 10, 10); // Espresso cup
      ctx.fillRect(x + 30, y + 14, 10, 10);
      break;
    }
    case 'crop_plot': {
      ctx.fillStyle = '#14532d';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#4ade80';
      for (let cx = x + 8; cx < x + w - 8; cx += 14) {
        ctx.fillRect(cx, y + 8, 6, 12);
        ctx.fillRect(cx, y + 26, 6, 12);
      }
      break;
    }
    case 'factory_vat': {
      ctx.fillStyle = '#312e81';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(x + 12, y + 14, w - 24, 10);
      break;
    }
    case 'server_rack':
    case 'data_node': {
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      // Blinking server LEDs
      for (let row = 0; row < 3; row++) {
        ctx.fillStyle = (tick + row * 7) % 20 < 10 ? '#34d399' : '#fde047';
        ctx.fillRect(x + 8, y + 8 + row * 12, w - 16, 5);
      }
      break;
    }
    case 'blueprint_table':
    case 'crane_pillar': {
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(x + 10, y + 10, 14, 6);
      break;
    }
    case 'warehouse_rack':
    case 'delivery_truck': {
      ctx.fillStyle = '#0369a1';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(x + 6, y + 6, w - 12, 12);
      ctx.fillRect(x + 6, y + 24, w - 12, 12);
      break;
    }
    default: {
      ctx.fillStyle = '#334155';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = theme.accentHex;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      break;
    }
  }

  if (label) {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
    ctx.fillRect(x, y - 16, Math.max(w, label.length * 6.2), 14);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.fillText(label, x + 4, y - 5);
  }
}

export function drawPortal(
  ctx: CanvasRenderingContext2D,
  portal: WorldPortal,
  isUnlocked: boolean,
  tick: number
): void {
  const pulse = 18 + Math.sin(tick * 0.1) * 3;

  // Outer glow ring
  ctx.save();
  ctx.beginPath();
  ctx.arc(portal.x, portal.y, pulse + 6, 0, Math.PI * 2);
  ctx.fillStyle = isUnlocked ? `${portal.color}44` : 'rgba(148, 163, 184, 0.2)';
  ctx.fill();

  // Core portal pad
  ctx.beginPath();
  ctx.arc(portal.x, portal.y, 18, 0, Math.PI * 2);
  ctx.fillStyle = isUnlocked ? portal.color : '#475569';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = isUnlocked ? '#ffffff' : '#94a3b8';
  ctx.stroke();

  // Portal icon
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(isUnlocked ? 'WARP' : 'LOCK', portal.x, portal.y + 4);

  // Label plate
  const labelW = portal.label.length * 6.5 + 14;
  ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
  ctx.fillRect(portal.x - labelW / 2, portal.y - 36, labelW, 15);
  ctx.fillStyle = isUnlocked ? '#f8fafc' : '#cbd5e1';
  ctx.font = 'bold 10px "Courier New", monospace';
  ctx.fillText(portal.label, portal.x, portal.y - 25);
  ctx.restore();
}

export function drawTreasureChest(
  ctx: CanvasRenderingContext2D,
  chest: TreasureChest,
  isOpened: boolean,
  tick: number
): void {
  const { x, y } = chest;
  ctx.save();

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x - 12, y - 6, 26, 20);

  // Chest body
  ctx.fillStyle = isOpened ? '#475569' : '#b45309';
  ctx.fillRect(x - 12, y - 10, 24, 18);

  // Gold trim & lock
  ctx.fillStyle = isOpened ? '#94a3b8' : '#facc15';
  ctx.fillRect(x - 12, y - 3, 24, 4);
  ctx.fillRect(x - 3, y - 5, 6, 8);

  if (!isOpened) {
    const sparkleY = y - 16 - Math.abs(Math.sin(tick * 0.12) * 5);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('★ Q1 CHEST', x, sparkleY);
  } else {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CLAIMED', x, y - 14);
  }

  ctx.restore();
}

export function drawQuestBeacon(
  ctx: CanvasRenderingContext2D,
  coords: [number, number],
  title: string,
  isCompleted: boolean,
  tick: number
): void {
  const [x, y] = coords;
  const radius = 16 + Math.sin(tick * 0.15) * 4;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
  ctx.strokeStyle = isCompleted ? '#4ade80' : '#facc15';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([5, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fillStyle = isCompleted ? '#22c55e' : '#eab308';
  ctx.fill();

  const tag = isCompleted ? `✓ [${x},${y}] CLEARED` : `! QUEST TARGET [${x},${y}]`;
  const w = tag.length * 6.5 + 12;
  ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
  ctx.fillRect(x - w / 2, y + 14, w, 16);
  ctx.fillStyle = isCompleted ? '#86efac' : '#fef08a';
  ctx.font = 'bold 10px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(tag, x, y + 25);
  ctx.restore();
}

export function drawNpcSprite(
  ctx: CanvasRenderingContext2D,
  npc: WorldNpc,
  hasCompletedQuest: boolean,
  tick: number
): void {
  const bob = Math.round(Math.sin(tick * 0.1) * 1.5);
  const { x, y } = npc;

  ctx.save();
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x - 10, y + 10, 20, 6);

  // Legs
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(x - 7, y + 2, 6, 10);
  ctx.fillRect(x + 1, y + 2, 6, 10);

  // Tunic / Torso
  ctx.fillStyle = npc.primaryColor;
  ctx.fillRect(x - 10, y - 10 + bob, 20, 14);
  ctx.fillStyle = npc.accentColor;
  ctx.fillRect(x - 4, y - 10 + bob, 8, 14);

  // Head
  ctx.fillStyle = '#fbd38d';
  ctx.fillRect(x - 8, y - 22 + bob, 16, 12);

  // Eyes
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x - 5, y - 18 + bob, 3, 3);
  ctx.fillRect(x + 2, y - 18 + bob, 3, 3);

  // NPC Role Crown / Cap
  ctx.fillStyle = npc.accentColor;
  ctx.fillRect(x - 9, y - 26 + bob, 18, 5);

  // Quest indicator above NPC
  const badgeText =
    npc.role === 'tailor'
      ? '♦ TAILOR SHOP'
      : npc.role === 'leaderboard_keeper'
        ? '★ LEADERBOARD'
        : hasCompletedQuest
          ? '✓ QUEST DONE'
          : '! LEARNING QUEST';

  const badgeColor =
    npc.role === 'tailor'
      ? '#f472b6'
      : npc.role === 'leaderboard_keeper'
        ? '#38bdf8'
        : hasCompletedQuest
          ? '#4ade80'
          : '#facc15';

  const bw = badgeText.length * 6.5 + 10;
  ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
  ctx.fillRect(x - bw / 2, y - 46 + bob, bw, 14);
  ctx.fillStyle = badgeColor;
  ctx.font = 'bold 10px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, x, y - 36 + bob);

  // Nameplate
  const nw = npc.name.length * 6.5 + 10;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(x - nw / 2, y + 16, nw, 14);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px "Courier New", monospace';
  ctx.fillText(npc.name, x, y + 26);

  ctx.restore();
}

export function drawAvatarSprite(
  ctx: CanvasRenderingContext2D,
  params: {
    x: number;
    y: number;
    name: string;
    title: string;
    tunicColor: string;
    isLocalPlayer: boolean;
    equippedCosmetics?: Partial<Record<CosmeticSlot, string>>;
    chatBubble?: string | null;
    tick: number;
  }
): void {
  const { x, y, name, title, tunicColor, isLocalPlayer, equippedCosmetics, chatBubble, tick } = params;
  const bob = Math.round(Math.sin(tick * 0.16) * 1.5);

  ctx.save();

  // Local player highlight aura
  if (isLocalPlayer) {
    ctx.beginPath();
    ctx.arc(x, y + 6, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Boots (Default or Cosmetic)
  const bootsId = equippedCosmetics?.boots;
  const bootsColor = bootsId && COSMETIC_CATALOG[bootsId] ? COSMETIC_CATALOG[bootsId].colorHex : '#1e293b';
  ctx.fillStyle = bootsColor;
  ctx.fillRect(x - 7, y + 2, 6, 10);
  ctx.fillRect(x + 1, y + 2, 6, 10);
  if (bootsId === 'Pahtama_Winged_Boots') {
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(x - 9, y + 4, 2, 5);
    ctx.fillRect(x + 7, y + 4, 2, 5);
  }

  // Clean Slate Sector-Colored Novice Tunic
  ctx.fillStyle = tunicColor;
  ctx.fillRect(x - 10, y - 10 + bob, 20, 14);

  // Outfit Overlay (e.g. Purple_CMHL_Apron or Indigo_Harvest_Cloak)
  const outfitId = equippedCosmetics?.outfit;
  if (outfitId && COSMETIC_CATALOG[outfitId]) {
    const item = COSMETIC_CATALOG[outfitId];
    ctx.fillStyle = item.colorHex;
    ctx.fillRect(x - 8, y - 8 + bob, 16, 12);
    ctx.fillStyle = item.accentHex;
    ctx.fillRect(x - 5, y - 6 + bob, 10, 4);
  } else {
    // Novice belt trim
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x - 10, y - 1 + bob, 20, 2);
  }

  // Head
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(x - 8, y - 22 + bob, 16, 12);

  // Eyes
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x - 5, y - 18 + bob, 3, 3);
  ctx.fillRect(x + 2, y - 18 + bob, 3, 3);

  // Glasses / Visor Cosmetic Overlay
  const glassesId = equippedCosmetics?.glasses;
  if (glassesId && COSMETIC_CATALOG[glassesId]) {
    const gItem = COSMETIC_CATALOG[glassesId];
    ctx.fillStyle = gItem.colorHex;
    ctx.fillRect(x - 7, y - 19 + bob, 14, 4);
  }

  // Hat Cosmetic Overlay
  const hatId = equippedCosmetics?.hat;
  if (hatId && COSMETIC_CATALOG[hatId]) {
    const hItem = COSMETIC_CATALOG[hatId];
    ctx.fillStyle = hItem.colorHex;
    ctx.fillRect(x - 10, y - 28 + bob, 20, 6);
    ctx.fillStyle = hItem.accentHex;
    ctx.fillRect(x - 6, y - 31 + bob, 12, 4);
  } else {
    // Hair
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x - 8, y - 25 + bob, 16, 4);
  }

  // Floating Pixel Pet Overlay
  const petId = equippedCosmetics?.pet;
  if (petId && COSMETIC_CATALOG[petId]) {
    const pItem = COSMETIC_CATALOG[petId];
    const px = x + 18 + Math.cos(tick * 0.12) * 3;
    const py = y - 18 + Math.sin(tick * 0.15) * 4;
    ctx.fillStyle = pItem.colorHex;
    ctx.fillRect(px - 5, py - 5, 10, 10);
    ctx.fillStyle = pItem.accentHex;
    ctx.fillRect(px - 2, py - 2, 4, 4);
  }

  // Name & Class Title Plate
  const label = `${name} • ${title}`;
  const lw = label.length * 5.6 + 12;
  ctx.fillStyle = isLocalPlayer ? 'rgba(2, 6, 23, 0.92)' : 'rgba(15, 23, 42, 0.78)';
  ctx.fillRect(x - lw / 2, y + 15, lw, 15);
  ctx.fillStyle = isLocalPlayer ? '#38bdf8' : '#e2e8f0';
  ctx.font = 'bold 9.5px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + 25);

  // Proximity In-Game Chat Bubble ("watercooler chat")
  if (chatBubble) {
    const maxBubbleText = chatBubble.length > 44 ? `${chatBubble.slice(0, 44)}…` : chatBubble;
    const bw = maxBubbleText.length * 6 + 16;
    const by = y - 48 + bob;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - bw / 2, by, bw, 18);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - bw / 2, by, bw, 18);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.fillText(maxBubbleText, x, by + 12);
  }

  ctx.restore();
}
