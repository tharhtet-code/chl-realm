import * as THREE from 'three';
import type {
  ColleaguePresence,
  PlayerState,
  QuestDefinition,
  TreasureChest,
  WorldId,
  WorldNpc,
  WorldPortal,
} from '../types/game';
import {
  WORLD_HEIGHT,
  WORLD_THEMES,
  WORLD_WIDTH,
} from '../worlds/worldDefinitions';
import {
  createFantasyCharacterRig,
  createFantasyChestMesh,
  createFantasyPropMesh,
  createFantasyWaygateMesh,
  createQuestRuneBeaconMesh,
  createTextBillboard,
  type FantasyCharacterRig,
  MAP_SCALE,
  mapToWorld3D,
  syncCharacterCosmetics,
  world3DToMap,
} from './fantasy3DModels';
import { disposeGroupGeometries } from './meshKit';
import {
  buildWorldLandscape,
  drawWorldMiniMap,
  type WorldMapPlan,
} from './worldLandscape';

export type InteractionTarget =
  | { type: 'npc'; npc: WorldNpc }
  | { type: 'quest_beacon'; quest: QuestDefinition }
  | { type: 'portal'; portal: WorldPortal }
  | { type: 'chest'; chest: TreasureChest };

export interface EngineCallbacks {
  onInteract: (target: InteractionTarget) => void;
  onProximityChange: (target: InteractionTarget | null) => void;
  onPositionUpdate: (x: number, y: number) => void;
}

export class AntigravityRealmCanvasEngine {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private raycaster = new THREE.Raycaster();
  private groundPlaneMesh!: THREE.Mesh;

  private getPlayer: () => PlayerState;
  private getQuests: () => QuestDefinition[];
  private getColleagues: () => ColleaguePresence[];
  private callbacks: EngineCallbacks;

  private worldEnvironmentGroup = new THREE.Group();
  private dynamicCharactersGroup = new THREE.Group();
  private playerRig!: FantasyCharacterRig;
  private npcRigs = new Map<string, FantasyCharacterRig>();
  private colleagueRigs = new Map<string, FantasyCharacterRig>();
  private guideLineMesh: THREE.Line | null = null;
  private magicParticles: THREE.Points | null = null;
  private currentMapPlan: WorldMapPlan | null = null;
  private miniMapCanvas: HTMLCanvasElement | null = null;
  private miniMapExpanded = false;

  private loadedWorldKey = '';
  private keysPressed = new Set<string>();
  private touchDirection: { dx: number; dy: number } = { dx: 0, dy: 0 };
  private walkTarget: { x: number; y: number } | null = null;
  private currentNearest: InteractionTarget | null = null;
  private tickCount = 0;
  private rafId = 0;
  private lastBroadcastTime = 0;
  private cameraYawOffset = 0;

  constructor(params: {
    canvas: HTMLCanvasElement;
    getPlayer: () => PlayerState;
    getQuests: () => QuestDefinition[];
    getColleagues: () => ColleaguePresence[];
    callbacks: EngineCallbacks;
  }) {
    this.canvas = params.canvas;
    this.getPlayer = params.getPlayer;
    this.getQuests = params.getQuests;
    this.getColleagues = params.getColleagues;
    this.callbacks = params.callbacks;

    // 1. Mobile-Optimized WebGLRenderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // 2. 3D Scene & Portrait-Tuned Follow Camera (340 far plane for 2x expanded worlds)
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, 9 / 16, 0.5, 340);

    this.scene.add(this.worldEnvironmentGroup);
    this.scene.add(this.dynamicCharactersGroup);

    // 3. Create Local Player 3D Chibi Fantasy Rig
    const player = this.getPlayer();
    this.playerRig = createFantasyCharacterRig({
      tunicColor: player.tunicColor,
      accentColor: '#38bdf8',
      isLocalPlayer: true,
    });
    this.scene.add(this.playerRig.group);

    this.handleResize();
    this.bindInputListeners();
  }

  private handleResize(): void {
    const parent = this.canvas.parentElement;
    const width = parent ? parent.clientWidth : window.innerWidth;
    const height = parent ? parent.clientHeight : window.innerHeight;
    if (width === 0 || height === 0) return;

    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    // Wider vertical FOV on narrow portrait phone screens so surrounding world is clearly visible
    this.camera.fov = this.camera.aspect < 0.85 ? 58 : 46;
    this.camera.updateProjectionMatrix();
  }

  private bindInputListeners(): void {
    window.addEventListener('resize', () => this.handleResize());

    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
      if (document.querySelector('dialog[open]')) return;

      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        this.walkTarget = null;
        this.keysPressed.add(key);
      } else if (key === ' ' || key === 'e' || key === 'enter') {
        e.preventDefault();
        this.triggerInteraction();
      } else if (key === 'q') {
        this.cameraYawOffset -= 0.25;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysPressed.delete(e.key.toLowerCase());
    });

    // Tap on 3D ground to walk toward that fantasy world coordinate
    this.canvas.addEventListener('pointerdown', (e) => {
      if (!this.groundPlaneMesh) return;
      const rect = this.canvas.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
      const hits = this.raycaster.intersectObject(this.groundPlaneMesh, false);
      if (hits.length > 0) {
        const pt = hits[0].point;
        const mapPt = world3DToMap(pt.x, pt.z);
        this.walkTarget = {
          x: Math.max(48, Math.min(WORLD_WIDTH - 48, mapPt.x)),
          y: Math.max(58, Math.min(WORLD_HEIGHT - 48, mapPt.y)),
        };
      }
    });
  }

  public setTouchDirection(dx: number, dy: number): void {
    this.walkTarget = null;
    this.touchDirection = { dx, dy };
  }

  public rotateCamera(deltaRadians: number): void {
    this.cameraYawOffset += deltaRadians;
  }

  public triggerInteraction(): void {
    if (this.currentNearest) {
      this.callbacks.onInteract(this.currentNearest);
    }
  }

  public rebuildWorldScene(): void {
    this.loadedWorldKey = '';
  }

  public attachMiniMap(canvas: HTMLCanvasElement): void {
    this.miniMapCanvas = canvas;
    canvas.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const mx = ((e.clientX - rect.left) / rect.width) * WORLD_WIDTH;
      const my = ((e.clientY - rect.top) / rect.height) * WORLD_HEIGHT;
      this.walkTarget = {
        x: Math.max(58, Math.min(WORLD_WIDTH - 58, mx)),
        y: Math.max(64, Math.min(WORLD_HEIGHT - 58, my)),
      };
    });
  }

  public setMiniMapExpanded(expanded: boolean): void {
    this.miniMapExpanded = expanded;
  }

  public start(): void {
    this.handleResize();
    const loop = () => {
      this.update();
      this.render3D();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  public stop(): void {
    cancelAnimationFrame(this.rafId);
  }

  private ensureWorldBuilt(): void {
    const player = this.getPlayer();
    const quests = this.getQuests().filter((q) => q.world === player.currentWorld);
    const stateSignature = [
      player.currentWorld,
      player.travelPassUnlocked ? 'pass' : 'locked',
      player.completedQuestIds.join(','),
      player.openedChestIds.join(','),
      quests.map((q) => q.quest_id).join(','),
    ].join('|');

    if (this.loadedWorldKey === stateSignature) return;
    this.loadedWorldKey = stateSignature;

    // Clear existing world environment cleanly
    disposeGroupGeometries(this.worldEnvironmentGroup);
    while (this.worldEnvironmentGroup.children.length > 0) {
      this.worldEnvironmentGroup.remove(this.worldEnvironmentGroup.children[0]);
    }
    this.npcRigs.clear();

    const theme = WORLD_THEMES[player.currentWorld];

    // Sky & Atmospheric Fog tuned for 2x expanded worlds
    this.scene.background = new THREE.Color(theme.wallHex);
    this.scene.fog = new THREE.FogExp2(theme.wallHex, 0.0052);

    // Ambient + Fantasy Directional Lights across 2x World
    const hemiLight = new THREE.HemisphereLight(theme.secondaryHex, theme.floorHexA, 1.4);
    hemiLight.position.set(0, 45, 0);
    const dirLight = new THREE.DirectionalLight('#ffffff', 1.45);
    dirLight.position.set(28, 42, 26);
    const pointLight = new THREE.PointLight(theme.accentHex, 2.6, 85);
    pointLight.position.set(0, 12, 0);
    this.worldEnvironmentGroup.add(hemiLight, dirLight, pointLight);

    // 2x Cartographic World Landscape (Sculpted Terrain + Roads + Trails + Water + Bridges + Scenery)
    const islandWidth = WORLD_WIDTH * MAP_SCALE;
    const islandDepth = WORLD_HEIGHT * MAP_SCALE;
    const landscape = buildWorldLandscape(theme, quests);
    this.groundPlaneMesh = landscape.groundMesh;
    this.currentMapPlan = landscape.plan;
    this.worldEnvironmentGroup.add(landscape.group);

    // Glowing Fantasy Perimeter Border Pillars on 2x Corners
    const borderMat = new THREE.MeshStandardMaterial({
      color: theme.primaryHex === '#0f172a' ? '#94a3b8' : theme.primaryHex,
      emissive: theme.accentHex,
      emissiveIntensity: 0.22,
    });
    const hw = islandWidth / 2 - 1.6;
    const hd = islandDepth / 2 - 1.6;
    const corners: [number, number][] = [
      [-hw, -hd],
      [hw, -hd],
      [-hw, hd],
      [hw, hd],
    ];
    for (const [cx, cz] of corners) {
      const obelisk = new THREE.Mesh(new THREE.ConeGeometry(1.05, 4.4, 8), borderMat);
      obelisk.position.set(cx, 2.2, cz);
      this.worldEnvironmentGroup.add(obelisk);
    }

    // 1. Add 3D Fantasy Biome Props
    for (const prop of theme.props) {
      const propMesh = createFantasyPropMesh(prop, theme);
      this.worldEnvironmentGroup.add(propMesh);
    }

    // 2. Add 3D Rune Waygate Portals
    for (const portal of theme.portals) {
      const isAllowed =
        !portal.requiresTravelPass ||
        player.travelPassUnlocked ||
        portal.targetWorld === player.homeWorld ||
        portal.targetWorld === 'The_HUB';
      const portalMesh = createFantasyWaygateMesh(portal, isAllowed);
      this.worldEnvironmentGroup.add(portalMesh);
    }

    // 3. Add 3D Q1 Integrity Campaign Treasure Chests
    for (const chest of theme.chests) {
      const isOpened = player.openedChestIds.includes(chest.id);
      const chestMesh = createFantasyChestMesh(chest, isOpened);
      this.worldEnvironmentGroup.add(chestMesh);
    }

    // 4. Add 3D Quest Rune Beacons ([210, 440], etc.)
    for (const quest of quests) {
      const isDone = player.completedQuestIds.includes(quest.quest_id);
      const beaconMesh = createQuestRuneBeaconMesh(
        quest.spawn_location,
        quest.title || quest.quest_id,
        isDone
      );
      this.worldEnvironmentGroup.add(beaconMesh);
    }

    // 5. Add 3D NPCs (Guild Master Su, Coach Ohnmar, Tailor Daw Khin, etc.)
    for (const npc of theme.npcs) {
      const isDone = npc.questId ? player.completedQuestIds.includes(npc.questId) : false;
      const npcRig = createFantasyCharacterRig({
        tunicColor: npc.primaryColor,
        accentColor: npc.accentColor,
      });
      syncCharacterCosmetics(npcRig, npc.primaryColor, {
        hat: 'Golden_Pagoda_Brim',
      });

      const badgeText =
        npc.role === 'tailor'
          ? '♦ MYSTIC TAILOR'
          : npc.role === 'leaderboard_keeper'
            ? '★ HALL OF LEGENDS'
            : isDone
              ? '✓ QUEST CLEARED'
              : '! GUILD QUEST';
      const badgeColor =
        npc.role === 'tailor'
          ? '#f472b6'
          : npc.role === 'leaderboard_keeper'
            ? '#38bdf8'
            : isDone
              ? '#4ade80'
              : '#facc15';

      npcRig.group.remove(npcRig.billboard);
      npcRig.billboard = createTextBillboard({
        title: npc.name,
        subtitle: npc.title,
        badge: badgeText,
        badgeColor,
      });
      npcRig.billboard.position.set(0, 3.55, 0);
      npcRig.group.add(npcRig.billboard);

      const { wx, wz } = mapToWorld3D(npc.x, npc.y);
      npcRig.group.position.set(wx, 0, wz);
      this.worldEnvironmentGroup.add(npcRig.group);
      this.npcRigs.set(npc.id, npcRig);
    }

    // 6. Floating Ambient Magic Starlight Particles across 2x Map
    const particleCount = 180;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * islandWidth;
      positions[i * 3 + 1] = 0.7 + Math.random() * 9.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * islandDepth;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: theme.accentHex,
      size: 0.24,
      transparent: true,
      opacity: 0.75,
    });
    this.magicParticles = new THREE.Points(particleGeo, particleMat);
    this.worldEnvironmentGroup.add(this.magicParticles);
  }

  private update(): void {
    this.tickCount++;
    this.ensureWorldBuilt();

    const player = this.getPlayer();
    const speed = player.equippedCosmetics.boots === 'Pahtama_Winged_Boots' ? 5.25 : 4.2;

    let dx = this.touchDirection.dx;
    let dy = this.touchDirection.dy;

    if (this.keysPressed.has('w') || this.keysPressed.has('arrowup')) dy -= 1;
    if (this.keysPressed.has('s') || this.keysPressed.has('arrowdown')) dy += 1;
    if (this.keysPressed.has('a') || this.keysPressed.has('arrowleft')) dx -= 1;
    if (this.keysPressed.has('d') || this.keysPressed.has('arrowright')) dx += 1;

    if (dx === 0 && dy === 0 && this.walkTarget) {
      const distX = this.walkTarget.x - player.x;
      const distY = this.walkTarget.y - player.y;
      const dist = Math.hypot(distX, distY);
      if (dist > 4) {
        dx = distX / dist;
        dy = distY / dist;
      } else {
        this.walkTarget = null;
      }
    }

    const isMoving = dx !== 0 || dy !== 0;

    if (isMoving) {
      const len = Math.hypot(dx, dy) || 1;
      player.x = Math.max(48, Math.min(WORLD_WIDTH - 48, player.x + (dx / len) * speed));
      player.y = Math.max(58, Math.min(WORLD_HEIGHT - 48, player.y + (dy / len) * speed));

      // Rotate 3D character cleanly toward movement direction
      const targetAngle = Math.atan2(dx, dy);
      this.playerRig.group.rotation.y = targetAngle;

      const now = Date.now();
      if (now - this.lastBroadcastTime > 200) {
        this.lastBroadcastTime = now;
        this.callbacks.onPositionUpdate(Math.round(player.x), Math.round(player.y));
      }
    }

    // Update Local Player 3D Position, Cosmetics & Walk Cycle Animation
    const { wx, wz } = mapToWorld3D(player.x, player.y);
    this.playerRig.group.position.set(wx, 0, wz);
    this.animateCharacterRig(this.playerRig, isMoving, this.tickCount);

    const activeBubble =
      player.chatBubble && player.chatBubbleExpiresAt > Date.now() ? player.chatBubble : null;
    const playerSig = [
      player.name,
      player.classTitle,
      player.tunicColor,
      JSON.stringify(player.equippedCosmetics),
      activeBubble || '',
    ].join('|');

    if (this.playerRig.lastSignature !== playerSig) {
      this.playerRig.lastSignature = playerSig;
      syncCharacterCosmetics(this.playerRig, player.tunicColor, player.equippedCosmetics);
      this.playerRig.group.remove(this.playerRig.billboard);
      this.playerRig.billboard = createTextBillboard({
        title: player.name,
        subtitle: player.classTitle,
        chatBubble: activeBubble,
        isPrimary: true,
      });
      this.playerRig.billboard.position.set(0, 3.45, 0);
      this.playerRig.group.add(this.playerRig.billboard);
    }

    // Update Multiplayer Colleagues in 3D
    this.syncColleagues3D(player);

    // Update Portrait-Optimized 3D Follow Camera
    const isPortrait = this.camera.aspect < 0.85;
    const camDist = isPortrait ? 18.2 : 15.4;
    const camHeight = isPortrait ? 15.8 : 13.0;
    const targetCamX = wx + Math.sin(this.cameraYawOffset) * camDist;
    const targetCamZ = wz + Math.cos(this.cameraYawOffset) * camDist;

    this.camera.position.lerp(new THREE.Vector3(targetCamX, camHeight, targetCamZ), 0.12);
    this.camera.lookAt(wx, 1.5, wz - (isPortrait ? 1.4 : 0));

    // Animate spinning runes, quest crystals, Bagan hot-air balloons, cranes, smoke, and NPCs
    this.worldEnvironmentGroup.traverse((obj) => {
      if (obj.name === 'spin_ring' || obj.name === 'quest_crystal') {
        obj.rotation.y += 0.032;
      } else if (obj.name === 'portal_vortex') {
        obj.rotation.z -= 0.04;
      } else if (obj.name === 'float_balloon') {
        obj.position.y = 5.4 + Math.sin(this.tickCount * 0.035 + obj.id) * 0.65;
        obj.rotation.y += 0.006;
      } else if (obj.name === 'crane_slew') {
        obj.rotation.y = Math.sin(this.tickCount * 0.012 + obj.id) * 0.45;
      } else if (obj.name === 'smoke_puff') {
        obj.scale.setScalar(1 + Math.sin(this.tickCount * 0.06 + obj.id) * 0.14);
      }
    });

    for (const npcRig of this.npcRigs.values()) {
      this.animateCharacterRig(npcRig, false, this.tickCount + 20);
    }

    if (this.magicParticles) {
      this.magicParticles.rotation.y += 0.0012;
    }

    // Update Live 2D Cartographic Mini-Map HUD every 3 ticks
    if (this.miniMapCanvas && this.currentMapPlan && this.tickCount % 3 === 0) {
      drawWorldMiniMap({
        canvas: this.miniMapCanvas,
        theme: WORLD_THEMES[player.currentWorld],
        plan: this.currentMapPlan,
        player,
        quests: this.getQuests().filter((q) => q.world === player.currentWorld),
        colleagues: this.getColleagues(),
        tick: this.tickCount,
        expanded: this.miniMapExpanded,
      });
    }

    // Update Nearest Interactive Object
    const nearest = this.findNearestInteractive(player);
    const prevKey = this.serializeTarget(this.currentNearest);
    const nextKey = this.serializeTarget(nearest);
    if (prevKey !== nextKey) {
      this.currentNearest = nearest;
      this.callbacks.onProximityChange(nearest);
    }
  }

  private animateCharacterRig(
    rig: FantasyCharacterRig,
    isMoving: boolean,
    tick: number
  ): void {
    if (isMoving) {
      const swing = Math.sin(tick * 0.28) * 0.55;
      rig.leftLeg.rotation.x = swing;
      rig.rightLeg.rotation.x = -swing;
      rig.leftArm.rotation.x = -swing * 0.7;
      rig.rightArm.rotation.x = swing * 0.7;
      rig.bodyMesh.position.y = 1.05 + Math.abs(Math.sin(tick * 0.28)) * 0.08;
    } else {
      rig.leftLeg.rotation.x = 0;
      rig.rightLeg.rotation.x = 0;
      rig.leftArm.rotation.x = 0;
      rig.rightArm.rotation.x = Math.sin(tick * 0.08) * 0.1;
      rig.bodyMesh.position.y = 1.05 + Math.sin(tick * 0.08) * 0.04;
    }
    rig.staffOrb.rotation.y += 0.06;

    if (rig.petMesh) {
      rig.petMesh.position.x = Math.cos(tick * 0.07) * 1.15;
      rig.petMesh.position.z = Math.sin(tick * 0.07) * 1.15;
      rig.petMesh.position.y = 2.25 + Math.sin(tick * 0.14) * 0.18;
      rig.petMesh.rotation.y += 0.05;
    }
  }

  private syncColleagues3D(player: PlayerState): void {
    const colleagues = this.getColleagues();
    const activeIds = new Set<string>();

    for (const c of colleagues) {
      if (c.uid === player.uid) continue;
      activeIds.add(c.uid);

      let rig = this.colleagueRigs.get(c.uid);
      if (!rig) {
        rig = createFantasyCharacterRig({
          tunicColor: c.tunicColor,
          accentColor: '#fde047',
        });
        syncCharacterCosmetics(rig, c.tunicColor, c.hat ? { hat: c.hat } : undefined);
        this.dynamicCharactersGroup.add(rig.group);
        this.colleagueRigs.set(c.uid, rig);
      }

      const { wx, wz } = mapToWorld3D(c.x, c.y);
      const prevX = rig.group.position.x;
      const prevZ = rig.group.position.z;
      rig.group.position.set(wx, 0, wz);

      if (Math.hypot(wx - prevX, wz - prevZ) > 0.005) {
        rig.group.rotation.y = Math.atan2(wx - prevX, wz - prevZ);
      }
      this.animateCharacterRig(rig, true, this.tickCount + 15);

      const distToPlayer = Math.hypot(c.x - player.x, c.y - player.y);
      const visibleChat = distToPlayer < 175 ? c.chatBubble || '' : '';
      const sig = `${c.name}|${c.title}|${visibleChat}`;
      if (rig.lastSignature !== sig) {
        rig.lastSignature = sig;
        rig.group.remove(rig.billboard);
        rig.billboard = createTextBillboard({
          title: c.name,
          subtitle: c.title,
          chatBubble: visibleChat || null,
        });
        rig.billboard.position.set(0, 3.4, 0);
        rig.group.add(rig.billboard);
      }
    }

    // Remove colleagues who left the current world
    for (const [uid, rig] of this.colleagueRigs.entries()) {
      if (!activeIds.has(uid)) {
        this.dynamicCharactersGroup.remove(rig.group);
        this.colleagueRigs.delete(uid);
      }
    }

    // Update 3D Glowing Quest Ley-Line Guide
    if (this.guideLineMesh) {
      this.scene.remove(this.guideLineMesh);
      this.guideLineMesh = null;
    }

    const activeQuest = this.getQuests().find(
      (q) =>
        q.world === player.currentWorld &&
        q.quest_id === player.activeQuestId &&
        !player.completedQuestIds.includes(q.quest_id)
    );
    if (activeQuest) {
      const p3 = mapToWorld3D(player.x, player.y);
      const q3 = mapToWorld3D(activeQuest.spawn_location[0], activeQuest.spawn_location[1]);
      const pts = [
        new THREE.Vector3(p3.wx, 0.25, p3.wz),
        new THREE.Vector3((p3.wx + q3.wx) / 2, 0.85, (p3.wz + q3.wz) / 2),
        new THREE.Vector3(q3.wx, 0.45, q3.wz),
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineBasicMaterial({ color: '#facc15' });
      this.guideLineMesh = new THREE.Line(lineGeo, lineMat);
      this.scene.add(this.guideLineMesh);
    }
  }

  private serializeTarget(target: InteractionTarget | null): string {
    if (!target) return 'none';
    switch (target.type) {
      case 'npc':
        return `npc:${target.npc.id}`;
      case 'quest_beacon':
        return `quest:${target.quest.quest_id}`;
      case 'portal':
        return `portal:${target.portal.id}`;
      case 'chest':
        return `chest:${target.chest.id}`;
    }
  }

  private findNearestInteractive(player: PlayerState): InteractionTarget | null {
    const theme = WORLD_THEMES[player.currentWorld];
    const quests = this.getQuests().filter((q) => q.world === player.currentWorld);
    let bestDist = 76;
    let bestTarget: InteractionTarget | null = null;

    for (const q of quests) {
      const [qx, qy] = q.spawn_location;
      const d = Math.hypot(player.x - qx, player.y - qy);
      if (d < bestDist) {
        bestDist = d;
        bestTarget = { type: 'quest_beacon', quest: q };
      }
    }

    for (const npc of theme.npcs) {
      const d = Math.hypot(player.x - npc.x, player.y - npc.y);
      if (d < bestDist) {
        bestDist = d;
        bestTarget = { type: 'npc', npc };
      }
    }

    for (const chest of theme.chests) {
      if (player.openedChestIds.includes(chest.id)) continue;
      const d = Math.hypot(player.x - chest.x, player.y - chest.y);
      if (d < bestDist) {
        bestDist = d;
        bestTarget = { type: 'chest', chest };
      }
    }

    for (const portal of theme.portals) {
      const d = Math.hypot(player.x - portal.x, player.y - portal.y);
      if (d < bestDist) {
        bestDist = d;
        bestTarget = { type: 'portal', portal };
      }
    }

    return bestTarget;
  }

  private render3D(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
