import type {
  GuardianMessage,
  PlayerState,
  QuestDefinition,
} from '../types/game';
import { WORLD_THEMES } from '../worlds/worldDefinitions';

export const GUARDIAN_NAME = 'Thura';
export const GUARDIAN_MODEL = 'gemini-3.8-flash';
const STORAGE_KEY_GUARDIAN = 'chr_guardian_thread_v1';

export class GuardianThuraService {
  private thread: GuardianMessage[] = [];

  constructor() {
    this.loadThread();
  }

  private loadThread(): void {
    const raw = localStorage.getItem(STORAGE_KEY_GUARDIAN);
    if (raw) {
      try {
        this.thread = JSON.parse(raw) as GuardianMessage[];
        if (this.thread.length > 0) return;
      } catch {
        // Reset on invalid JSON
      }
    }

    this.thread = [
      {
        id: 'msg_welcome',
        sender: 'guardian',
        text: `Mingalaba! I am ${GUARDIAN_NAME}, your Guardian Spirit powered by ${GUARDIAN_MODEL}. Welcome home to The Hub in Ancient Bagan! Ask me anything about quests, Myanmar landmarks, or how to level up!`,
        timestamp: Date.now(),
      },
    ];
    this.saveThread();
  }

  private saveThread(): void {
    localStorage.setItem(STORAGE_KEY_GUARDIAN, JSON.stringify(this.thread.slice(-40)));
  }

  public getThread(): GuardianMessage[] {
    return this.thread;
  }

  public clearThread(): GuardianMessage[] {
    localStorage.removeItem(STORAGE_KEY_GUARDIAN);
    this.loadThread();
    return this.thread;
  }

  private enforceUnder60Words(text: string): string {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    const words = cleaned.split(' ');
    if (words.length <= 58) return cleaned;
    return `${words.slice(0, 56).join(' ')}...`;
  }

  public async askGuardian(params: {
    userMessage: string;
    player: PlayerState;
    questsInWorld: QuestDefinition[];
    apiKey?: string;
  }): Promise<GuardianMessage> {
    const userMsg: GuardianMessage = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: params.userMessage.trim(),
      timestamp: Date.now(),
    };
    this.thread.push(userMsg);
    this.saveThread();

    const worldTheme = WORLD_THEMES[params.player.currentWorld];
    const npcNames = worldTheme.npcs.map((n) => `${n.name} (${n.title})`).join(', ');
    const questTitles = params.questsInWorld
      .map((q) => `${q.title || q.quest_id} at [${q.spawn_location[0]},${q.spawn_location[1]}]`)
      .join('; ');

    const systemPrompt = `You are ${GUARDIAN_NAME} (two-syllable name: Thu-ra), the Player's Guardian in "CHL Realm" running on ${GUARDIAN_MODEL}.
Tone: Helpful, warm, friendly Guardian spirit.
Rule: ALWAYS reply in LESS THAN 60 WORDS like a short, concise chat message.
Current Context:
- Player: ${params.player.name} (${params.player.classTitle}, ${params.player.xp} XP, ${params.player.coins} Gold)
- Current World: ${worldTheme.name} (${worldTheme.myanmarCity} - ${worldTheme.businessTheme})
- 3 World MCPs/NPCs here: ${npcNames}
- 5 Quest Spots here: ${questTitles}
- Travel Pass Unlocked: ${params.player.travelPassUnlocked ? 'Yes (All 7 worlds open)' : 'Complete 1 Core Values quest to unlock all worlds'}`;

    const key =
      params.apiKey?.trim() ||
      (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ||
      '';

    let replyText = '';

    if (key) {
      try {
        const contents = this.thread.slice(-8).map((m) => ({
          role: m.sender === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }],
        }));

        // Primary call to Gemini-3.8-flash (with automatic fallback endpoint if needed)
        const modelsToTry = [GUARDIAN_MODEL, 'gemini-2.5-flash'];
        for (const modelName of modelsToTry) {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents,
              }),
            }
          );
          if (res.ok) {
            const data = await res.json();
            const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (candidate) {
              replyText = this.enforceUnder60Words(candidate);
              break;
            }
          }
        }
      } catch {
        // Fallback to contextual Guardian synthesis below
      }
    }

    if (!replyText) {
      replyText = this.synthesizeGuardianReply(
        params.userMessage,
        params.player,
        worldTheme.name,
        worldTheme.myanmarCity,
        params.questsInWorld
      );
    }

    const guardianMsg: GuardianMessage = {
      id: `g_${Date.now()}`,
      sender: 'guardian',
      text: this.enforceUnder60Words(replyText),
      timestamp: Date.now(),
    };
    this.thread.push(guardianMsg);
    this.saveThread();
    return guardianMsg;
  }

  private synthesizeGuardianReply(
    query: string,
    player: PlayerState,
    worldName: string,
    myanmarCity: string,
    quests: QuestDefinition[]
  ): string {
    const q = query.toLowerCase();
    const uncompleted = quests.find((item) => !player.completedQuestIds.includes(item.quest_id)) || quests[0];

    if (q.includes('quest') || q.includes('where') || q.includes('next') || q.includes('trial')) {
      if (uncompleted) {
        return `In ${worldName} (${myanmarCity}), head to [${uncompleted.spawn_location[0]}, ${uncompleted.spawn_location[1]}] for "${uncompleted.title}" with ${uncompleted.npc_assigner.replace(/_/g, ' ')}. Accept the trial to earn +${uncompleted.rewards.xp} XP and ${uncompleted.rewards.item_unlock}!`;
      }
    }

    if (q.includes('hub') || q.includes('bagan') || q.includes('home') || q.includes('portal')) {
      return `The Hub is your Home Base in Ancient Bagan! It has 3 MCP guides, 5 pagoda quest shrines, hot-air balloons, and 6 Portal Gates to Yangon, Mandalay, Taunggyi, Putao-Myeik, Mawlamyaing, and Dawei.`;
    }

    if (q.includes('pass') || q.includes('unlock') || q.includes('travel') || q.includes('world')) {
      return player.travelPassUnlocked
        ? `Your Cross-World Portal Pass is already active! Tap "Realms" in the bottom dock to travel freely between Ancient Bagan, Yangon, Mandalay, Taunggyi, Putao-Myeik, Mawlamyaing, and Dawei.`
        : `Complete any Core Values trial in The Hub (Ancient Bagan) or your home sector to unlock your Cross-World Portal Pass and visit all 7 Myanmar city worlds!`;
    }

    if (q.includes('coin') || q.includes('tailor') || q.includes('hat') || q.includes('dress')) {
      return `You currently have ${player.coins} Gold Coins! Visit Tailor Daw Khin in The Hub or tap "Tailor" below to equip 3D hats, visors, tabards, winged boots, and floating Bagan balloon pets.`;
    }

    return `I'm Thura, your Guardian here in ${worldName} (${myanmarCity})! You have ${player.xp} XP as a ${player.classTitle}. Tap the Quest Icon or walk to [${uncompleted?.spawn_location[0] ?? 210}, ${uncompleted?.spawn_location[1] ?? 440}] to start your next trial!`;
  }
}

export const guardianThura = new GuardianThuraService();
