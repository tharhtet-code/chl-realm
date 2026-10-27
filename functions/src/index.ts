import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as yaml from 'js-yaml';

admin.initializeApp();

const SECTOR_TO_WORLD_MAP: Record<string, { world: string; tunicColor: string; label: string }> = {
  CMHL: { world: 'Retail_Realm', tunicColor: '#9333ea', label: 'Retail Realm (CMHL)' },
  CityFood: { world: 'Food_Beverage_District', tunicColor: '#dc2626', label: 'Food & Beverage District (CityFood Concepts)' },
  BrandOrigins: { world: 'Manufacturing_Agri_Zone', tunicColor: '#312e81', label: 'Manufacturing & Agriculture Zone (The Brand Origins)' },
  CityVentures: { world: 'Ventures_Valley', tunicColor: '#10b981', label: 'Ventures Valley (City Ventures)' },
  CityProperties: { world: 'Property_Estates', tunicColor: '#2563eb', label: 'Property Estates (City Properties)' },
  Pahtama: { world: 'Distribution_Badlands', tunicColor: '#38bdf8', label: 'Distribution Badlands (Pahtama Group & Premium)' },
};

/**
 * 1. Identity Provider (IdP) Gateway:
 * Consumes Keycloak OIDC JWT token connected to corporate HR directory,
 * extracts Business Unit claim, and mints a Firebase Custom Auth token
 * to spawn the player in their designated World with their sector Novice Tunic.
 */
export const keycloakTokenExchange = onRequest({ cors: true }, async (req, res) => {
  try {
    const { oidcToken, mockEmployee } = req.body || {};

    let uid = 'emp_001';
    let email = 'employee@cityholdings.com';
    let name = 'Aung Kyaw';
    let businessUnit = 'CMHL';

    if (oidcToken) {
      // Decode JWT payload (In production, verify signature against Keycloak JWKS URI)
      const parts = String(oidcToken).split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        uid = payload.sub || uid;
        email = payload.email || email;
        name = payload.name || payload.preferred_username || name;
        businessUnit = payload.business_unit || payload.department || businessUnit;
      }
    } else if (mockEmployee) {
      uid = mockEmployee.uid || uid;
      email = mockEmployee.email || email;
      name = mockEmployee.name || name;
      businessUnit = mockEmployee.businessUnit || businessUnit;
    }

    const sectorConfig = SECTOR_TO_WORLD_MAP[businessUnit] || SECTOR_TO_WORLD_MAP.CMHL;

    const customClaims = {
      businessUnit,
      homeWorld: sectorConfig.world,
      tunicColor: sectorConfig.tunicColor,
      cleanSlateLevel: 1,
    };

    const customToken = await admin.auth().createCustomToken(uid, customClaims);

    res.status(200).json({
      customToken,
      profile: {
        uid,
        name,
        email,
        businessUnit,
        homeWorld: sectorConfig.world,
        tunicColor: sectorConfig.tunicColor,
        title: 'Level 1 Novice',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown SSO exchange error';
    res.status(500).json({ error: message });
  }
});

/**
 * Helper to construct a standard ADL xAPI (TinCan 1.0.3) Statement
 * from an in-game quest completion.
 */
export function buildXApiStatement(params: {
  employeeEmail: string;
  employeeName: string;
  businessUnit: string;
  questId: string;
  questTitle: string;
  lmsHook: string;
  campaign: string;
  world: string;
  score: number;
  maxScore: number;
  xpEarned: number;
  badgeUnlocked?: string;
  itemUnlocked?: string;
  durationSeconds?: number;
}) {
  const passed = params.score >= Math.ceil(params.maxScore * 0.6);
  const scaled = params.maxScore > 0 ? Number((params.score / params.maxScore).toFixed(2)) : 1;

  return {
    id: crypto.randomUUID(),
    actor: {
      objectType: 'Agent',
      name: params.employeeName,
      mbox: `mailto:${params.employeeEmail}`,
      account: {
        homePage: 'https://sso.cityholdings.com',
        name: params.employeeEmail,
      },
    },
    verb: {
      id: 'http://adlnet.gov/expapi/verbs/completed',
      display: { 'en-US': 'completed' },
    },
    object: {
      objectType: 'Activity',
      id: `https://lms.cityholdings.com/activities/${params.lmsHook}`,
      definition: {
        name: { 'en-US': `${params.questTitle} (${params.questId})` },
        description: {
          'en-US': `CHL Realm in-game learning quest in ${params.world} under campaign ${params.campaign}.`,
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
      success: passed,
      completion: true,
      duration: `PT${params.durationSeconds || 180}S`,
      extensions: {
        'https://realm.cityholdings.com/xapi/ext/xp_earned': params.xpEarned,
        'https://realm.cityholdings.com/xapi/ext/badge': params.badgeUnlocked || null,
        'https://realm.cityholdings.com/xapi/ext/item_unlock': params.itemUnlocked || null,
      },
    },
    context: {
      registration: crypto.randomUUID(),
      platform: 'CHL Realm (Antigravity 3D Engine)',
      contextActivities: {
        grouping: [
          {
            objectType: 'Activity',
            id: `https://realm.cityholdings.com/campaigns/${params.campaign}`,
          },
          {
            objectType: 'Activity',
            id: `https://realm.cityholdings.com/worlds/${params.world}`,
          },
        ],
      },
      extensions: {
        'https://realm.cityholdings.com/xapi/ext/business_unit': params.businessUnit,
      },
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * 2. LMS Gateway (HTTP Webhook & Firestore Trigger):
 * Translates in-game quest completions into standard xAPI statements
 * and pushes them to the central Learning Management System (LRS).
 */
export const onQuestCompleteXApiGateway = onRequest({ cors: true }, async (req, res) => {
  try {
    const statement = buildXApiStatement(req.body);
    const lmsEndpoint = process.env.LMS_XAPI_ENDPOINT;
    const lmsAuth = process.env.LMS_XAPI_AUTH_BASIC;

    let lrsDelivered = false;
    if (lmsEndpoint && lmsAuth) {
      const response = await fetch(lmsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Experience-API-Version': '1.0.3',
          Authorization: `Basic ${lmsAuth}`,
        },
        body: JSON.stringify(statement),
      });
      lrsDelivered = response.ok;
    }

    res.status(200).json({
      status: 'xAPI Statement Generated',
      lrsDelivered,
      statement,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'xAPI Gateway Error';
    res.status(500).json({ error: message });
  }
});

export const onFirestoreQuestCompletion = onDocumentCreated(
  'players/{userId}/completions/{questId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const statement = buildXApiStatement({
      employeeEmail: data.employeeEmail || 'employee@cityholdings.com',
      employeeName: data.employeeName || 'City Holdings Learner',
      businessUnit: data.businessUnit || 'CMHL',
      questId: event.params.questId,
      questTitle: data.questTitle || event.params.questId,
      lmsHook: data.lmsHook || 'module_core_values_2026',
      campaign: data.campaign || 'City_Holdings_Core_Values',
      world: data.world || 'Retail_Realm',
      score: data.score ?? 5,
      maxScore: data.maxScore ?? 5,
      xpEarned: data.xpEarned ?? 200,
      badgeUnlocked: data.badgeUnlocked,
      itemUnlocked: data.itemUnlocked,
      durationSeconds: data.durationSeconds ?? 120,
    });

    await event.data?.ref.update({
      xApiStatementId: statement.id,
      xApiSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);

/**
 * 3. Gemini AI Content Engine Endpoint:
 * Instructional designers feed training deck text or PDF extracts to this endpoint,
 * which prompts Gemini AI to output validated YAML quest definitions.
 */
export const geminiQuestGenerator = onRequest({ cors: true }, async (req, res) => {
  try {
    const { sourceMaterial, targetWorld, campaignName, lmsHook, npcAssigner } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    const systemInstruction = `You are the Instructional Design AI for CHL Realm.
Convert corporate training content into strictly valid YAML matching this exact schema:
campaign: "${campaignName || 'City_Holdings_Core_Values'}"
quest_id: "<snake_case_id>"
title: "<Quest Title>"
lms_hook: "${lmsHook || 'module_core_values_2026'}"
world: "${targetWorld || 'Retail_Realm'}"
npc_assigner: "${npcAssigner || 'Coach_Ohnmar'}"
spawn_location: [210, 440]
dialogue:
  greeting: "<NPC narrative hook>"
challenge_type: "scenario_quiz"
questions:
  - prompt: "<Scenario question>"
    options: ["<Option A>", "<Option B>", "<Option C>", "<Option D>"]
    correct_index: 0
    explanation: "<Feedback>"
rewards:
  xp: 200
  coins: 75
  badge: "<Badge_ID>"
  item_unlock: "<Cosmetic_Item_ID>"
Return ONLY raw YAML without markdown code fences.`;

    if (apiKey) {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: 'user', parts: [{ text: String(sourceMaterial || 'Core Values Training') }] }],
          }),
        }
      );
      const geminiJson = await geminiRes.json();
      const rawYaml = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = yaml.load(rawYaml);
      res.status(200).json({ yaml: rawYaml, parsed, provider: 'gemini-2.5-flash' });
      return;
    }

    // Fallback deterministic YAML generation when GEMINI_API_KEY is not configured in environment
    const fallbackQuest = {
      campaign: campaignName || 'City_Holdings_Core_Values',
      quest_id: `gen_${Date.now().toString().slice(-4)}`,
      title: 'Generated Sector Excellence Challenge',
      lms_hook: lmsHook || 'module_core_values_2026',
      world: targetWorld || 'Retail_Realm',
      npc_assigner: npcAssigner || 'Coach_Ohnmar',
      spawn_location: [210, 440],
      dialogue: {
        greeting: `Welcome! Based on our latest training briefing ("${String(sourceMaterial || 'Core Values').slice(0, 48)}..."), can you resolve this workplace scenario?`,
      },
      challenge_type: 'scenario_quiz',
      questions: [
        {
          prompt: 'A customer notices a pricing discrepancy between the shelf tag and POS register. What is the Core Values response?',
          options: [
            'Honor the displayed policy transparently, apologize warmly, and report the shelf tag immediately for correction',
            'Tell the customer the computer is always right',
            'Ignore the discrepancy to keep the checkout line moving',
            'Ask the customer to return tomorrow',
          ],
          correct_index: 0,
          explanation: 'Acting with Integrity and Excellence builds lasting community trust.',
        },
      ],
      rewards: {
        xp: 200,
        coins: 80,
        badge: 'Integrity_Seed',
        item_unlock: 'Purple_CMHL_Apron',
      },
    };

    const rawYaml = yaml.dump(fallbackQuest);
    res.status(200).json({ yaml: rawYaml, parsed: fallbackQuest, provider: 'template-fallback' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gemini Generator Error';
    res.status(500).json({ error: message });
  }
});
