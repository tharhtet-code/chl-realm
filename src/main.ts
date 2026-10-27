import {
  generateQuestYamlWithGemini,
  loadQuestsFromYaml,
  parseQuestYamlText,
} from './content/yamlEngine';
import {
  AntigravityRealmCanvasEngine,
  type InteractionTarget,
} from './engine/gameCanvas';
import { realmBackend } from './services/firebaseService';
import {
  GUARDIAN_MODEL,
  GUARDIAN_NAME,
  guardianThura,
} from './services/guardianService';
import type {
  BusinessUnitId,
  ColleaguePresence,
  CosmeticSlot,
  PlayerState,
  QuestDefinition,
  TreasureChest,
  WorldId,
  WorldNpc,
} from './types/game';
import {
  COSMETIC_CATALOG,
  SECTOR_METADATA,
  WORLD_THEMES,
} from './worlds/worldDefinitions';

class CityHoldingsRealmApp {
  private player!: PlayerState;
  private quests: QuestDefinition[] = [];
  private colleagues: ColleaguePresence[] = [];
  private engine!: AntigravityRealmCanvasEngine;
  private currentProximity: InteractionTarget | null = null;
  private faceAnimRafId = 0;

  // Dialog references
  private questDialog!: HTMLDialogElement;
  private guardianDialog!: HTMLDialogElement;
  private leaderboardDialog!: HTMLDialogElement;
  private tailorDialog!: HTMLDialogElement;
  private geminiDialog!: HTMLDialogElement;
  private ssoDialog!: HTMLDialogElement;
  private xapiDialog!: HTMLDialogElement;

  public async init(): Promise<void> {
    this.setupDialogLightDismissFallback();
    this.cacheDialogs();

    // 1. Load Player State (Home Base is The Hub in Ancient Bagan)
    this.player = realmBackend.loadOrCreatePlayer('CMHL', 'Aung Myint');

    // 2. Load 35 YAML Quests (5 Quest Spots per World across 7 Worlds)
    try {
      this.quests = await loadQuestsFromYaml('./quests/quests.yaml');
      const firestoreQuests = await realmBackend.fetchFirestoreQuests();
      if (firestoreQuests && firestoreQuests.length > 0) {
        this.quests = firestoreQuests;
      }
    } catch (err) {
      console.error('Error loading quests.yaml:', err);
    }

    this.ensureActiveQuestForWorld(this.player.currentWorld);

    // 3. Initialize 3D Myanmar Fantasy WebGL Engine
    const canvas = document.getElementById('realmCanvas') as HTMLCanvasElement;
    this.engine = new AntigravityRealmCanvasEngine({
      canvas,
      getPlayer: () => this.player,
      getQuests: () => this.quests,
      getColleagues: () => this.colleagues,
      callbacks: {
        onInteract: (target) => this.handleInteraction(target),
        onProximityChange: (target) => this.updateProximityBanner(target),
        onPositionUpdate: () => {
          realmBackend.broadcastPresence(this.player);
          realmBackend.savePlayerState(this.player);
        },
      },
    });

    const miniMapCanvas = document.getElementById('miniMapCanvas') as HTMLCanvasElement | null;
    if (miniMapCanvas) {
      this.engine.attachMiniMap(miniMapCanvas);
    }

    const miniMapWidget = document.getElementById('miniMapWidget');
    document.getElementById('btnToggleMiniMap')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!miniMapWidget || !miniMapCanvas) return;
      const expanded = miniMapWidget.classList.toggle('expanded');
      miniMapCanvas.width = expanded ? 560 : 280;
      miniMapCanvas.height = expanded ? 324 : 162;
      this.engine.setMiniMapExpanded(expanded);
    });

    this.bindUiEvents();
    this.refreshAllUi();
    this.engine.start();
    this.startGuardianFaceAnimation();

    // 4. Start Multiplayer Simulation Loop
    setInterval(() => {
      this.colleagues = realmBackend.tickSimulatedColleagues(this.player.currentWorld);
    }, 60);
  }

  private setupDialogLightDismissFallback(): void {
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (e: PointerEvent, dialog: HTMLDialogElement) => {
        const r = dialog.getBoundingClientRect();
        return (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        );
      };
      for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog[closedby="any"]')) {
        let pressedOutside = false;
        dialog.addEventListener('pointerdown', (e) => {
          pressedOutside = outside(e, dialog);
        });
        dialog.addEventListener('pointerup', (e) => {
          if (pressedOutside && outside(e, dialog)) {
            dialog.close();
          }
        });
      }
    }
  }

  private cacheDialogs(): void {
    this.questDialog = document.getElementById('questDialog') as HTMLDialogElement;
    this.guardianDialog = document.getElementById('guardianDialog') as HTMLDialogElement;
    this.leaderboardDialog = document.getElementById('leaderboardDialog') as HTMLDialogElement;
    this.tailorDialog = document.getElementById('tailorDialog') as HTMLDialogElement;
    this.geminiDialog = document.getElementById('geminiDialog') as HTMLDialogElement;
    this.ssoDialog = document.getElementById('ssoDialog') as HTMLDialogElement;
    this.xapiDialog = document.getElementById('xapiDialog') as HTMLDialogElement;

    for (const dlg of [
      this.questDialog,
      this.guardianDialog,
      this.leaderboardDialog,
      this.tailorDialog,
      this.geminiDialog,
      this.ssoDialog,
      this.xapiDialog,
    ]) {
      dlg?.addEventListener('close', () => {
        dlg.returnValue = '';
      });
    }
  }

  /**
   * Renders a minimal, expressive animated character face on a 2D Canvas
   * (blinking eyes, animated talking mouth, gentle head movement, crown/hat).
   */
  private animateCharacterPortraitCanvas(
    canvas: HTMLCanvasElement,
    primaryColor: string,
    accentColor: string
  ): void {
    cancelAnimationFrame(this.faceAnimRafId);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let tick = 0;
    const drawFrame = () => {
      tick++;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2 + Math.sin(tick * 0.08) * 1.8;

      // Glowing Aura Circle
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = `${primaryColor}33`;
      ctx.fill();

      // Shoulders / Tunic Collar
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.arc(cx, cy + 24, 18, Math.PI, 0);
      ctx.fill();

      // Head
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(cx, cy - 1, 14, 0, Math.PI * 2);
      ctx.fill();

      // Crown / Headband
      ctx.fillStyle = accentColor;
      ctx.fillRect(cx - 13, cy - 14, 26, 5);
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 14);
      ctx.lineTo(cx, cy - 21);
      ctx.lineTo(cx + 6, cy - 14);
      ctx.fill();

      // Blinking Eyes
      const isBlinking = tick % 110 > 103;
      ctx.fillStyle = '#0f172a';
      if (isBlinking) {
        ctx.fillRect(cx - 7, cy - 3, 4, 1.5);
        ctx.fillRect(cx + 3, cy - 3, 4, 1.5);
      } else {
        ctx.beginPath();
        ctx.arc(cx - 5, cy - 3, 2.2, 0, Math.PI * 2);
        ctx.arc(cx + 5, cy - 3, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Animated Talking Mouth (opens & closes gently for first 180 frames)
      const mouthOpen = tick < 180 ? Math.abs(Math.sin(tick * 0.28)) * 3.2 : 1.0;
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 5, 3.6, Math.max(1.2, mouthOpen), 0, 0, Math.PI * 2);
      ctx.fill();

      if (this.questDialog.open) {
        this.faceAnimRafId = requestAnimationFrame(drawFrame);
      }
    };

    this.faceAnimRafId = requestAnimationFrame(drawFrame);
  }

  private startGuardianFaceAnimation(): void {
    const canvas = document.getElementById('guardianFaceCanvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let t = 0;
    const loop = () => {
      t++;
      ctx.clearRect(0, 0, 48, 48);
      const cy = 24 + Math.sin(t * 0.07) * 1.5;

      ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
      ctx.beginPath();
      ctx.arc(24, cy, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(24, cy, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#34d399';
      ctx.fillRect(14, cy - 11, 20, 4);

      const blink = t % 100 > 94;
      ctx.fillStyle = '#0f172a';
      if (blink) {
        ctx.fillRect(18, cy - 2, 3, 1.2);
        ctx.fillRect(27, cy - 2, 3, 1.2);
      } else {
        ctx.beginPath();
        ctx.arc(19.5, cy - 2, 1.8, 0, Math.PI * 2);
        ctx.arc(28.5, cy - 2, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(24, cy + 2, 3.2, 0.1, Math.PI - 0.1);
      ctx.stroke();

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private bindUiEvents(): void {
    // Simple Quest Icon Button in Topbar
    document.getElementById('btnOpenQuestMenu')?.addEventListener('click', () => {
      const activeQuest =
        this.quests.find((q) => q.quest_id === this.player.activeQuestId) ||
        this.quests.find((q) => q.world === this.player.currentWorld);
      if (activeQuest) {
        this.openTrialAcceptanceModal(activeQuest);
      }
    });

    // Proximity Banner Action Button
    document.getElementById('btnProximityAction')?.addEventListener('click', () => {
      this.engine.triggerInteraction();
    });

    // Touch D-Pad Controls
    const dirMap: Record<string, [number, number]> = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0],
    };

    for (const btn of document.querySelectorAll<HTMLButtonElement>('.dpad-btn[data-dir]')) {
      const dir = btn.dataset.dir || 'up';
      const [dx, dy] = dirMap[dir] || [0, 0];
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.engine.setTouchDirection(dx, dy);
      });
      btn.addEventListener('pointerup', () => this.engine.setTouchDirection(0, 0));
      btn.addEventListener('pointerleave', () => this.engine.setTouchDirection(0, 0));
    }

    document.getElementById('btnRotateCam')?.addEventListener('click', () => {
      this.engine.rotateCamera(Math.PI / 4);
    });

    // Right-Thumb Primary Action Rune Orb
    document.getElementById('btnTouchInteract')?.addEventListener('click', () => {
      if (this.currentProximity) {
        this.engine.triggerInteraction();
      } else {
        const activeQuest =
          this.quests.find((q) => q.quest_id === this.player.activeQuestId) ||
          this.quests.find((q) => q.world === this.player.currentWorld);
        if (activeQuest) {
          this.player.x = activeQuest.spawn_location[0];
          this.player.y = activeQuest.spawn_location[1] + 18;
          this.refreshAllUi();
          this.openTrialAcceptanceModal(activeQuest);
        }
      }
    });

    // Toggle Slide-Over Myanmar Worlds Drawer
    const worldDrawer = document.getElementById('worldDrawer');
    document.getElementById('btnToggleWorlds')?.addEventListener('click', () => {
      if (worldDrawer) {
        worldDrawer.hidden = !worldDrawer.hidden;
      }
    });
    document.getElementById('btnCloseWorldDrawer')?.addEventListener('click', () => {
      if (worldDrawer) {
        worldDrawer.hidden = true;
      }
    });

    // Guardian Thura 1:1 Single-Thread Conversation Openers
    document.getElementById('btnOpenGuardianFloating')?.addEventListener('click', () => {
      this.openGuardianModal();
    });
    document.getElementById('btnOpenGuardianDock')?.addEventListener('click', () => {
      this.openGuardianModal();
    });

    const guardianForm = document.getElementById('guardianChatForm') as HTMLFormElement;
    const guardianInput = document.getElementById('guardianInput') as HTMLInputElement;
    guardianForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = guardianInput.value.trim();
      if (!text) return;
      guardianInput.value = '';
      await this.sendGuardianQuestion(text);
    });

    document.querySelectorAll<HTMLButtonElement>('[data-guardian-ask]').forEach((chip) => {
      chip.addEventListener('click', async () => {
        const q = chip.dataset.guardianAsk;
        if (q) await this.sendGuardianQuestion(q);
      });
    });

    // Proximity Watercooler Chat Form
    const chatForm = document.getElementById('chatForm') as HTMLFormElement;
    const chatInput = document.getElementById('chatInput') as HTMLInputElement;
    chatForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      this.player.chatBubble = text;
      this.player.chatBubbleExpiresAt = Date.now() + 8000;
      chatInput.value = '';
      realmBackend.broadcastPresence(this.player);
      realmBackend.savePlayerState(this.player);
    });

    // Modal Openers
    document.getElementById('btnOpenTailor')?.addEventListener('click', () => {
      this.openTailorModal();
    });
    document.getElementById('btnOpenLeaderboard')?.addEventListener('click', () => {
      this.openLeaderboardModal();
    });
    document.getElementById('btnOpenGeminiStudio')?.addEventListener('click', () => {
      this.openGeminiModal();
    });
    document.getElementById('btnOpenSsoModal')?.addEventListener('click', () => {
      this.openSsoModal();
    });
    document.getElementById('btnOpenXApiLogs')?.addEventListener('click', () => {
      this.geminiDialog.close();
      this.openXApiModal();
    });

    // Gemini AI Studio Actions
    document.getElementById('btnRunGeminiYaml')?.addEventListener('click', async () => {
      await this.handleGenerateGeminiYaml();
    });
    document.getElementById('btnDeployYamlToWorld')?.addEventListener('click', () => {
      this.handleDeployCustomYaml();
    });

    // Clean Slate Reset (Returns to Home Base: The Hub in Ancient Bagan)
    document.getElementById('btnResetCleanSlate')?.addEventListener('click', () => {
      const nameInput = document.getElementById('ssoEmployeeName') as HTMLInputElement;
      this.player = realmBackend.createCleanSlatePlayer(
        this.player.sectorId,
        nameInput?.value || 'Aung Myint'
      );
      this.ensureActiveQuestForWorld(this.player.currentWorld);
      this.engine.rebuildWorldScene();
      this.refreshAllUi();
      this.ssoDialog.close();
    });
  }

  private ensureActiveQuestForWorld(worldId: WorldId): void {
    const worldQuests = this.quests.filter((q) => q.world === worldId);
    if (worldQuests.length > 0) {
      const uncompleted = worldQuests.find(
        (q) => !this.player.completedQuestIds.includes(q.quest_id)
      );
      this.player.activeQuestId = (uncompleted || worldQuests[0]).quest_id;
    }
  }

  private updateProximityBanner(target: InteractionTarget | null): void {
    this.currentProximity = target;
    const banner = document.getElementById('proximityBanner');
    const textEl = document.getElementById('proximityText');
    if (!banner || !textEl) return;

    if (!target) {
      banner.hidden = true;
      return;
    }

    banner.hidden = false;
    switch (target.type) {
      case 'npc':
        textEl.textContent = `Talk to ${target.npc.name}`;
        break;
      case 'quest_beacon':
        textEl.textContent = `Quest Spot [${target.quest.spawn_location[0]}, ${target.quest.spawn_location[1]}]`;
        break;
      case 'portal':
        textEl.textContent = `Portal: ${target.portal.label}`;
        break;
      case 'chest':
        textEl.textContent = `Open ${target.chest.label}`;
        break;
    }
  }

  private handleInteraction(target: InteractionTarget): void {
    switch (target.type) {
      case 'npc':
        this.handleNpcInteraction(target.npc);
        break;
      case 'quest_beacon':
        this.player.activeQuestId = target.quest.quest_id;
        this.refreshAllUi();
        this.openTrialAcceptanceModal(target.quest);
        break;
      case 'portal':
        this.travelToWorld(target.portal.targetWorld);
        break;
      case 'chest':
        this.openTreasureChest(target.chest);
        break;
    }
  }

  private handleNpcInteraction(npc: WorldNpc): void {
    const assignedQuest = this.quests.find(
      (q) => q.quest_id === npc.questId || q.npc_assigner === npc.id
    );

    if (assignedQuest) {
      this.player.activeQuestId = assignedQuest.quest_id;
      this.refreshAllUi();
      this.openTrialAcceptanceModal(assignedQuest, npc);
    } else if (npc.role === 'tailor') {
      this.openTailorModal();
    } else if (npc.role === 'leaderboard_keeper') {
      this.openLeaderboardModal();
    }
  }

  /**
   * STEP 1 OF QUEST DIALOG:
   * Shows the Animated Character Face, narrative greeting, and all 5 Quest Spots in the World,
   * and prompts the user to click "Accept Trial" BEFORE showing any questions!
   */
  private openTrialAcceptanceModal(quest: QuestDefinition, npcOverride?: WorldNpc): void {
    const kicker = document.getElementById('questDialogKicker');
    const title = document.getElementById('questDialogTitle');
    const body = document.getElementById('questDialogBody');
    if (!kicker || !title || !body) return;

    const worldTheme = WORLD_THEMES[quest.world];
    const npc =
      npcOverride ||
      worldTheme.npcs.find((n) => n.id === quest.npc_assigner) ||
      worldTheme.npcs[0];

    kicker.textContent = `${worldTheme.myanmarCity.toUpperCase()} • ${quest.campaign}`;
    title.textContent = quest.title || quest.quest_id;

    const worldQuests = this.quests.filter((q) => q.world === quest.world);
    const totalQuestions = quest.questions?.length || quest.pairs?.length || 1;

    body.innerHTML = `
      <!-- Animated Character Face + Greeting -->
      <div class="npc-portrait-banner">
        <canvas id="npcFaceCanvas" width="68" height="68" class="npc-face-canvas"></canvas>
        <div class="npc-dialogue-text">
          <div style="font-weight:800;color:#fde047;margin-bottom:0.2rem;">
            ${npc ? `${npc.name} (${npc.title})` : quest.npc_assigner.replace(/_/g, ' ')}
          </div>
          <div>"${quest.dialogue.greeting}"</div>
        </div>
      </div>

      <!-- Trial Details Card -->
      <div class="quiz-card" style="font-size:0.78rem;line-height:1.5;">
        <div><strong>📍 Location:</strong> ${quest.puzzle_object || 'Sector Shrine'} at <code>[${quest.spawn_location[0]}, ${quest.spawn_location[1]}]</code> (${worldTheme.myanmarCity})</div>
        <div><strong>📝 Format:</strong> ${totalQuestions} Question${totalQuestions > 1 ? 's' : ''} (1 question at a time)</div>
        <div><strong>🎁 Rewards:</strong> +${quest.rewards.xp} XP, +${quest.rewards.coins || 90} Gold, Badge: <code>${quest.rewards.badge}</code>, Unlock: <code>${quest.rewards.item_unlock}</code></div>
      </div>

      <!-- Prompt to Accept Trial Before Showing Questions -->
      <div class="action-row" style="margin-top:0.75rem;">
        <button type="button" class="pixel-btn accent" id="btnAcceptTrialNow">
          ✅ Accept Trial (${totalQuestions} Question${totalQuestions > 1 ? 's' : ''})
        </button>
        ${
          npc?.role === 'tailor'
            ? `<button type="button" class="pixel-btn" id="btnSwitchToTailorShop">👕 Open Tailor Shop</button>`
            : npc?.role === 'leaderboard_keeper'
              ? `<button type="button" class="pixel-btn" id="btnSwitchToLeaderboard">🏆 Open Notice Board</button>`
              : ''
        }
        <button type="button" class="pixel-btn" id="btnDeclineTrial">
          Not Now
        </button>
      </div>

      <!-- Switch between the 5 Quest Spots in this World -->
      <div style="margin-top:0.85rem;border-top:1px solid #334155;padding-top:0.65rem;">
        <div style="font-size:0.72rem;font-weight:700;color:#94a3b8;margin-bottom:0.4rem;">
          5 QUEST SPOTS IN ${worldTheme.name.toUpperCase()} (${worldTheme.myanmarCity.toUpperCase()}):
        </div>
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
          ${worldQuests
            .map((wq, i) => {
              const done = this.player.completedQuestIds.includes(wq.quest_id);
              const isSelected = wq.quest_id === quest.quest_id;
              return `
                <button
                  type="button"
                  class="world-nav-btn ${isSelected ? 'active' : ''}"
                  style="--world-color:${done ? '#22c55e' : '#facc15'};padding:0.38rem 0.55rem;font-size:0.72rem;"
                  data-select-quest="${wq.quest_id}"
                >
                  <span>Spot #${i + 1}: ${wq.title || wq.quest_id} [${wq.spawn_location[0]},${wq.spawn_location[1]}]</span>
                  <span>${done ? '✓ Done' : 'Select'}</span>
                </button>
              `;
            })
            .join('')}
        </div>
      </div>
    `;

    if (!this.questDialog.open) {
      this.questDialog.showModal();
    }

    const faceCanvas = document.getElementById('npcFaceCanvas') as HTMLCanvasElement | null;
    if (faceCanvas) {
      this.animateCharacterPortraitCanvas(
        faceCanvas,
        npc?.primaryColor || worldTheme.primaryHex,
        npc?.accentColor || worldTheme.accentHex
      );
    }

    document.getElementById('btnAcceptTrialNow')?.addEventListener('click', () => {
      this.player.x = quest.spawn_location[0];
      this.player.y = quest.spawn_location[1] + 16;
      this.player.pace.planCompleted = true;
      this.player.pace.assessCompleted = true;
      this.refreshAllUi();
      // Start at Question Index 0 (1 question at a time, no default selected answers)
      this.renderSingleQuestionStep(quest, 0, npc);
    });

    document.getElementById('btnDeclineTrial')?.addEventListener('click', () => {
      this.questDialog.close();
    });

    document.getElementById('btnSwitchToTailorShop')?.addEventListener('click', () => {
      this.questDialog.close();
      this.openTailorModal();
    });

    document.getElementById('btnSwitchToLeaderboard')?.addEventListener('click', () => {
      this.questDialog.close();
      this.openLeaderboardModal();
    });

    body.querySelectorAll<HTMLButtonElement>('[data-select-quest]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const qId = btn.dataset.selectQuest;
        const found = this.quests.find((item) => item.quest_id === qId);
        if (found) {
          this.player.activeQuestId = found.quest_id;
          this.refreshAllUi();
          this.openTrialAcceptanceModal(found);
        }
      });
    });
  }

  /**
   * STEP 2 OF QUEST DIALOG:
   * Shows 1 Question at a time (`questionIndex`) with NO default selected radio option!
   */
  private renderSingleQuestionStep(
    quest: QuestDefinition,
    questionIndex: number,
    npc?: WorldNpc
  ): void {
    const body = document.getElementById('questDialogBody');
    if (!body) return;

    const worldTheme = WORLD_THEMES[quest.world];
    const questions = quest.questions || [];
    const total = questions.length;
    const currentQ = questions[questionIndex];

    if (!currentQ) {
      this.completeQuestAndReward(quest, total, total);
      return;
    }

    let briefingHtml = '';
    if (quest.challenge_type === 'scorm_video' && quest.video_briefing && questionIndex === 0) {
      briefingHtml = `
        <div class="scorm-slide-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.35rem;">
            <strong style="color:#34d399;font-size:0.78rem;">🔮 ${quest.video_briefing.title}</strong>
            <span class="badge-chip">${quest.video_briefing.duration_label}</span>
          </div>
          ${quest.video_briefing.slides
            .map(
              (s) => `
              <div style="margin-top:0.35rem;padding:0.38rem;background:#0f172a;border-left:3px solid #10b981;">
                <div style="font-weight:700;font-size:0.75rem;">${s.heading}</div>
                <div style="font-size:0.72rem;color:#cbd5e1;margin-top:0.1rem;">${s.body}</div>
              </div>
            `
            )
            .join('')}
        </div>
      `;
    }

    body.innerHTML = `
      <div class="npc-portrait-banner">
        <canvas id="npcFaceCanvas" width="68" height="68" class="npc-face-canvas"></canvas>
        <div class="npc-dialogue-text">
          <span class="step-progress-pill">Question ${questionIndex + 1} of ${total}</span>
          <div style="font-weight:700;color:#fde047;">
            ${npc ? npc.name : quest.npc_assigner.replace(/_/g, ' ')}
          </div>
          <div style="font-size:0.76rem;color:#cbd5e1;">
            Select the best answer below to continue your trial.
          </div>
        </div>
      </div>

      ${briefingHtml}

      <form id="singleQuestionForm">
        <div class="quiz-card">
          <div style="font-weight:700;font-size:0.84rem;line-height:1.45;">
            ${currentQ.prompt}
          </div>
          <div class="quiz-options">
            ${currentQ.options
              .map(
                (opt, oIdx) => `
                <label class="quiz-option-label">
                  <!-- NO checked attribute by default! -->
                  <input type="radio" class="visually-hidden" name="single_q" value="${oIdx}" />
                  <span>${opt}</span>
                </label>
              `
              )
              .join('')}
          </div>
        </div>
        <div id="singleQuestionFeedback" style="margin-bottom:0.65rem;"></div>
        <div class="action-row">
          <button type="submit" class="pixel-btn accent">
            ${questionIndex + 1 < total ? 'Submit & Next Question →' : 'Complete Trial & Sync LMS ⚡'}
          </button>
        </div>
      </form>
    `;

    const faceCanvas = document.getElementById('npcFaceCanvas') as HTMLCanvasElement | null;
    if (faceCanvas) {
      this.animateCharacterPortraitCanvas(
        faceCanvas,
        npc?.primaryColor || worldTheme.primaryHex,
        npc?.accentColor || worldTheme.accentHex
      );
    }

    const form = document.getElementById('singleQuestionForm') as HTMLFormElement;
    const feedbackEl = document.getElementById('singleQuestionFeedback');

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const chosen = form.querySelector<HTMLInputElement>('input[name="single_q"]:checked');

      // Require user to explicitly pick an option (since none is default selected)
      if (!chosen) {
        if (feedbackEl) {
          feedbackEl.innerHTML = `
            <div style="padding:0.5rem;background:rgba(250,204,21,0.16);border:1px solid #facc15;color:#fef08a;font-size:0.78rem;border-radius:6px;">
              Please select an answer option above before continuing.
            </div>
          `;
        }
        return;
      }

      const selectedIdx = Number(chosen.value);
      if (selectedIdx !== currentQ.correct_index) {
        if (feedbackEl) {
          feedbackEl.innerHTML = `
            <div style="padding:0.55rem;background:rgba(220,38,38,0.22);border:1px solid #ef4444;color:#fca5a5;font-size:0.78rem;border-radius:6px;">
              <strong>Not quite!</strong> Hint: ${currentQ.explanation} Try selecting the option aligned with City Holdings Core Values!
            </div>
          `;
        }
        return;
      }

      // Advance to the next question or finish the quest!
      if (questionIndex + 1 < total) {
        this.renderSingleQuestionStep(quest, questionIndex + 1, npc);
      } else {
        this.completeQuestAndReward(quest, total, total);
      }
    });
  }

  private completeQuestAndReward(
    quest: QuestDefinition,
    score: number,
    maxScore: number
  ): void {
    this.player.pace.completeCompleted = true;
    this.player.pace.evaluateCompleted = true;

    if (!this.player.completedQuestIds.includes(quest.quest_id)) {
      this.player.completedQuestIds.push(quest.quest_id);
    }

    this.player.xp += quest.rewards.xp;
    this.player.coins += quest.rewards.coins || 90;

    if (quest.rewards.badge && !this.player.badges.includes(quest.rewards.badge)) {
      this.player.badges.push(quest.rewards.badge);
    }

    if (quest.rewards.item_unlock) {
      if (!this.player.unlockedCosmetics.includes(quest.rewards.item_unlock)) {
        this.player.unlockedCosmetics.push(quest.rewards.item_unlock);
      }
      const itemMeta = COSMETIC_CATALOG[quest.rewards.item_unlock];
      if (itemMeta) {
        this.player.equippedCosmetics[itemMeta.slot] = itemMeta.id;
      }
    }

    if (quest.rewards.unlocks_travel_pass) {
      this.player.travelPassUnlocked = true;
    }

    const sectorMeta = SECTOR_METADATA[this.player.sectorId];
    const ladderIdx = Math.min(3, Math.floor(this.player.xp / 200));
    this.player.level = 1 + Math.floor(this.player.xp / 200);
    this.player.classTitle = sectorMeta.classLadder[ladderIdx];

    this.player.chatBubble = `Cleared ${quest.quest_id}! +${quest.rewards.xp} XP & unlocked ${quest.rewards.item_unlock}!`;
    this.player.chatBubbleExpiresAt = Date.now() + 8500;

    const xapiRecord = realmBackend.dispatchXApiStatement({
      player: this.player,
      quest,
      score,
      maxScore,
    });

    realmBackend.savePlayerState(this.player);
    this.engine.rebuildWorldScene();
    this.refreshAllUi();

    const body = document.getElementById('questDialogBody');
    if (body) {
      body.innerHTML = `
        <div class="npc-portrait-banner" style="border-color:#22c55e;">
          <canvas id="npcFaceCanvas" width="68" height="68" class="npc-face-canvas"></canvas>
          <div class="npc-dialogue-text">
            <strong style="color:#4ade80;">🎉 TRIAL COMPLETE (${score}/${maxScore})</strong><br/>
            "${quest.dialogue.completion || 'Outstanding work!'}"
          </div>
        </div>
        <div class="quiz-card" style="font-size:0.78rem;line-height:1.5;">
          <div><strong>XP Awarded:</strong> +${quest.rewards.xp} XP (Total: ${this.player.xp} XP)</div>
          <div><strong>Class Rank:</strong> <span style="color:#facc15;">${this.player.classTitle}</span></div>
          <div><strong>Badge Earned:</strong> <code>${quest.rewards.badge}</code></div>
          <div><strong>3D Cosmetic Equipped:</strong> <code>${quest.rewards.item_unlock}</code></div>
          <div><strong>Portal Pass:</strong> <span style="color:#4ade80;">All 7 Myanmar Worlds Unlocked!</span></div>
          <div><strong>LMS xAPI Statement:</strong> <code>${xapiRecord.id.slice(0, 18)}…</code></div>
        </div>
        <div class="action-row">
          <button type="button" class="pixel-btn accent" id="btnCloseAfterQuest">Continue Exploring</button>
          <button type="button" class="pixel-btn" id="btnInspectXApiAfterQuest">View xAPI Statement</button>
        </div>
      `;

      const faceCanvas = document.getElementById('npcFaceCanvas') as HTMLCanvasElement | null;
      if (faceCanvas) {
        this.animateCharacterPortraitCanvas(faceCanvas, '#22c55e', '#facc15');
      }

      document.getElementById('btnCloseAfterQuest')?.addEventListener('click', () => {
        this.questDialog.close();
      });
      document.getElementById('btnInspectXApiAfterQuest')?.addEventListener('click', () => {
        this.questDialog.close();
        this.openXApiModal();
      });
    }
  }

  /**
   * Opens the 1:1 Single-Thread Conversation with Guardian Thura (`gemini-3.8-flash`).
   */
  private openGuardianModal(): void {
    this.renderGuardianThread();
    if (!this.guardianDialog.open) {
      this.guardianDialog.showModal();
    }
  }

  private renderGuardianThread(): void {
    const box = document.getElementById('guardianThreadBox');
    if (!box) return;

    const messages = guardianThura.getThread();
    box.innerHTML = messages
      .map(
        (m) => `
        <div class="guardian-msg ${m.sender}">
          <div style="font-size:0.65rem;font-weight:700;opacity:0.8;margin-bottom:0.15rem;">
            ${m.sender === 'guardian' ? `✨ Guardian ${GUARDIAN_NAME} (${GUARDIAN_MODEL})` : `👤 ${this.player.name}`}
          </div>
          <div>${m.text}</div>
        </div>
      `
      )
      .join('');

    box.scrollTop = box.scrollHeight;
  }

  private async sendGuardianQuestion(questionText: string): Promise<void> {
    const keyInput = document.getElementById('geminiApiKey') as HTMLInputElement | null;
    const worldQuests = this.quests.filter((q) => q.world === this.player.currentWorld);

    this.renderGuardianThread();
    await guardianThura.askGuardian({
      userMessage: questionText,
      player: this.player,
      questsInWorld: worldQuests,
      apiKey: keyInput?.value,
    });
    this.renderGuardianThread();
  }

  private openTreasureChest(chest: TreasureChest): void {
    if (this.player.openedChestIds.includes(chest.id)) return;
    this.player.openedChestIds.push(chest.id);
    this.player.coins += chest.coins;
    this.player.xp += chest.xp;

    if (!this.player.unlockedCosmetics.includes(chest.cosmeticId)) {
      this.player.unlockedCosmetics.push(chest.cosmeticId);
    }
    const item = COSMETIC_CATALOG[chest.cosmeticId];
    if (item) {
      this.player.equippedCosmetics[item.slot] = item.id;
    }

    this.player.chatBubble = `Opened ${chest.label}! +${chest.coins} Gold & ${chest.cosmeticId}!`;
    this.player.chatBubbleExpiresAt = Date.now() + 7500;

    realmBackend.savePlayerState(this.player);
    this.engine.rebuildWorldScene();
    this.refreshAllUi();
    this.updateProximityBanner(null);
  }

  public travelToWorld(targetWorld: WorldId): void {
    const canTravel =
      this.player.travelPassUnlocked ||
      targetWorld === 'The_HUB' ||
      targetWorld === this.player.homeWorld;

    if (!canTravel) {
      this.player.chatBubble =
        'Portal Locked! Complete 1 Core Values trial in The Hub (Bagan) or your home sector first!';
      this.player.chatBubbleExpiresAt = Date.now() + 6000;
      this.refreshAllUi();
      return;
    }

    const theme = WORLD_THEMES[targetWorld];
    this.player.currentWorld = targetWorld;
    this.player.x = theme.spawnsAt[0];
    this.player.y = theme.spawnsAt[1];
    this.ensureActiveQuestForWorld(targetWorld);
    this.colleagues = realmBackend.tickSimulatedColleagues(targetWorld);
    realmBackend.savePlayerState(this.player);
    this.engine.rebuildWorldScene();
    this.refreshAllUi();

    const worldDrawer = document.getElementById('worldDrawer');
    if (worldDrawer) worldDrawer.hidden = true;
  }

  private openTailorModal(): void {
    const body = document.getElementById('tailorDialogBody');
    if (!body) return;

    const items = Object.values(COSMETIC_CATALOG);
    body.innerHTML = `
      <div class="npc-portrait-banner">
        <div class="npc-dialogue-text">
          <strong style="color:#fde047;">Tailor Daw Khin (Bagan Silk Weaver):</strong><br/>
          "You have <strong>${this.player.coins} Gold Coins 🪙</strong>. Equip 3D hats, visors, tabards, greaves, and Bagan hot-air balloon pets!"
        </div>
      </div>
      <div class="cosmetic-grid">
        ${items
          .map((item) => {
            const owned = this.player.unlockedCosmetics.includes(item.id);
            const equipped = this.player.equippedCosmetics[item.slot] === item.id;
            return `
              <div class="cosmetic-card" style="border-color:${equipped ? '#22c55e' : '#334155'};">
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <strong style="color:${item.colorHex};font-size:0.82rem;">${item.name}</strong>
                    <span class="badge-chip">${item.slot.toUpperCase()}</span>
                  </div>
                  <p style="font-size:0.74rem;color:#cbd5e1;margin:0.3rem 0;">${item.description}</p>
                </div>
                <div>
                  ${
                    equipped
                      ? `<button type="button" class="pixel-btn sm" data-unequip-slot="${item.slot}">Unequip</button>`
                      : owned
                        ? `<button type="button" class="pixel-btn accent sm" data-equip-id="${item.id}">Equip on 3D Hero</button>`
                        : item.questOnly
                          ? `<span style="font-size:0.7rem;color:#facc15;">Unlock via Quest (${item.id})</span>`
                          : `<button type="button" class="pixel-btn sm" data-buy-id="${item.id}">Buy (${item.priceCoins} 🪙)</button>`
                  }
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;

    body.querySelectorAll<HTMLButtonElement>('[data-buy-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.buyId!;
        const item = COSMETIC_CATALOG[id];
        if (!item || this.player.coins < item.priceCoins) return;
        this.player.coins -= item.priceCoins;
        this.player.unlockedCosmetics.push(id);
        this.player.equippedCosmetics[item.slot] = id;
        realmBackend.savePlayerState(this.player);
        this.refreshAllUi();
        this.openTailorModal();
      });
    });

    body.querySelectorAll<HTMLButtonElement>('[data-equip-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.equipId!;
        const item = COSMETIC_CATALOG[id];
        if (!item) return;
        this.player.equippedCosmetics[item.slot] = id;
        realmBackend.savePlayerState(this.player);
        this.refreshAllUi();
        this.openTailorModal();
      });
    });

    body.querySelectorAll<HTMLButtonElement>('[data-unequip-slot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = btn.dataset.unequipSlot as CosmeticSlot;
        delete this.player.equippedCosmetics[slot];
        realmBackend.savePlayerState(this.player);
        this.refreshAllUi();
        this.openTailorModal();
      });
    });

    if (!this.tailorDialog.open) {
      this.tailorDialog.showModal();
    }
  }

  private openLeaderboardModal(): void {
    const sectorBody = document.getElementById('sectorLeaderboardBody');
    const indBody = document.getElementById('individualLeaderboardBody');
    if (!sectorBody || !indBody) return;

    const sectors = realmBackend.getSectorLeaderboard(this.player);
    sectorBody.innerHTML = sectors
      .map(
        (s) => `
        <tr>
          <th scope="row" style="color:${s.colorHex};">#${s.rank} ${s.teamColorName}</th>
          <td>${s.sectorName}</td>
          <td><strong>${s.completionRatePct}%</strong></td>
          <td>${s.totalQuestsCleared.toLocaleString()}</td>
        </tr>
      `
      )
      .join('');

    const individuals = realmBackend.getIndividualLeaderboard(this.player);
    indBody.innerHTML = individuals
      .map(
        (u) => `
        <tr style="${u.isCurrentUser ? 'background:rgba(56,189,248,0.15);' : ''}">
          <th scope="row">#${u.rank} ${u.name}</th>
          <td>${u.sectorId}</td>
          <td>${u.title}</td>
          <td><strong>${u.monthlyXp} XP</strong></td>
        </tr>
      `
      )
      .join('');

    if (!this.leaderboardDialog.open) {
      this.leaderboardDialog.showModal();
    }
  }

  private openGeminiModal(): void {
    const out = document.getElementById('geminiYamlOutput') as HTMLTextAreaElement;
    if (out && !out.value.trim()) {
      const sample = this.quests[0];
      if (sample) {
        out.value = `campaign: "${sample.campaign}"
quest_id: "${sample.quest_id}"
lms_hook: "${sample.lms_hook}"
world: "${sample.world}"
npc_assigner: "${sample.npc_assigner}"
spawn_location: [${sample.spawn_location[0]}, ${sample.spawn_location[1]}]
dialogue:
  greeting: "${sample.dialogue.greeting}"
challenge_type: "${sample.challenge_type}"
rewards:
  xp: ${sample.rewards.xp}
  badge: "${sample.rewards.badge}"
  item_unlock: "${sample.rewards.item_unlock}"`;
      }
    }
    if (!this.geminiDialog.open) {
      this.geminiDialog.showModal();
    }
  }

  private async handleGenerateGeminiYaml(): Promise<void> {
    const worldSel = document.getElementById('geminiWorldSelect') as HTMLSelectElement;
    const lmsInput = document.getElementById('geminiLmsHook') as HTMLInputElement;
    const keyInput = document.getElementById('geminiApiKey') as HTMLInputElement;
    const srcInput = document.getElementById('geminiSourceInput') as HTMLTextAreaElement;
    const outArea = document.getElementById('geminiYamlOutput') as HTMLTextAreaElement;

    const world = (worldSel?.value || 'Retail_Realm') as WorldId;
    const theme = WORLD_THEMES[world];
    const npc = theme.npcs[0]?.id || 'Coach_Ohnmar';

    outArea.value = '# Synthesizing YAML quest via Gemini AI Pipeline...';
    const yamlStr = await generateQuestYamlWithGemini({
      trainingText: srcInput.value,
      world,
      npcAssigner: npc,
      lmsHook: lmsInput.value || 'module_core_values_2026',
      campaign: 'City_Holdings_Core_Values',
      apiKey: keyInput.value,
    });
    outArea.value = yamlStr;
  }

  private handleDeployCustomYaml(): void {
    const outArea = document.getElementById('geminiYamlOutput') as HTMLTextAreaElement;
    if (!outArea?.value.trim()) return;
    try {
      const parsed = parseQuestYamlText(outArea.value);
      if (parsed.length > 0) {
        const newQuest = parsed[0];
        this.quests = [
          newQuest,
          ...this.quests.filter((q) => q.quest_id !== newQuest.quest_id),
        ];
        this.player.activeQuestId = newQuest.quest_id;
        this.travelToWorld(newQuest.world);
        this.geminiDialog.close();
      }
    } catch (err) {
      alert(`Invalid YAML syntax: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private openSsoModal(): void {
    const grid = document.getElementById('ssoSectorGrid');
    const nameInput = document.getElementById('ssoEmployeeName') as HTMLInputElement;
    if (nameInput) nameInput.value = this.player.name;

    if (grid) {
      grid.innerHTML = Object.values(SECTOR_METADATA)
        .map(
          (meta) => `
          <div class="sso-card" style="border-color:${meta.tunicHex};">
            <div>
              <strong style="color:${meta.accentHex};font-size:0.82rem;">${meta.worldName} (${meta.myanmarCity})</strong>
              <div style="font-size:0.72rem;color:#cbd5e1;margin-top:0.15rem;">${meta.name}</div>
            </div>
            <button type="button" class="pixel-btn sm" style="border-color:${meta.tunicHex};" data-sso-sector="${meta.id}">
              Spawn in ${meta.myanmarCity} (${meta.id})
            </button>
          </div>
        `
        )
        .join('');

      grid.querySelectorAll<HTMLButtonElement>('[data-sso-sector]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const sec = btn.dataset.ssoSector as BusinessUnitId;
          this.player = realmBackend.switchSsoBusinessUnit(
            this.player,
            sec,
            nameInput?.value || this.player.name
          );
          this.ensureActiveQuestForWorld(this.player.currentWorld);
          this.engine.rebuildWorldScene();
          this.refreshAllUi();
          this.ssoDialog.close();
        });
      });
    }

    if (!this.ssoDialog.open) {
      this.ssoDialog.showModal();
    }
  }

  private openXApiModal(): void {
    const body = document.getElementById('xapiDialogBody');
    if (!body) return;

    const logs = realmBackend.getXApiLogs();
    if (logs.length === 0) {
      body.innerHTML = `
        <p class="panel-hint">
          No quests completed yet in this session. Complete any Quest Spot (such as <code>val_integrity_01</code> at <code>[210, 440]</code> in Yangon Retail Realm) to inspect the live xAPI 1.0.3 statement!
        </p>
      `;
    } else {
      body.innerHTML = logs
        .map(
          (rec) => `
          <div class="quiz-card">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.35rem;font-size:0.76rem;">
              <strong>Quest: <code>${rec.questId}</code> • Hook: <code>${rec.lmsHook}</code></strong>
              <span class="badge-chip">Score: ${rec.scoreRatio} (+${rec.xpEarned} XP)</span>
            </div>
            <pre class="xapi-pre">${JSON.stringify(rec.rawJson, null, 2)}</pre>
          </div>
        `
        )
        .join('');
    }

    if (!this.xapiDialog.open) {
      this.xapiDialog.showModal();
    }
  }

  private refreshAllUi(): void {
    const theme = WORLD_THEMES[this.player.currentWorld];
    const root = document.documentElement;
    root.style.setProperty('--accent-primary', theme.primaryHex);

    const subtitle = document.getElementById('worldBannerSubtitle');
    if (subtitle) {
      subtitle.textContent = `${theme.name} • ${theme.myanmarCity}`;
    }

    const hudClass = document.getElementById('hudClassTitle');
    if (hudClass) hudClass.textContent = this.player.classTitle;
    const hudXp = document.getElementById('hudXp');
    if (hudXp) hudXp.textContent = `${this.player.xp} XP`;
    const hudCoins = document.getElementById('hudCoins');
    if (hudCoins) hudCoins.textContent = `${this.player.coins} 🪙`;
    const hudPass = document.getElementById('hudTravelPass');
    if (hudPass) {
      hudPass.textContent = this.player.travelPassUnlocked ? 'All 7 🔓' : 'Home+Hub';
    }

    // Update Simple Quest Icon Badge (e.g. 2/5 completed in current world)
    const miniMapTitle = document.getElementById('miniMapTitle');
    if (miniMapTitle) {
      miniMapTitle.textContent = `🗺️ ${theme.myanmarCity}`;
    }

    const worldQuests = this.quests.filter((q) => q.world === this.player.currentWorld);
    const clearedInWorld = worldQuests.filter((q) =>
      this.player.completedQuestIds.includes(q.quest_id)
    ).length;
    const questBadge = document.getElementById('questCountBadge');
    if (questBadge) {
      questBadge.textContent = `${clearedInWorld}/${worldQuests.length}`;
    }

    // World Navigation Drawer
    const navList = document.getElementById('worldNavList');
    if (navList) {
      navList.innerHTML = Object.values(WORLD_THEMES)
        .map((w) => {
          const isCurrent = w.id === this.player.currentWorld;
          const isUnlocked =
            this.player.travelPassUnlocked ||
            w.id === 'The_HUB' ||
            w.id === this.player.homeWorld;
          return `
            <button
              type="button"
              class="world-nav-btn ${isCurrent ? 'active' : ''} ${!isUnlocked ? 'locked' : ''}"
              style="--world-color: ${w.primaryHex};"
              data-world-id="${w.id}"
            >
              <div>
                <div>${w.name}</div>
                <div style="font-size:0.65rem;color:#94a3b8;">${w.myanmarCity} • 3 MCPs • 5 Quests</div>
              </div>
              <span>${isCurrent ? '● HERE' : isUnlocked ? 'PORTAL →' : '🔒 PASS'}</span>
            </button>
          `;
        })
        .join('');

      navList.querySelectorAll<HTMLButtonElement>('[data-world-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const target = btn.dataset.worldId as WorldId;
          this.travelToWorld(target);
        });
      });
    }

    // Active Quest Card
    const questBox = document.getElementById('activeQuestBox');
    const activeQuest =
      this.quests.find((q) => q.quest_id === this.player.activeQuestId) ||
      worldQuests[0];

    if (questBox && activeQuest) {
      const isDone = this.player.completedQuestIds.includes(activeQuest.quest_id);
      questBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem;">
          <div>
            <strong style="color:#facc15;">⚡ ${activeQuest.title || activeQuest.quest_id}</strong>
            <div style="font-size:0.68rem;color:#cbd5e1;">
              ${theme.myanmarCity} • 3 MCPs • Spot <code>[${activeQuest.spawn_location[0]}, ${activeQuest.spawn_location[1]}]</code>
            </div>
          </div>
          <button type="button" class="pixel-btn sm accent" id="btnQuickStartQuest">
            ${isDone ? 'Replay' : 'View Trial'}
          </button>
        </div>
      `;
      document.getElementById('btnQuickStartQuest')?.addEventListener('click', () => {
        this.openTrialAcceptanceModal(activeQuest);
      });
    }

    const badgesRow = document.getElementById('badgesRow');
    if (badgesRow) {
      badgesRow.innerHTML =
        this.player.badges.length > 0
          ? this.player.badges.map((b) => `<span class="badge-chip">🏅 ${b}</span>`).join('')
          : `<span style="font-size:0.68rem;color:#94a3b8;">Home Base: The Hub (Bagan) • 3 MCPs &amp; 5 Quest Spots per World</span>`;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new CityHoldingsRealmApp();
  app.init();
});
