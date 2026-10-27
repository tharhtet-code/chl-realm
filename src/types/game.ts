export type WorldId =
  | 'The_HUB'
  | 'Retail_Realm'
  | 'Food_Beverage_District'
  | 'Manufacturing_Agri_Zone'
  | 'Ventures_Valley'
  | 'Property_Estates'
  | 'Distribution_Badlands';

export type BusinessUnitId =
  | 'CMHL'
  | 'CityFood'
  | 'BrandOrigins'
  | 'CityVentures'
  | 'CityProperties'
  | 'Pahtama';

export type CoreValue =
  | 'Innovation'
  | 'Integrity'
  | 'Excellence'
  | 'Social Responsibility';

export type ChallengeType = 'scenario_quiz' | 'matching_game' | 'scorm_video';

export type LandscapeType =
  | 'bagan_plains'
  | 'yangon_shopping_center'
  | 'mandalay_moat_kitchens'
  | 'taunggyi_farms_factory'
  | 'putao_myeik_incubator'
  | 'mawlamyaing_skyline'
  | 'dawei_warehouse_port';

export interface QuizQuestion {
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface MatchingPair {
  term: string;
  match: string;
}

export interface ScormBriefing {
  title: string;
  duration_label: string;
  slides: Array<{
    heading: string;
    body: string;
  }>;
}

export interface QuestDefinition {
  campaign: string;
  quest_id: string;
  title?: string;
  core_value?: CoreValue;
  lms_hook: string;
  world: WorldId;
  npc_assigner: string;
  spawn_location: [number, number]; // [X, Y] world coordinates
  puzzle_object?: string;
  dialogue: {
    greeting: string;
    completion?: string;
  };
  challenge_type: ChallengeType;
  questions?: QuizQuestion[];
  pairs?: MatchingPair[];
  video_briefing?: ScormBriefing;
  rewards: {
    xp: number;
    coins?: number;
    badge: string;
    item_unlock: string;
    unlocks_travel_pass?: boolean;
  };
}

export interface WorldPortal {
  id: string;
  targetWorld: WorldId;
  label: string;
  x: number;
  y: number;
  color: string;
  requiresTravelPass: boolean;
}

export interface WorldNpc {
  id: string;
  name: string;
  role: 'coach' | 'hr_master' | 'tailor' | 'leaderboard_keeper';
  title: string;
  x: number;
  y: number;
  primaryColor: string;
  accentColor: string;
  greeting: string;
  questId?: string;
}

export interface TreasureChest {
  id: string;
  campaign: string;
  world: WorldId;
  x: number;
  y: number;
  label: string;
  coins: number;
  xp: number;
  cosmeticId: string;
}

export interface WorldProp {
  kind:
    | 'bagan_stupa'
    | 'bagan_balloon'
    | 'shopping_mall'
    | 'supermarket_shelf'
    | 'pos_counter'
    | 'shwedagon_spire'
    | 'mandalay_moat_tower'
    | 'ubein_bridge'
    | 'bakery_oven'
    | 'cafe_table'
    | 'shan_terrace_farm'
    | 'crop_plot'
    | 'factory_vat'
    | 'putao_snow_peak'
    | 'server_rack'
    | 'data_node'
    | 'mawlamyaing_ridge_tower'
    | 'blueprint_table'
    | 'crane_pillar'
    | 'dawei_port_crane'
    | 'warehouse_rack'
    | 'delivery_truck'
    | 'hub_fountain'
    | 'leaderboard_board'
    | 'tailor_stall';
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}

export interface WorldTheme {
  id: WorldId;
  name: string;
  myanmarCity: string;
  businessTheme: string;
  landscapeType: LandscapeType;
  subtitle: string;
  sectorId?: BusinessUnitId;
  companyName: string;
  primaryHex: string;
  secondaryHex: string;
  floorHexA: string;
  floorHexB: string;
  wallHex: string;
  accentHex: string;
  description: string;
  spawnsAt: [number, number];
  portals: WorldPortal[];
  npcs: WorldNpc[];
  props: WorldProp[];
  chests: TreasureChest[];
}

export type CosmeticSlot = 'hat' | 'glasses' | 'outfit' | 'boots' | 'pet';

export interface CosmeticItem {
  id: string;
  name: string;
  slot: CosmeticSlot;
  priceCoins: number;
  colorHex: string;
  accentHex: string;
  description: string;
  questOnly?: boolean;
}

export interface ColleaguePresence {
  uid: string;
  name: string;
  sectorId: BusinessUnitId;
  world: WorldId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tunicColor: string;
  title: string;
  hat?: string;
  chatBubble?: string;
  chatExpiresAt?: number;
}

export interface PaceState {
  planCompleted: boolean;
  assessCompleted: boolean;
  completeCompleted: boolean;
  evaluateCompleted: boolean;
}

export interface PlayerState {
  uid: string;
  name: string;
  email: string;
  sectorId: BusinessUnitId;
  homeWorld: WorldId;
  currentWorld: WorldId;
  x: number;
  y: number;
  facing: 'up' | 'down' | 'left' | 'right';
  tunicColor: string;
  xp: number;
  coins: number;
  level: number;
  classTitle: string;
  travelPassUnlocked: boolean;
  activeQuestId: string | null;
  completedQuestIds: string[];
  openedChestIds: string[];
  badges: string[];
  unlockedCosmetics: string[];
  equippedCosmetics: Partial<Record<CosmeticSlot, string>>;
  pace: PaceState;
  sessionStartedAt: number;
  chatBubble: string | null;
  chatBubbleExpiresAt: number;
}

export interface GuardianMessage {
  id: string;
  sender: 'user' | 'guardian';
  text: string;
  timestamp: number;
}

export interface XApiStatementRecord {
  id: string;
  timestamp: string;
  questId: string;
  lmsHook: string;
  world: WorldId;
  scoreRatio: string;
  xpEarned: number;
  rawJson: Record<string, unknown>;
}
