# CHL Realm

A 2D, 16-bit multiplayer learning adventure built on the **Antigravity HTML5 Canvas Engine** and **Firebase**. Designed for mobile-first engagement (10–20 minute daily P.A.C.E. sessions), it transforms corporate training into a gamified, federated world mirroring the real-world structure of **City Holdings**.

---

## Quick Start

```bash
# 1. Start the interactive 16-bit game client
npm run dev

# 2. Type-check & build production bundle for Firebase Hosting
npm run build

# 3. Run the Gemini AI -> YAML Quest Generator CLI
npm run quest:generate

# 4. Run the Serverless LMS xAPI Statement Simulator CLI
npm run xapi:simulate
```

---

## Architecture & Spec Coverage

1. **Hub-and-Spoke Federated Worlds (`src/worlds/worldDefinitions.ts`)**:
   - **The HUB (Central Office)** — Sleek Monochrome (`#0f172a` / `#f8fafc`): Global gathering atrium with **Guild Master Su** (Global HR), **Tailor Daw Khin** (Avatar Dress-Up Shop), **Herald Ko Min** (Competitive Notice Board), and 6 sector portals.
   - **Retail Realm (CMHL)** — Vibrant Purple (`#9333ea`): Supermarket & retail plaza biome with **Coach Ohnmar** and quest `val_integrity_01` at `[105, 220]`.
   - **Food & Beverage District (CityFood Concepts)** — Energetic Red (`#dc2626`): Commercial kitchens, bakeries & cafes with **Chef Kyaw**.
   - **Manufacturing & Agriculture Zone (The Brand Origins)** — Deep Indigo (`#312e81`): Digital farmlands transitioning into high-tech processing plants with **Supervisor Thiri**.
   - **Ventures Valley (City Ventures)** — Tech Green (`#10b981`): Data-driven incubator & glowing server nodes with **Architect Zayar**.
   - **Property Estates (City Properties)** — Corporate Blue (`#2563eb`): Blueprints, construction sites & real estate offices with **Director May**.
   - **Distribution Badlands (Pahtama Group & Premium Distribution)** — Light Blue & Gold Gradient (`#0284c7` & `#f59e0b`): Warehouses, supply routes & loading docks with **Captain Aung**.
2. **Clean Slate & Class Evolution**:
   - Every employee spawns as a **Level 1 Novice** in their SSO Business Unit World wearing a sector-colored **Novice Tunic**.
   - Completing quests evolves their class title (e.g., `Level 1 Novice` → `Distribution Ranger` → `Supply Chain Knight`) and unlocks the **Cross-World Travel Pass**.
3. **YAML Content Engine & Gemini AI Pipeline (`public/quests/quests.yaml`, `src/content/yamlEngine.ts`, `cli/gemini-quest-pipeline.ts`)**:
   - Strict separation between game code and learning content. Supports `scenario_quiz`, `matching_game`, and `scorm_video` challenges.
4. **Firebase & Serverless LMS xAPI Gateway (`firebase.json`, `functions/src/index.ts`, `src/services/firebaseService.ts`)**:
   - Includes Firestore security rules, Realtime Database presence rules, Keycloak OIDC token exchange function, and xAPI 1.0.3 statement bridge.
