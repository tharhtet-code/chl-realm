#!/usr/bin/env tsx
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';

interface CliOptions {
  world: string;
  npc: string;
  campaign: string;
  lmsHook: string;
  topic: string;
  out?: string;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const opts: CliOptions = {
    world: 'Retail_Realm',
    npc: 'Coach_Ohnmar',
    campaign: 'City_Holdings_Core_Values',
    lmsHook: 'module_core_values_2026',
    topic: 'Customer Service Integrity & Point-of-Sale Excellence at CMHL',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--world' && args[i + 1]) opts.world = args[++i];
    else if (arg === '--npc' && args[i + 1]) opts.npc = args[++i];
    else if (arg === '--campaign' && args[i + 1]) opts.campaign = args[++i];
    else if (arg === '--lms-hook' && args[i + 1]) opts.lmsHook = args[++i];
    else if (arg === '--topic' && args[i + 1]) opts.topic = args[++i];
    else if (arg === '--out' && args[i + 1]) opts.out = args[++i];
  }
  return opts;
}

async function runGeminiPipeline() {
  const opts = parseArgs();
  const apiKey = process.env.GEMINI_API_KEY;

  console.log('==============================================================');
  console.log('  CHL REALM :: GEMINI AI -> YAML QUEST PIPELINE');
  console.log('==============================================================');
  console.log(`Target World : ${opts.world}`);
  console.log(`NPC Assigner : ${opts.npc}`);
  console.log(`Campaign     : ${opts.campaign}`);
  console.log(`LMS Hook     : ${opts.lmsHook}`);
  console.log(`Source Topic : ${opts.topic}`);
  console.log('--------------------------------------------------------------');

  let yamlOutput = '';

  if (apiKey) {
    console.log('[Gemini API] Calling gemini-2.5-flash to synthesize quest YAML...');
    const prompt = `Generate a single YAML quest definition for CHL Realm.
Required fields:
campaign: "${opts.campaign}"
quest_id: "val_integrity_01"
title: "<Title>"
core_value: "Integrity"
lms_hook: "${opts.lmsHook}"
world: "${opts.world}"
npc_assigner: "${opts.npc}"
spawn_location: [210, 440]
dialogue:
  greeting: "<Greeting>"
challenge_type: "scenario_quiz"
questions: (array of 3 scenario questions with prompt, options (4 strings), correct_index, explanation)
rewards:
  xp: 200
  coins: 80
  badge: "Integrity_Seed"
  item_unlock: "Purple_CMHL_Apron"
Topic: ${opts.topic}
Output ONLY valid YAML without markdown fences.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
      }
    );
    const data = await res.json();
    yamlOutput = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '')
      .replace(/^```ya?ml\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();
  }

  if (!yamlOutput) {
    console.log('[Pipeline] Generating validated YAML quest from instructional blueprint...');
    const questDoc = {
      campaign: opts.campaign,
      quest_id: 'val_integrity_01',
      title: 'The Honest Checkout & Community Trust',
      core_value: 'Integrity',
      lms_hook: opts.lmsHook,
      world: opts.world,
      npc_assigner: opts.npc,
      spawn_location: [210, 440],
      dialogue: {
        greeting:
          'Welcome to CMHL! To serve our community, we must act with Integrity. Can you solve this scenario?',
      },
      challenge_type: 'scenario_quiz',
      questions: [
        {
          prompt:
            'A shopper accidentally leaves a high-value imported item at the self-checkout bagging area after paying. No one else is watching. What should you do?',
          options: [
            'Immediately secure the item, log it at the Customer Service desk, and alert the floor supervisor to reunite it with the shopper',
            'Leave it on the counter and hope someone claims it later',
            'Put it back on the shelf without recording the paid transaction',
            'Set it aside in the breakroom until the end of the week',
          ],
          correct_index: 0,
          explanation:
            'Integrity means doing the right thing even when no one is watching—protecting our customers and logging found items transparently.',
        },
        {
          prompt:
            'A shelf promotional sign expired yesterday, showing a 15% discount on organic rice, while the POS scans full price. How do you handle the customer inquiry?',
          options: [
            'Acknowledge the error transparently, honor the store policy with a warm apology, and remove the expired sign immediately',
            'Blame the night shift crew and refuse to assist',
            'Tell the customer promotions are never guaranteed',
            'Ask the customer to put the rice back',
          ],
          correct_index: 0,
          explanation:
            'Transparency and accountability across teams uphold both Integrity and Excellence.',
        },
        {
          prompt:
            'While inspecting fresh produce in the Retail Plaza, you notice a crate with bruising that falls below CMHL quality standards. What is the right action?',
          options: [
            'Pull the crate from the display floor and record it in the quality variance log',
            'Mix the bruised items underneath fresh ones so they sell anyway',
            'Discount it secretly without supervisor approval',
            'Ignore it since the display looks full',
          ],
          correct_index: 0,
          explanation:
            'Honest quality control protects consumer wellbeing and City Holdings brand trust.',
        },
      ],
      rewards: {
        xp: 200,
        coins: 100,
        badge: 'Integrity_Seed',
        item_unlock: 'Purple_CMHL_Apron',
      },
    };
    yamlOutput = yaml.dump(questDoc, { lineWidth: 100 });
  }

  // Validate YAML syntax
  const parsed = yaml.load(yamlOutput);
  console.log('\n[Generated YAML Output]:\n');
  console.log(yamlOutput);
  console.log('[Validation] YAML parsed successfully:', Boolean(parsed));

  if (opts.out) {
    const outPath = path.resolve(process.cwd(), opts.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, yamlOutput, 'utf8');
    console.log(`[Saved] Wrote YAML quest to ${outPath}`);
  }
}

runGeminiPipeline().catch((err) => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
