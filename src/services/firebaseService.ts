import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  getDocs,
  type Firestore,
} from 'firebase/firestore';
import {
  getDatabase,
  ref,
  set,
  onValue,
  type Database,
} from 'firebase/database';
import type {
  BusinessUnitId,
  ColleaguePresence,
  PlayerState,
  QuestDefinition,
  WorldId,
  XApiStatementRecord,
} from '../types/game';
import { SECTOR_METADATA, WORLD_THEMES } from '../worlds/worldDefinitions';

const STORAGE_KEY_PLAYER = 'chr_player_state_v1';
const STORAGE_KEY_XAPI = 'chr_xapi_logs_v1';

export interface IndividualLeaderEntry {
  rank: number;
  name: string;
  sectorId: BusinessUnitId;
  title: string;
  monthlyXp: number;
  badgesCount: number;
  isCurrentUser?: boolean;
}

export interface SectorLeaderEntry {
  rank: number;
  sectorId: BusinessUnitId;
  sectorName: string;
  teamColorName: string;
  colorHex: string;
  completionRatePct: number;
  activeLearners: number;
  totalQuestsCleared: number;
}

class RealmBackendService {
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;
  private rtdb: Database | null = null;
  public isLiveFirebase = false;

  private simulatedColleagues: ColleaguePresence[] = [
    {
      uid: 'bot_01',
      name: 'Ma Thandar (CMHL)',
      sectorId: 'CMHL',
      world: 'The_HUB',
      x: 590,
      y: 510,
      vx: 0.72,
      vy: 0.32,
      tunicColor: '#9333ea',
      title: 'Plaza Operations Ranger',
      hat: 'Golden_Pagoda_Brim',
      chatBubble: 'Just finished Coach Ohnmar’s POS Integrity quiz! +200 XP!',
    },
    {
      uid: 'bot_02',
      name: 'Ko Zarni (CityVentures)',
      sectorId: 'CityVentures',
      world: 'The_HUB',
      x: 910,
      y: 520,
      vx: -0.64,
      vy: 0.40,
      tunicColor: '#10b981',
      title: 'Venture Systems Ranger',
      hat: 'Ventures_Cyber_Visor',
      chatBubble: 'Green Team is climbing the Sector Leaderboard today!',
    },
    {
      uid: 'bot_03',
      name: 'Su Hlaing (Pahtama)',
      sectorId: 'Pahtama',
      world: 'The_HUB',
      x: 760,
      y: 610,
      vx: 0.56,
      vy: -0.56,
      tunicColor: '#0284c7',
      title: 'Supply Chain Knight',
      hat: 'Golden_Safety_Hardhat',
      chatBubble: 'Unlocked my Cross-World Travel Pass from Guild Master Su!',
    },
    {
      uid: 'bot_04',
      name: 'Nandar Oo (CMHL)',
      sectorId: 'CMHL',
      world: 'Retail_Realm',
      x: 580,
      y: 480,
      vx: 0.80,
      vy: 0.24,
      tunicColor: '#9333ea',
      title: 'Retail Steward',
      chatBubble: 'Heading to [210, 440] for val_integrity_01!',
    },
    {
      uid: 'bot_05',
      name: 'Min Khant (CityFood)',
      sectorId: 'CityFood',
      world: 'Food_Beverage_District',
      x: 700,
      y: 520,
      vx: -0.72,
      vy: 0.32,
      tunicColor: '#dc2626',
      title: 'Hospitality Ranger',
      hat: 'Chef_Toque_Crown',
      chatBubble: '4°C cold-chain check complete in the bakery!',
    },
    {
      uid: 'bot_06',
      name: 'Wai Yan (BrandOrigins)',
      sectorId: 'BrandOrigins',
      world: 'Manufacturing_Agri_Zone',
      x: 540,
      y: 560,
      vx: 0.64,
      vy: -0.48,
      tunicColor: '#312e81',
      title: 'Quality Origin Ranger',
      chatBubble: 'QR batch traceability verified from farm to pack!',
    },
    {
      uid: 'bot_07',
      name: 'Htet Lin (CityVentures)',
      sectorId: 'CityVentures',
      world: 'Ventures_Valley',
      x: 820,
      y: 480,
      vx: -0.56,
      vy: 0.56,
      tunicColor: '#10b981',
      title: 'Digital Node Runner',
      chatBubble: 'Quantum Rack #07 SCORM briefing was super clear.',
    },
    {
      uid: 'bot_08',
      name: 'Aye Chan (CityProperties)',
      sectorId: 'CityProperties',
      world: 'Property_Estates',
      x: 580,
      y: 510,
      vx: 0.64,
      vy: 0.40,
      tunicColor: '#2563eb',
      title: 'Blueprint Warden',
      hat: 'Golden_Safety_Hardhat',
      chatBubble: 'Permit-to-Work safety perimeter checked!',
    },
    {
      uid: 'bot_09',
      name: 'Kyaw Swar (Pahtama)',
      sectorId: 'Pahtama',
      world: 'Distribution_Badlands',
      x: 840,
      y: 490,
      vx: -0.80,
      vy: -0.32,
      tunicColor: '#0284c7',
      title: 'Distribution Ranger',
      chatBubble: 'FEFO dispatch locked in at Loading Dock Matrix!',
    },
  ];

  private watercoolerLines = [
    'Doing my 15-min P.A.C.E. daily learning burst!',
    'Have you found the Q1 Integrity chest in this zone yet?',
    'Trying to evolve from Distribution Ranger to Supply Chain Knight!',
    'Tailor Daw Khin has the new Bit-Pixie companion in The HUB!',
    'Our Business Unit is only 2% behind first place on the Notice Board!',
    'Clean Slate rule is awesome—everyone earns their rank through learning!',
  ];

  constructor() {
    this.initFirebaseIfConfigured();
  }

  private initFirebaseIfConfigured() {
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    if (apiKey && projectId) {
      try {
        this.app = initializeApp({
          apiKey,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
          projectId,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID,
        });
        this.db = getFirestore(this.app);
        if (import.meta.env.VITE_FIREBASE_DATABASE_URL) {
          this.rtdb = getDatabase(this.app);
        }
        this.isLiveFirebase = true;
      } catch {
        this.isLiveFirebase = false;
      }
    }
  }

  /**
   * Creates or restores the Clean Slate Level 1 Novice player profile,
   * dropping them directly into the World matching their Keycloak OIDC SSO Business Unit claim.
   */
  public loadOrCreatePlayer(ssoSector: BusinessUnitId = 'CMHL', customName?: string): PlayerState {
    const MAP_2X_FLAG = 'chl_realm_map_v2x_migrated';
    const raw = localStorage.getItem(STORAGE_KEY_PLAYER);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as PlayerState;
        if (!localStorage.getItem(MAP_2X_FLAG)) {
          const wTheme = WORLD_THEMES[parsed.currentWorld] || WORLD_THEMES.The_HUB;
          parsed.x = wTheme.spawnsAt[0];
          parsed.y = wTheme.spawnsAt[1];
          localStorage.setItem(MAP_2X_FLAG, '1');
          this.savePlayerState(parsed);
        }
        return parsed;
      } catch {
        // Re-initialize on corrupt state
      }
    }
    localStorage.setItem(MAP_2X_FLAG, '1');
    return this.createCleanSlatePlayer(ssoSector, customName);
  }

  public createCleanSlatePlayer(sectorId: BusinessUnitId, customName = 'Aung Myint'): PlayerState {
    const meta = SECTOR_METADATA[sectorId];
    const hubTheme = WORLD_THEMES.The_HUB;

    const state: PlayerState = {
      uid: `emp_${sectorId.toLowerCase()}_01`,
      name: customName,
      email: `${customName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@${sectorId.toLowerCase()}.cityholdings.com`,
      sectorId,
      homeWorld: meta.worldId,
      currentWorld: 'The_HUB', // The Hub (Ancient Bagan) is Home Base
      x: hubTheme.spawnsAt[0],
      y: hubTheme.spawnsAt[1],
      facing: 'down',
      tunicColor: meta.tunicHex,
      xp: 0,
      coins: 120,
      level: 1,
      classTitle: meta.classLadder[0],
      travelPassUnlocked: false,
      activeQuestId: null,
      completedQuestIds: [],
      openedChestIds: [],
      badges: [],
      unlockedCosmetics: [],
      equippedCosmetics: {},
      pace: {
        planCompleted: false,
        assessCompleted: false,
        completeCompleted: false,
        evaluateCompleted: false,
      },
      sessionStartedAt: Date.now(),
      chatBubble: `Arrived at Home Base: The Hub (Ancient Bagan)!`,
      chatBubbleExpiresAt: Date.now() + 7000,
    };

    this.savePlayerState(state);
    return state;
  }

  public switchSsoBusinessUnit(state: PlayerState, newSector: BusinessUnitId, employeeName?: string): PlayerState {
    const meta = SECTOR_METADATA[newSector];
    const worldTheme = WORLD_THEMES[meta.worldId];
    const levelIdx = Math.min(3, Math.floor(state.xp / 200));

    const updated: PlayerState = {
      ...state,
      name: employeeName?.trim() || state.name,
      email: `${(employeeName || state.name).toLowerCase().replace(/[^a-z0-9]/g, '.')}@${newSector.toLowerCase()}.cityholdings.com`,
      sectorId: newSector,
      homeWorld: meta.worldId,
      currentWorld: meta.worldId,
      x: worldTheme.spawnsAt[0],
      y: worldTheme.spawnsAt[1],
      tunicColor: meta.tunicHex,
      classTitle: meta.classLadder[levelIdx],
      chatBubble: `SSO Login: Spawned in ${meta.worldName} (${newSector})!`,
      chatBubbleExpiresAt: Date.now() + 6500,
    };

    this.savePlayerState(updated);
    return updated;
  }

  public savePlayerState(state: PlayerState): void {
    localStorage.setItem(STORAGE_KEY_PLAYER, JSON.stringify(state));

    if (this.isLiveFirebase && this.db) {
      setDoc(doc(this.db, 'players', state.uid), {
        uid: state.uid,
        name: state.name,
        email: state.email,
        sectorId: state.sectorId,
        xp: state.xp,
        monthlyXp: state.xp,
        coins: state.coins,
        level: state.level,
        classTitle: state.classTitle,
        badges: state.badges,
        completedQuestIds: state.completedQuestIds,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }
  }

  public broadcastPresence(state: PlayerState): void {
    if (this.isLiveFirebase && this.rtdb) {
      const presenceRef = ref(this.rtdb, `presence/${state.currentWorld}/${state.uid}`);
      set(presenceRef, {
        uid: state.uid,
        name: state.name,
        sectorId: state.sectorId,
        world: state.currentWorld,
        x: Math.round(state.x),
        y: Math.round(state.y),
        tunicColor: state.tunicColor,
        title: state.classTitle,
        chatBubble: state.chatBubbleExpiresAt > Date.now() ? state.chatBubble : null,
        updatedAt: Date.now(),
      }).catch(() => {});
    }
  }

  public subscribeWorldPresence(
    worldId: WorldId,
    onUpdate: (colleagues: ColleaguePresence[]) => void
  ): () => void {
    if (this.isLiveFirebase && this.rtdb) {
      const worldRef = ref(this.rtdb, `presence/${worldId}`);
      const unsub = onValue(worldRef, (snap) => {
        const val = snap.val() || {};
        const list = Object.values(val) as ColleaguePresence[];
        onUpdate(list);
      });
      return () => unsub();
    }
    return () => {};
  }

  public tickSimulatedColleagues(worldId: WorldId): ColleaguePresence[] {
    const now = Date.now();
    const inWorld = this.simulatedColleagues.filter((c) => c.world === worldId);

    for (const bot of inWorld) {
      bot.x += bot.vx;
      bot.y += bot.vy;

      if (bot.x < 220 || bot.x > 1300) bot.vx *= -1;
      if (bot.y < 220 || bot.y > 700) bot.vy *= -1;

      if (Math.random() < 0.004) {
        bot.chatBubble =
          this.watercoolerLines[Math.floor(Math.random() * this.watercoolerLines.length)];
        bot.chatExpiresAt = now + 8000;
      }
    }

    return inWorld;
  }

  /**
   * Translates an in-game quest completion into a standard ADL xAPI 1.0.3 statement
   * and logs/dispatches it to the LMS Gateway.
   */
  public dispatchXApiStatement(params: {
    player: PlayerState;
    quest: QuestDefinition;
    score: number;
    maxScore: number;
  }): XApiStatementRecord {
    const id = crypto.randomUUID ? crypto.randomUUID() : `xapi_${Date.now()}`;
    const timestamp = new Date().toISOString();
    const scaled = params.maxScore > 0 ? Number((params.score / params.maxScore).toFixed(2)) : 1;

    const rawJson = {
      id,
      actor: {
        objectType: 'Agent',
        name: params.player.name,
        mbox: `mailto:${params.player.email}`,
        account: {
          homePage: 'https://sso.cityholdings.com/realms/city-holdings',
          name: params.player.email,
        },
      },
      verb: {
        id: 'http://adlnet.gov/expapi/verbs/completed',
        display: { 'en-US': 'completed' },
      },
      object: {
        objectType: 'Activity',
        id: `https://lms.cityholdings.com/activities/${params.quest.lms_hook}`,
        definition: {
          name: { 'en-US': `${params.quest.title || params.quest.quest_id}` },
          description: {
            'en-US': `CHL Realm quest (${params.quest.quest_id}) in ${params.quest.world} under campaign ${params.quest.campaign}`,
          },
          type: 'http://adlnet.gov/expapi/activities/assessment',
        },
      },
      result: {
        score: {
          scaled,
          raw: params.score,
          min: 0,
          max: params.maxScore,
        },
        success: true,
        completion: true,
        duration: 'PT120S',
        extensions: {
          'https://realm.cityholdings.com/xapi/ext/xp_earned': params.quest.rewards.xp,
          'https://realm.cityholdings.com/xapi/ext/badge': params.quest.rewards.badge,
          'https://realm.cityholdings.com/xapi/ext/item_unlock': params.quest.rewards.item_unlock,
        },
      },
      context: {
        platform: 'CHL Realm (Antigravity 3D Engine)',
        extensions: {
          'https://realm.cityholdings.com/xapi/ext/business_unit': params.player.sectorId,
          'https://realm.cityholdings.com/xapi/ext/world': params.quest.world,
          'https://realm.cityholdings.com/xapi/ext/campaign': params.quest.campaign,
        },
      },
      timestamp,
    };

    const record: XApiStatementRecord = {
      id,
      timestamp,
      questId: params.quest.quest_id,
      lmsHook: params.quest.lms_hook,
      world: params.quest.world,
      scoreRatio: `${params.score}/${params.maxScore}`,
      xpEarned: params.quest.rewards.xp,
      rawJson,
    };

    const existing = this.getXApiLogs();
    existing.unshift(record);
    localStorage.setItem(STORAGE_KEY_XAPI, JSON.stringify(existing.slice(0, 30)));

    return record;
  }

  public getXApiLogs(): XApiStatementRecord[] {
    const raw = localStorage.getItem(STORAGE_KEY_XAPI);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as XApiStatementRecord[];
    } catch {
      return [];
    }
  }

  public getIndividualLeaderboard(player: PlayerState): IndividualLeaderEntry[] {
    const baseEntries: Omit<IndividualLeaderEntry, 'rank'>[] = [
      {
        name: 'Su Hlaing',
        sectorId: 'Pahtama',
        title: 'Supply Chain Knight',
        monthlyXp: 920,
        badgesCount: 5,
      },
      {
        name: 'Ko Zarni',
        sectorId: 'CityVentures',
        title: 'Cyber Innovation Architect',
        monthlyXp: 860,
        badgesCount: 4,
      },
      {
        name: 'Ma Thandar',
        sectorId: 'CMHL',
        title: 'Plaza Operations Ranger',
        monthlyXp: 780,
        badgesCount: 4,
      },
      {
        name: 'Min Khant',
        sectorId: 'CityFood',
        title: 'Hospitality Ranger',
        monthlyXp: 640,
        badgesCount: 3,
      },
      {
        name: 'Wai Yan',
        sectorId: 'BrandOrigins',
        title: 'Quality Origin Ranger',
        monthlyXp: 590,
        badgesCount: 3,
      },
      {
        name: 'Aye Chan',
        sectorId: 'CityProperties',
        title: 'Blueprint Warden',
        monthlyXp: 480,
        badgesCount: 2,
      },
      {
        name: `${player.name} (You)`,
        sectorId: player.sectorId,
        title: player.classTitle,
        monthlyXp: player.xp,
        badgesCount: player.badges.length,
        isCurrentUser: true,
      },
    ];

    baseEntries.sort((a, b) => b.monthlyXp - a.monthlyXp);
    return baseEntries.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }

  public getSectorLeaderboard(player: PlayerState): SectorLeaderEntry[] {
    const bonusPct = Math.min(18, Math.floor(player.xp / 80));
    const sectors: Omit<SectorLeaderEntry, 'rank'>[] = [
      {
        sectorId: 'CMHL',
        sectorName: 'Retail Realm (CMHL)',
        teamColorName: 'Vibrant Purple Team',
        colorHex: '#9333ea',
        completionRatePct: 84 + (player.sectorId === 'CMHL' ? bonusPct : 0),
        activeLearners: 1420,
        totalQuestsCleared: 4890 + (player.sectorId === 'CMHL' ? player.completedQuestIds.length : 0),
      },
      {
        sectorId: 'CityVentures',
        sectorName: 'Ventures Valley (City Ventures)',
        teamColorName: 'Tech Green Team',
        colorHex: '#10b981',
        completionRatePct: 86 + (player.sectorId === 'CityVentures' ? bonusPct : 0),
        activeLearners: 310,
        totalQuestsCleared: 1290 + (player.sectorId === 'CityVentures' ? player.completedQuestIds.length : 0),
      },
      {
        sectorId: 'Pahtama',
        sectorName: 'Distribution Badlands (Pahtama)',
        teamColorName: 'Light Blue & Gold Team',
        colorHex: '#f59e0b',
        completionRatePct: 83 + (player.sectorId === 'Pahtama' ? bonusPct : 0),
        activeLearners: 890,
        totalQuestsCleared: 3120 + (player.sectorId === 'Pahtama' ? player.completedQuestIds.length : 0),
      },
      {
        sectorId: 'CityFood',
        sectorName: 'Food & Beverage (CityFood)',
        teamColorName: 'Energetic Red Team',
        colorHex: '#dc2626',
        completionRatePct: 81 + (player.sectorId === 'CityFood' ? bonusPct : 0),
        activeLearners: 760,
        totalQuestsCleared: 2540 + (player.sectorId === 'CityFood' ? player.completedQuestIds.length : 0),
      },
      {
        sectorId: 'BrandOrigins',
        sectorName: 'Mfg & Agriculture (Brand Origins)',
        teamColorName: 'Deep Indigo Team',
        colorHex: '#4f46e5',
        completionRatePct: 79 + (player.sectorId === 'BrandOrigins' ? bonusPct : 0),
        activeLearners: 640,
        totalQuestsCleared: 2110 + (player.sectorId === 'BrandOrigins' ? player.completedQuestIds.length : 0),
      },
      {
        sectorId: 'CityProperties',
        sectorName: 'Property Estates (City Properties)',
        teamColorName: 'Corporate Blue Team',
        colorHex: '#2563eb',
        completionRatePct: 78 + (player.sectorId === 'CityProperties' ? bonusPct : 0),
        activeLearners: 410,
        totalQuestsCleared: 1380 + (player.sectorId === 'CityProperties' ? player.completedQuestIds.length : 0),
      },
    ];

    for (const s of sectors) {
      s.completionRatePct = Math.min(100, s.completionRatePct);
    }

    sectors.sort((a, b) => b.completionRatePct - a.completionRatePct);
    return sectors.map((s, i) => ({
      ...s,
      rank: i + 1,
    }));
  }

  public async fetchFirestoreQuests(): Promise<QuestDefinition[] | null> {
    if (!this.isLiveFirebase || !this.db) return null;
    try {
      const snap = await getDocs(collection(this.db, 'quests'));
      if (snap.empty) return null;
      return snap.docs.map((d) => d.data() as QuestDefinition);
    } catch {
      return null;
    }
  }
}

export const realmBackend = new RealmBackendService();
