import * as yaml from 'js-yaml';
import type { QuestDefinition, WorldId } from '../types/game';

interface YamlQuestBundle {
  quests?: QuestDefinition[];
}

export async function loadQuestsFromYaml(url = './quests/quests.yaml'): Promise<QuestDefinition[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load YAML quests (${response.status})`);
  }
  const rawYaml = await response.text();
  return parseQuestYamlText(rawYaml);
}

export function parseQuestYamlText(rawYaml: string): QuestDefinition[] {
  const cleaned = rawYaml
    .replace(/^```ya?ml\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const parsed = yaml.load(cleaned) as YamlQuestBundle | QuestDefinition | QuestDefinition[];
  if (!parsed) return [];

  if (Array.isArray(parsed)) {
    return parsed.map(normalizeQuest);
  }
  if (typeof parsed === 'object' && 'quests' in parsed && Array.isArray(parsed.quests)) {
    return parsed.quests.map(normalizeQuest);
  }
  if (typeof parsed === 'object' && 'quest_id' in parsed) {
    return [normalizeQuest(parsed as QuestDefinition)];
  }
  return [];
}

function normalizeQuest(q: QuestDefinition): QuestDefinition {
  const defaultQuestions = [
    {
      prompt: `${q.dialogue?.greeting || 'How should a City Holdings team member respond with Integrity and Excellence?'}`,
      options: [
        'Follow transparent company standards, prioritize customer & colleague safety, and log actions accurately',
        'Bypass standard procedures to save a few seconds',
        'Defer responsibility to another shift without documentation',
        'Ignore the policy if nobody is watching',
      ],
      correct_index: 0,
      explanation: 'Acting with Integrity and Excellence is the foundation of the City Holdings Core Values.',
    },
  ];

  return {
    campaign: q.campaign || 'City_Holdings_Core_Values',
    quest_id: q.quest_id || `quest_${Date.now().toString().slice(-4)}`,
    title: q.title || q.quest_id.replace(/_/g, ' ').toUpperCase(),
    core_value: q.core_value || 'Integrity',
    lms_hook: q.lms_hook || 'module_core_values_2026',
    world: (q.world || 'Retail_Realm') as WorldId,
    npc_assigner: q.npc_assigner || 'Coach_Ohnmar',
    spawn_location: Array.isArray(q.spawn_location) && q.spawn_location.length >= 2
      ? [Number(q.spawn_location[0]), Number(q.spawn_location[1])]
      : [210, 440],
    puzzle_object: q.puzzle_object || 'Sector Learning Terminal',
    dialogue: {
      greeting:
        q.dialogue?.greeting ||
        'Welcome! To serve our community, we must live our Core Values. Ready to solve this scenario?',
      completion:
        q.dialogue?.completion ||
        'Excellent work! Your completion has been synced to the corporate LMS via xAPI.',
    },
    challenge_type: q.challenge_type || 'scenario_quiz',
    questions: q.questions && q.questions.length > 0 ? q.questions : defaultQuestions,
    pairs: q.pairs,
    video_briefing: q.video_briefing,
    rewards: {
      xp: Number(q.rewards?.xp ?? 200),
      coins: Number(q.rewards?.coins ?? 90),
      badge: q.rewards?.badge || 'Integrity_Seed',
      item_unlock: q.rewards?.item_unlock || 'Purple_CMHL_Apron',
      unlocks_travel_pass: q.rewards?.unlocks_travel_pass ?? true,
    },
  };
}

export async function generateQuestYamlWithGemini(params: {
  trainingText: string;
  world: WorldId;
  npcAssigner: string;
  lmsHook: string;
  campaign: string;
  apiKey?: string;
}): Promise<string> {
  const key = params.apiKey?.trim();
  if (key) {
    try {
      const systemPrompt = `You are the Gemini Instructional Design AI for CHL Realm.
Convert the user's training material into strictly valid YAML matching this exact schema:
campaign: "${params.campaign}"
quest_id: "<snake_case_id>"
title: "<Concise Title>"
core_value: "Integrity"
lms_hook: "${params.lmsHook}"
world: "${params.world}"
npc_assigner: "${params.npcAssigner}"
spawn_location: [210, 440]
dialogue:
  greeting: "<1-2 sentence NPC narrative hook>"
challenge_type: "scenario_quiz"
questions:
  - prompt: "<Scenario question 1>"
    options:
      - "<Correct action>"
      - "<Distractor 1>"
      - "<Distractor 2>"
      - "<Distractor 3>"
    correct_index: 0
    explanation: "<Why this aligns with City Holdings values>"
rewards:
  xp: 200
  coins: 95
  badge: "Integrity_Seed"
  item_unlock: "Purple_CMHL_Apron"
Return ONLY raw YAML without markdown code fences.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: params.trainingText }] }],
          }),
        }
      );
      if (res.ok) {
        const json = await res.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return text.replace(/^```ya?ml\s*/i, '').replace(/\s*```$/i, '').trim();
        }
      }
    } catch {
      // Fall through to local deterministic synthesis if network/key fails
    }
  }

  const excerpt = params.trainingText.trim().slice(0, 80) || 'City Holdings Core Values & Workplace Integrity';
  const generated: QuestDefinition = {
    campaign: params.campaign || 'City_Holdings_Core_Values',
    quest_id: `gemini_${params.world.toLowerCase()}_${Math.floor(100 + Math.random() * 899)}`,
    title: `${params.world.replace(/_/g, ' ')} Mastery Challenge`,
    core_value: 'Innovation',
    lms_hook: params.lmsHook || 'module_core_values_2026',
    world: params.world,
    npc_assigner: params.npcAssigner,
    spawn_location: [520, 520],
    puzzle_object: 'Gemini AI Generated Holo-Terminal',
    dialogue: {
      greeting: `Welcome! I synthesized this scenario from "${excerpt}". Can you apply our standards?`,
    },
    challenge_type: 'scenario_quiz',
    questions: [
      {
        prompt: `Based on the training brief ("${excerpt}"), what is the highest-priority action when an operational anomaly occurs?`,
        options: [
          'Document the observation transparently, follow sector safety & quality SOPs, and escalate to the floor coach',
          'Skip standard verification to finish early',
          'Keep the issue unrecorded to avoid extra paperwork',
          'Wait for someone else to notice next month',
        ],
        correct_index: 0,
        explanation: 'Proactive ownership and transparent reporting embody Integrity and Excellence.',
      },
      {
        prompt: 'How do City Holdings teams turn daily learning into cross-sector impact?',
        options: [
          'Apply the P.A.C.E. (Plan, Assess, Complete, Evaluate) loop on the job and share insights with colleagues',
          'Treat compliance modules as a one-time checkbox',
          'Keep best practices siloed within a single store',
          'Avoid collaborating across business units',
        ],
        correct_index: 0,
        explanation: 'Federated learning strengthens all six Business Sectors and The HUB.',
      },
    ],
    rewards: {
      xp: 220,
      coins: 100,
      badge: 'Gemini_Scholar_Crest',
      item_unlock: 'Ventures_Cyber_Visor',
      unlocks_travel_pass: true,
    },
  };

  return yaml.dump(generated, { lineWidth: 100 });
}
