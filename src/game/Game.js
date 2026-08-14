import { BALANCE } from '../config/balance.js';
import { DOM } from '../core/dom.js';
import { lerp } from '../core/lerp.js';
import { Grid } from '../core/grid.js';
import { Logger } from '../core/Logger.js';
import { RunStats } from '../core/RunStats.js';
import { HighScores } from '../core/HighScores.js';
import { Cosmetics } from '../core/Cosmetics.js';
import { RivalIdentity } from '../core/RivalIdentity.js';
import { Canvas, Ctx, Cam, Input, W, H, resize } from '../core/runtime.js';
import { AudioSys } from '../audio/audio.js';
import { bakeSprites } from '../render/bake.js';
import { HUD_COLORS, pickupVisual, renderVisual } from '../render/PixelRenderer.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Obstacle } from '../entities/Obstacle.js';
import { Turret } from '../entities/Turret.js';
import { GravityWell } from '../entities/GravityWell.js';
import { Particle, Debris, WeatherParticle, Shockwave, Floater, Decal } from '../entities/effects.js';
import { addXp, applyUpgrade, grantAiProgress, killReward, mechKillReward, progressionOwner, rollUpgradeChoices, xpForNextLevel } from '../progression/progression.js';
import { isHostile, resolveOutgoingDamage, rpgSplashDamage } from '../combat/damage.js';
import { rpgExplodeFx } from '../combat/rpgFeel.js';
import { randomLanceComposition } from '../entities/mechLifecycle.js';
import { formationSlotTarget } from '../entities/botTactics.js';
import { applyLoadout } from '../progression/tacticalUpgrades.js';
import { purchaseRivalLoadout } from '../progression/rivalBudget.js';
import { Hub } from '../ui/hub.js';

// @meta:Game - Main game state and loop controller - manages all entities, rendering, and game logic
// v8 Lance Update: player and rival each field a 3-mech Lance (playerLance/rivalLance). `player`
// always points at the currently human-controlled slot; the other two run on BotController AI.
export const Game = {
    active: false, paused: false, frame: 0, shake: 0, wave: 1, waveT: 0, boss: false, freeze: 0, biome: 'forest',
    player: null, playerLance: [], rivalLance: [], activeSlot: 0,
    enemies: [], bullets: [], obs: [], parts: [], decals: [], pows: [], floaters: [], weather: [], waves: [], difficulty: 1.0,
    combo: 0, comboT: 0, bgCv: null, bgCtx: null,
    lanceWiped: false, deathTimer: 0, deathReason: null, debris: [],
    lastTime: 0, accumulator: 0, step: 1/60,

    // Persistent meta-progression (spans missions within a run; reset only by beginNewRun)
    lanceComposition: ['battle', 'heavy', 'scout'],
    ceWallet: 0, missionCE: 0,
    winStreak: 0, lossStreak: 0,
    lanceSlotUpgrades: [new Set(), new Set(), new Set()],
    lanceSharedUpgrades: new Set(),
    rivalBudget: 0, rivalCompanyName: '', rivalMechKills: 0,
    rivalLoadout: [], rivalSharedUpgrades: [],
    playerMechKills: 0, missionsCleared: 0,
    cosmeticsOwned: new Set(['hudDefault']), activeCosmetic: 'hudDefault',
    killFeedQueue: [], killFeedTimer: 0,
    pendingMissionOutcome: null, missionEndAt: 0, pendingHubResult: null,

    friendlies: [],
    timeScale: 1.0,
    warpTimer: 0,
    critSlowMo: 0,
    critFlash: 0,
    bossDeathExplosions: [],
    upgradeChoices: [],
    pendingUpgradeCount: 0,
    upgradeChoiceOwner: null,
    perfPhases: { backgroundMs: 0, particlesMs: 0, domMs: 0 },

    initSystem: function() {
        AudioSys.init(); AudioSys.resume(); bakeSprites();
        this.bgCv = document.createElement('canvas'); this.bgCv.width = 3000; this.bgCv.height = 3000; this.bgCtx = this.bgCv.getContext('2d'); this.floaters = [];
        // Cosmetics persist forever (localStorage), independent of run/mission resets.
        const cosmetics = Cosmetics.load();
        this.cosmeticsOwned = new Set(cosmetics.owned);
        this.activeCosmetic = cosmetics.active;
        Hub.applyCosmetic(this.activeCosmetic);
        Logger.event('system', 'init_system', 'audio+sprites ready');
    },

    // --- Run / mission lifecycle (v8) ------------------------------------------------------

    /** Fresh campaign: wipes wallet, streaks, upgrades, rival identity. Shows the Lance hub. */
    beginNewRun: function() {
        this.ceWallet = 0; this.missionCE = 0;
        this.winStreak = 0; this.lossStreak = 0;
        this.lanceSlotUpgrades = [new Set(), new Set(), new Set()];
        this.lanceSharedUpgrades = new Set();
        this.rivalBudget = 0;
        // Blood debt (rival company + player-mech kill tally) survives across runs for the whole
        // browser session (sessionStorage) - same nemesis all session, not re-rolled every run.
        const identity = RivalIdentity.load();
        if(identity.companyName) {
            this.rivalCompanyName = identity.companyName;
            this.rivalMechKills = identity.mechKills;
        } else {
            this.rivalCompanyName = BALANCE.RIVAL.companyNames[Math.floor(Math.random() * BALANCE.RIVAL.companyNames.length)];
            this.rivalMechKills = 0;
            RivalIdentity.save(this.rivalCompanyName, this.rivalMechKills);
        }
        this.missionsCleared = 0;
        // Cosmetics are NOT reset here - they persist forever across runs (see initSystem/Cosmetics.js).
        RunStats.reset({ class: this.lanceComposition.join('+') });
        Logger.event('system', 'new_run', this.rivalCompanyName, { composition: this.lanceComposition });
        this.showLanceHub(null);
    },

    showLanceHub: function(missionResult) {
        DOM.hideAll(); DOM.hide('boss-hp-box'); DOM.hide('contract-briefing-screen');
        Hub.renderHub(missionResult);
        DOM.show('lance-hub-screen');
    },

    /** Called by the hub UI once the player confirms a 3-slot composition and hits DEPLOY. */
    confirmLanceComposition: function(newComposition) {
        for(let i=0; i<BALANCE.LANCE.size; i++) {
            if(this.lanceComposition[i] !== newComposition[i]) this.lanceSlotUpgrades[i] = new Set();
        }
        this.lanceComposition = newComposition.slice();
        this.prepareMission();
    },

    buildLanceMech: function(type, slot, faction) {
        const mech = new Player(type, { isBot: true, faction, lanceSlot: slot });
        return mech;
    },

    pickSpawnCorners: function(rng=Math.random) {
        const pairs = BALANCE.LANCE.cornerPairs;
        const pair = pairs[Math.floor(rng() * pairs.length)];
        const flip = rng() < 0.5;
        const playerCorner = flip ? pair[0] : pair[1];
        const rivalCorner = flip ? pair[1] : pair[0];
        const margin = BALANCE.LANCE.cornerMargin;
        const toXY = (corner) => ({ x: corner.x > 0 ? 3000 - margin : margin, y: corner.y > 0 ? 3000 - margin : margin });
        const playerXY = toXY(playerCorner);
        const rivalXY = toXY(rivalCorner);
        const angleTo = (from, to) => Math.atan2(to.y - from.y, to.x - from.x);
        return {
            player: playerXY, rival: rivalXY,
            playerFacing: angleTo(playerXY, rivalXY),
            rivalFacing: angleTo(rivalXY, playerXY),
        };
    },

    placeLanceAtCorner: function(lance, anchor, facing, rng=Math.random) {
        const leader = lance[0];
        leader.x = anchor.x - leader.w/2; leader.y = anchor.y - leader.h/2;
        if(this.checkWall(leader)) this.placeMechInField(leader, rng);
        leader.facing = facing;
        leader.saveState();
        for(let i=1; i<lance.length; i++) {
            const mech = lance[i];
            const slotTarget = formationSlotTarget(leader, i);
            mech.x = slotTarget.x - mech.w/2; mech.y = slotTarget.y - mech.h/2;
            if(this.checkWall(mech)) this.placeMechNear(mech, leader, rng);
            mech.facing = facing;
            mech.saveState();
        }
    },

    /** Builds a fresh mission: lances, map, rival shopping, contract briefing. Does not run the loop yet. */
    prepareMission: function() {
        AudioSys.stopMusic(); DOM.hideAll(); DOM.hide('boss-hp-box');
        this.active = false; this.paused = false;
        this.frame = 0; this.missionCE = 0; this.wave = 1; this.waveT = 0; this.boss = false;
        this.biome = this.randBiome();
        this.combo = 0; this.comboT = 0; this.lanceWiped = false; this.deathTimer = 0; this.deathReason = null; this.debris = [];
        this.lastTime = 0; this.accumulator = 0; Cam.x = 0; Cam.y = 0; Cam.lastX = 0; Cam.lastY = 0; Cam.rot = 0; Cam.trauma = 0;
        this.playerMechKills = 0; this.killFeedQueue = []; this.killFeedTimer = 0;
        this.pendingMissionOutcome = null; this.missionEndAt = 0;

        this.enemies=[]; this.bullets=[]; this.parts=[]; this.decals=[]; this.pows=[]; this.floaters=[]; this.weather=[]; this.waves=[];
        this.friendlies=[]; this.timeScale = 1.0; this.warpTimer = 0; this.critSlowMo = 0; this.bossDeathAnim = 0; this.bossDeathExplosions = [];
        this.upgradeChoices = []; this.pendingUpgradeCount = 0; this.upgradeChoiceOwner = null; DOM.hideUpgradeChoices();

        for(let i=0;i<50;i++) this.weather.push(new WeatherParticle(this.biome));
        this.genMap();

        const rng = Math.random;
        const corners = this.pickSpawnCorners(rng);
        const rivalComposition = randomLanceComposition(rng);
        const purchase = purchaseRivalLoadout(rivalComposition, this.rivalBudget, rng);
        this.rivalBudget = purchase.remaining;
        this.rivalLoadout = purchase.loadout;
        this.rivalSharedUpgrades = purchase.sharedUpgrades;

        this.playerLance = this.lanceComposition.map((type, slot) => this.buildLanceMech(type, slot, 'player'));
        this.rivalLance = rivalComposition.map((type, slot) => this.buildLanceMech(type, slot, 'rival'));

        this.activeSlot = 0;
        this._setActiveSlot(0, true);

        this.placeLanceAtCorner(this.playerLance, corners.player, corners.playerFacing, rng);
        this.placeLanceAtCorner(this.rivalLance, corners.rival, corners.rivalFacing, rng);

        this.playerLance.forEach((mech, slot) => applyLoadout(mech, mech.type, [...this.lanceSlotUpgrades[slot]], [...this.lanceSharedUpgrades]));
        this.rivalLoadout.forEach((entry, slot) => applyLoadout(this.rivalLance[slot], entry.class, entry.upgrades, this.rivalSharedUpgrades));

        RunStats.setMeta({ class: this.lanceComposition.join('+'), biome: this.biome });
        Logger.event('system', 'mission_prepared', 'contract briefing', {
            composition: this.lanceComposition, rivalComposition, biome: this.biome, rivalBudgetSpent: purchase.spent,
        });
        this.showContractBriefing();
    },

    showContractBriefing: function() {
        Hub.renderContractBriefing({
            biome: this.biome,
            companyName: this.rivalCompanyName,
            rivalMechKills: this.rivalMechKills,
            loadout: this.rivalLoadout,
            sharedUpgrades: this.rivalSharedUpgrades,
        });
        DOM.show('contract-briefing-screen');
    },

    deployMission: function() {
        DOM.hide('contract-briefing-screen'); DOM.show('ui-layer');
        this.active = true; this.paused = false;
        AudioSys.startMusic('game');
        requestAnimationFrame((t) => Game.loop(t));
    },

    resolveMissionEnd: function(outcome) {
        this.active = false;
        AudioSys.stopMusic();
        const share = outcome === 'win' ? 1 : (outcome === 'raceLoss' ? BALANCE.CE.raceLossShare : BALANCE.CE.wipeShare);
        const credited = Math.floor(this.missionCE * share);
        this.ceWallet += credited;
        RunStats.ceEarned(credited);
        if(outcome === 'win') {
            this.winStreak++; this.lossStreak = 0;
            this.rivalBudget += BALANCE.RIVAL.gainPerWin;
            this.missionsCleared++;
            RunStats.missionCleared();
        } else {
            this.lossStreak++; this.winStreak = 0;
        }
        Logger.event('system', 'mission_end', outcome, {
            outcome, missionCE: this.missionCE, credited, ceWallet: this.ceWallet,
            winStreak: this.winStreak, lossStreak: this.lossStreak,
        });
        const missionResult = { outcome, credited, missionCE: this.missionCE };
        if(outcome === 'wipe') {
            // A wipe fails THIS mission (same 50% CE penalty as any other loss, per
            // BALANCE.CE.wipeShare) but is not a run-ending "game over" - the CE wallet, streaks,
            // and tactical upgrades all persist (section 7: "непотраченный CE не сгорает").
            // Show a recap, then return to the hub.
            this.pendingHubResult = missionResult;
            this.showLanceWipeSummary();
            return;
        }
        this.showLanceHub(missionResult);
    },

    // --- Lance composition helpers -----------------------------------------------------------

    getMechs: function() {
        return [...this.playerLance, ...this.rivalLance].filter(m => m && m.hp > 0);
    },
    getAllLanceMechs: function() {
        return [...this.playerLance, ...this.rivalLance];
    },
    hasDeadLanceMate: function(mech) {
        if(!mech) return false;
        const lance = mech.faction === 'player' ? this.playerLance : (mech.faction === 'rival' ? this.rivalLance : null);
        return !!lance && lance.some(m => m.hp <= 0);
    },
    leaderOf: function(mech) {
        if(!mech) return null;
        if(mech.faction === 'player') return this.player;
        if(mech.faction === 'rival') return this.rivalLance.find(m => m.hp > 0) || null;
        return null;
    },
    nextLivingSlot: function(fromSlot) {
        const n = this.playerLance.length;
        for(let i=1; i<=n; i++) {
            const idx = (fromSlot + i) % n;
            if(this.playerLance[idx].hp > 0) return idx;
        }
        return null;
    },
    _setActiveSlot: function(slot, initial=false) {
        if(!initial) {
            const prev = this.playerLance[this.activeSlot];
            if(prev) { prev.isBot = true; prev.isHumanPlayer = false; prev.role = 'ally'; }
        }
        this.activeSlot = slot;
        const next = this.playerLance[slot];
        next.isBot = false; next.isHumanPlayer = true; next.role = 'human';
        this.player = next;
    },
    /** [C] key: cycle control to the next living lance mech. Left mech instantly goes AI-FOLLOW.
     *  A pending level-up choice does NOT block this - upgradeChoiceOwner (not this.player) is
     *  who the choice actually applies to, so switching away mid-choice and picking a perk later
     *  still credits the right mech instead of forcing you to stand still and pick blind (or die)
     *  while a teammate needs control right now. */
    switchControl: function() {
        if(!this.active || this.paused || !this.playerLance.length) return;
        const n = this.playerLance.length;
        for(let i=1; i<=n; i++) {
            const idx = (this.activeSlot + i) % n;
            if(this.playerLance[idx].hp > 0 && idx !== this.activeSlot) {
                this._setActiveSlot(idx);
                Logger.event('player', 'lance_switch', this.player.type, { slot: idx, class: this.player.type });
                return;
            }
        }
    },
    handleControlledMechDeath: function() {
        const next = this.nextLivingSlot(this.activeSlot);
        if(next != null) { this._setActiveSlot(next); return; }
        if(!this.lanceWiped) {
            this.lanceWiped = true; this.deathTimer = 150;
            if(!this.deathReason) this.deathReason = 'LANCE ELIMINATED';
            this.shake = 30; Cam.trauma = 1.0;
            for(let k=0; k<10; k++) this.debris.push(new Debris(this.player.x+16, this.player.y+16, '#00eaff'));
        }
    },

    getDamageableTargets: function() {
        return [
            ...this.getMechs(),
            ...this.enemies,
            ...this.friendlies.filter(entity => typeof entity.takeDamage === 'function'),
        ];
    },
    getCombatTargets: function(source) {
        return this.getDamageableTargets().filter(target => isHostile(source, target));
    },
    /** Bastion Shield (v8): a sheltered ally's damage redirects to the bearer's own HP/shield pool. */
    findBastionShelter: function(target) {
        // Only lance mechs shelter behind Bastion Shield - not turrets/gravity wells that share their faction.
        if(!target || !Number.isFinite(target.level) || (target.faction !== 'player' && target.faction !== 'rival')) return null;
        const radius = 28 * BALANCE.HEAVY_ABILITIES.bastionShieldRadiusMult;
        const radiusSq = radius * radius;
        const bearers = this.getMechs().filter(m => m !== target && m.bastionShield && m.faction === target.faction && m.shield > 0);
        for(let i=0; i<bearers.length; i++) {
            const bearer = bearers[i];
            const dx = (target.x+target.w/2) - (bearer.x+bearer.w/2);
            const dy = (target.y+target.h/2) - (bearer.y+bearer.h/2);
            if(dx*dx + dy*dy <= radiusSq) return bearer;
        }
        return null;
    },
    placeMechNear: function(mech, anchor=this.player, rng=Math.random) {
        const center = anchor || { x: 1500, y: 1500, w: 0, h: 0 };
        for(let attempt=0; attempt<40; attempt++) {
            const angle = rng() * Math.PI * 2;
            const distance = 80 + rng() * 140;
            const x = center.x + center.w/2 + Math.cos(angle) * distance - mech.w/2;
            const y = center.y + center.h/2 + Math.sin(angle) * distance - mech.h/2;
            if(!this.checkWall({ x, y, w: mech.w, h: mech.h })) {
                mech.x = x; mech.y = y; mech.saveState();
                return true;
            }
        }
        mech.x = 1500; mech.y = 1500; mech.saveState();
        return false;
    },
    placeMechInField: function(mech, rng=Math.random) {
        for(let attempt=0; attempt<80; attempt++) {
            const x = rng() * 2800 + 100;
            const y = rng() * 2800 + 100;
            if(!this.checkWall({ x, y, w: mech.w, h: mech.h })) {
                mech.x = x; mech.y = y; mech.saveState();
                return true;
            }
        }
        return this.placeMechNear(mech, { x: 1500, y: 1500, w: 0, h: 0 }, rng);
    },
    togglePause: function() { if(!this.active)return; this.paused=!this.paused; const p=document.getElementById('pause-screen'); if(this.paused){ AudioSys.stopMusic(); if(p)p.classList.remove('hidden'); this.lastTime = 0; Logger.event('system', 'pause', 'paused'); }else{ AudioSys.startMusic(this.boss?'boss':'game'); if(p)p.classList.add('hidden'); Logger.event('system', 'unpause', 'resumed'); } },
    /** Drops any pending level-up choice - used when its owner mech dies before picking (the
     *  choice belonged to them, not whoever is controlled now) so the UI never gets stuck showing
     *  a dead mech's perk options and blocking the next mech's level-up from queuing up. */
    forfeitUpgradeChoice: function() {
        this.pendingUpgradeCount = 0;
        this.upgradeChoices = [];
        this.upgradeChoiceOwner = null;
        DOM.hideUpgradeChoices();
    },
    offerUpgrade: function() {
        const owner = this.upgradeChoiceOwner;
        if(owner && owner.hp <= 0) { this.forfeitUpgradeChoice(); return; }
        if(!owner || this.pendingUpgradeCount <= 0 || this.upgradeChoices.length > 0) return;
        this.upgradeChoices = rollUpgradeChoices(owner);
        if(this.upgradeChoices.length === 0) {
            this.pendingUpgradeCount = 0;
            this.upgradeChoiceOwner = null;
            DOM.hideUpgradeChoices();
            return;
        }
        DOM.showUpgradeChoices(this.upgradeChoices);
    },
    selectUpgrade: function(index) {
        const choice = this.upgradeChoices[index];
        const owner = this.upgradeChoiceOwner;
        if(!choice || !owner) return false;
        applyUpgrade(owner, choice.id);
        this.pendingUpgradeCount = Math.max(0, this.pendingUpgradeCount - 1);
        this.upgradeChoices = [];
        DOM.hideUpgradeChoices();
        Logger.event('progression', 'upgrade_selected', choice.id, {
            level: owner.level,
            rarity: choice.rarity,
            pending: this.pendingUpgradeCount,
        });
        if(this.pendingUpgradeCount <= 0) this.upgradeChoiceOwner = null;
        this.offerUpgrade();
        return true;
    },
    /** Human-controlled mech's own level/XP + upgrade-choice UI (wallet crediting happens in
     *  grantKillProgressForVictim, for the whole Lance - see below). The mech that earns the XP is
     *  locked in as upgradeChoiceOwner right away, so switching control (C) while the choice is
     *  still pending can never hand the perk to whoever happens to be controlled when it's picked. */
    grantKillProgress: function(reward) {
        const levelsGained = addXp(this.player, reward);
        if(levelsGained <= 0) return;

        if(this.pendingUpgradeCount <= 0) this.upgradeChoiceOwner = this.player;
        this.pendingUpgradeCount += levelsGained;
        Logger.event('progression', 'level_up', `LEVEL ${this.player.level}`, {
            level: this.player.level,
            levelsGained,
            xp: this.player.xp,
            nextXp: xpForNextLevel(this.player.level),
        });
        this.offerUpgrade();
    },
    grantKillProgressForVictim: function(victim, rng=Math.random) {
        const killer = progressionOwner(victim?.lastAttacker);
        if(!killer || killer === victim || !Number.isFinite(victim?.maxHp)) {
            return { killer: null, reward: 0, levelsGained: 0, upgrades: [] };
        }
        const isMech = Number.isFinite(victim.level);
        const reward = isMech ? mechKillReward(victim.maxHp, victim.level) : killReward(victim.maxHp);

        // Combat Experience is a whole-Lance pool (section 7): ANY player-side kill - human or
        // AI-follow ally - feeds missionCE, which credits the wallet at mission end. Previously
        // this only fired for the currently human-controlled mech, so ally kills (routinely most
        // of a 3-mech Lance's kills) silently vanished instead of reaching the wallet.
        if(killer.faction === 'player') this.missionCE += reward;

        if(killer === this.player) {
            const levelBefore = this.player.level;
            this.grantKillProgress(reward);
            return {
                killer,
                reward,
                levelsGained: this.player.level - levelBefore,
                upgrades: [],
            };
        }
        if(killer.isBot && killer.hp > 0) {
            const result = grantAiProgress(killer, reward, rng);
            if(result.levelsGained > 0) {
                Logger.event('progression', 'ai_level_up', `${killer.role} LEVEL ${killer.level}`, {
                    role: killer.role,
                    class: killer.type,
                    level: killer.level,
                    upgrades: result.upgrades,
                });
            }
            return { killer, reward, ...result };
        }
        return { killer, reward: 0, levelsGained: 0, upgrades: [] };
    },

    pushKillFeed: function(text) {
        this.killFeedQueue.push(text);
    },

    getDifficultyMultiplier: function() { return 1 + (Math.floor(this.wave / 10) * 0.1); },
    randBiome: function(exclude) { const b = ['forest','ruins','dungeon']; let res = b[Math.floor(Math.random()*3)]; if(exclude) { while(res === exclude) res = b[Math.floor(Math.random()*3)]; } return res; },
    genMap: function() {
        this.obs=[]; Grid.clear(); renderVisual('background.biome', { context: this.bgCtx, biome: this.biome, width: 3000, height: 3000 });
        const alert = document.getElementById('biome-msg'); alert.innerText = this.biome.toUpperCase(); alert.classList.remove('hidden'); setTimeout(()=>alert.classList.add('hidden'),3000);
        // Optimized map generation - replaced Math.hypot with squared distance checks
        const centerX = 1500, centerY = 1500;
        if(this.biome==='ruins') {
            const minDistSq = 90000; // 300^2
            for(let i=0; i<40; i++) {
                let cx = Math.random()*2800+100; let cy = Math.random()*2800+100;
                let dx = cx-centerX, dy = cy-centerY;
                if(dx*dx + dy*dy > minDistSq) {
                    this.addOb(new Obstacle(cx,cy,'wall','ruins'));
                    if(Math.random()>0.5) this.addOb(new Obstacle(cx+64,cy,'wall','ruins'));
                    if(Math.random()>0.5) this.addOb(new Obstacle(cx,cy+64,'wall','ruins'));
                }
            }
        }
        else if(this.biome==='dungeon') {
            const minDistSq = 160000; // 400^2
            for(let i=0;i<250;i++) {
                let x=Math.random()*2900, y=Math.random()*2900;
                let dx = x-centerX, dy = y-centerY;
                if(dx*dx + dy*dy > minDistSq) this.addOb(new Obstacle(x,y,'wall','dungeon'));
            }
        }
        else {
            const minDistSq = 90000; // 300^2
            for(let i=0;i<300;i++){
                let t=Math.random()>0.9?'house':(Math.random()>0.8?'water':'tree');
                let x=Math.random()*2900, y=Math.random()*2900;
                let dx = x-centerX, dy = y-centerY;
                if(dx*dx + dy*dy > minDistSq) this.addOb(new Obstacle(x,y,t,'forest'));
            }
        }
        this.weather=[]; for(let i=0;i<50;i++) this.weather.push(new WeatherParticle(this.biome));
    },
    addOb: function(o) { this.obs.push(o); if(o.t!=='water') Grid.add(o); },
    checkWall: function(r) {
        if(r.x<0||r.x+r.w>3000||r.y<0||r.y+r.h>3000)return true;
        const nearby = Grid.get(r);
        // Optimized collision check - replaced for...of with for loop
        for(let i=0, len=nearby.length; i<len; i++) {
            if(nearby[i].rectIntersect(r)) return true;
        }
        return false;
    },

    explode: function(x,y,rad,friend,pushOnly=false, noScorch=false, isBotSource=false, sourceEntity=null, rpgBullet=null, damageOverride=null) {
        const isBigExplosion = rad > 90;
        const radSq = rad*rad; // Cache squared radius for all checks
        const isRPG = rpgBullet !== null && rpgBullet.wep === 'rpg';
        const source = sourceEntity || rpgBullet?.source || {
            faction: friend ? 'player' : (isBotSource ? 'rival' : 'enemy'),
        };
        const rivalSource = source.faction === 'rival';
        if(isRPG) {
            Logger.event('combat', 'explode', 'rpg', { x: +x.toFixed(0), y: +y.toFixed(0), rad, friend: !!friend, lvl: rpgBullet.lvl });
        }

        // Visual and audio effects
        if(!pushOnly) {
            if(isRPG) {
                AudioSys.rpgBoom(x);
                this.waves.push(new Shockwave(x,y,rad));
                const fx = rpgExplodeFx({ isBotSource: rivalSource, isBigExplosion });
                this.shake = Math.max(this.shake, fx.shake);
                Cam.trauma = Math.min(1.0, Cam.trauma + fx.trauma);
            } else {
                AudioSys.boom(x); this.waves.push(new Shockwave(x,y,rad));
                let shakeAmt = 5;
                if((!friend && !isBotSource) || isBigExplosion) {
                    shakeAmt = 15;
                    Cam.trauma = Math.min(1.0, Cam.trauma + 0.5);
                }
                if(isBotSource && !isBigExplosion) shakeAmt = 8;
                this.shake = Math.max(this.shake, shakeAmt);
            }
            for(let i=0;i<20;i++)this.parts.push(new Particle(x,y,'#fa0'));
            if(!noScorch) { this.bgCtx.save(); this.bgCtx.globalCompositeOperation='multiply'; new Decal(x,y,'rgba(0,0,0,0.5)').draw(this.bgCtx); this.bgCtx.restore(); }
        }

        const targets = this.getDamageableTargets();
        for(let i=0; i<targets.length; i++) {
            const target = targets[i];
            if(target === sourceEntity || !isHostile(source, target)) continue;
            const dx = target.x-x, dy = target.y-y;
            const distSq = dx*dx + dy*dy;
            if(distSq >= radSq) continue;

            let damage = damageOverride;
            if(damage == null && isRPG) damage = rpgSplashDamage(Math.sqrt(distSq), rad);
            if(damage == null && target instanceof Turret) damage = BALANCE.DAMAGE.turretExplode;
            if(damage == null && target.faction === 'enemy') {
                damage = pushOnly ? BALANCE.DAMAGE.explodeFriendPush : BALANCE.DAMAGE.explodeFriend;
            }
            if(damage == null && source.faction === 'enemy') {
                damage = pushOnly ? 0 : BALANCE.DAMAGE.explodeEnemyVsMech;
            }
            if(damage == null) {
                damage = pushOnly ? BALANCE.DAMAGE.explodeVsMechPush : BALANCE.DAMAGE.explodeVsMech;
            }
            if(damage <= 0) continue;
            if(target.t) this.dmg(target, damage, sourceEntity || source);
            else this.damageTarget(target, damage, sourceEntity || source);
        }
    },
    damageTarget: function(target, baseDamage, source, channel='generic') {
        if(!target || typeof target.takeDamage !== 'function') return null;
        const resolved = resolveOutgoingDamage(source, target, baseDamage);
        if(resolved.isCrit) {
            this.critSlowMo = 8;
            AudioSys.critHit();
            Logger.debug('combat', 'crit', 'critical hit', { finalDmg: resolved.amount, critSlowMo: this.critSlowMo, timeScale: this.timeScale });
        }
        const bearer = this.findBastionShelter(target);
        const applied = (bearer || target).takeDamage(resolved.amount, source, channel);
        return { ...resolved, applied };
    },
    dmg: function(e,d, source) {
        const result = this.damageTarget(e, d, source);
        if(!result || !e.t) return result;
        const finalDmg = result.amount;
        e.hitT = 5;
        this.floaters.push(new Floater(e.x + e.w/2, e.y, finalDmg, result.isCrit));
        let c = e.blood==='oil' ? '#333' : e.blood;
        for(let i=0;i<3;i++)this.parts.push(new Particle(e.x+e.w/2,e.y+e.h/2, c));

        if(e.hp <= 0 && ['mantis','fortress','eye'].includes(e.t) && !e._runStatsCounted) {
            const killer = progressionOwner(source);
            if(killer?.faction === 'rival') {
                // Count boss kill before the enemies-array death loop would be too late.
                RunStats.kill(e.t, false, true);
                Logger.event('combat', 'boss_kill', e.t, {
                    type: e.t, boss: true, byPlayer: false, wave: this.wave,
                });
                e._runStatsCounted = true;
                this.resolveMissionEnd('raceLoss');
            }
        }
        return result;
    },
    spawnLoot: function(x,y) {
        // Updated Loot Table with Modules + Resurrect (v8) - turret removed (battle carries it by default)
        const lootTable = [
            'repair','repair','repair',
            'shotgun','shotgun',
            'mg','mg',
            'rpg',
            'laser',
            'shield','shield',
            'quad','freeze',
            'resurrect',
            'warp','emp','grav','overclock' // Modules
        ];
        const t = lootTable[Math.floor(Math.random()*lootTable.length)];
        this.pows.push({x:x,y:y,t:t,l:800});
    },
    addCombo: function() { this.combo++; this.comboT = 60; },

    _fmtKillBag: function(bag) {
        // Mech kills lead the list regardless of count - killing an enemy Lance mech is the
        // headline result of a mission, monster mulch is the footnote.
        const keys = Object.keys(bag).sort((a, b) => (
            (b === 'mech') - (a === 'mech') || (bag[b] | 0) - (bag[a] | 0) || a.localeCompare(b)
        ));
        if (!keys.length) return '—';
        return keys.map((k) => `${k.toUpperCase()} ×${bag[k]}`).join('  ');
    },

    renderRunSummary: function(snap, hsResult) {
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
        set('final-score', snap.ce);
        set('death-reason', snap.reason || 'SYSTEM COLLAPSE');
        set('go-wave', 'WAVE ' + snap.wave);
        set('go-class', (snap.class || '?').toUpperCase().split('+').map((c) => `[${c}]`).join('+'));
        set('go-biome', (snap.biome || '?').toUpperCase());
        set('go-you-total', String(snap.playerTotal | 0));
        set('go-bot-total', String(snap.botTotal | 0));
        set('go-you-kills', this._fmtKillBag(snap.playerKills || {}));
        set('go-bot-kills', this._fmtKillBag(snap.botKills || {}));

        const badge = document.getElementById('go-rank-badge');
        if (badge) {
            if (hsResult && hsResult.rank) {
                badge.classList.remove('hidden');
                badge.innerText = hsResult.rank === 1 ? 'NEW HIGH' : ('RANK #' + hsResult.rank);
            } else {
                badge.classList.add('hidden');
                badge.innerText = '';
            }
        }

        const list = document.getElementById('go-highscores');
        if (list) {
            const entries = (hsResult && hsResult.entries) || HighScores.load();
            list.innerHTML = entries.length
                ? entries.map((e, i) => {
                    const mark = (hsResult && hsResult.rank === i + 1) ? ' class="hs-row hs-current"' : ' class="hs-row"';
                    return `<div${mark}><span class="hs-rank">#${i + 1}</span> <span class="text-highlight">${e.ce|0}</span> CE · ${(e.class||'?').toUpperCase()} · MISSIONS ${e.missionsCleared|0} · R${e.rivalKills|0}</div>`;
                }).join('')
                : '<div class="hs-row hs-empty">NO RECORDS</div>';
        }
    },

    /**
     * Lance-wipe recap screen: session totals (kills, CE, missions cleared) and a high-score
     * submit, purely as a dramatic checkpoint - NOT a run reset. `continueAfterWipe()` returns
     * to the Lance Hub with the CE wallet, streaks, and tactical upgrades untouched.
     */
    showLanceWipeSummary: function() {
        const why = this.deathReason || 'SYSTEM COLLAPSE';
        AudioSys.stopMusic(); DOM.hideAll(); DOM.show('game-over-screen');
        RunStats.setMeta({
            class: this.lanceComposition.join('+'),
            biome: this.biome,
            wave: this.wave,
        });
        const snap = RunStats.snapshot(why);
        const hsResult = HighScores.submit(snap);
        this.renderRunSummary(snap, hsResult);
        Logger.event('player', 'lance_wiped', why, snap);
        Logger.flush();
    },

    /** [CONTINUE] on the wipe recap screen: back to the hub, wallet/streaks/upgrades intact. */
    continueAfterWipe: function() {
        const result = this.pendingHubResult || { outcome: 'wipe', credited: 0, missionCE: 0 };
        this.pendingHubResult = null;
        this.showLanceHub(result);
    },

    updateLanceMech: function(mech, isPlayerSide) {
        if(mech.hp > 0) { mech.update(); return; }
        if(mech.justDied) return;
        mech.justDied = true;
        const progress = this.grantKillProgressForVictim(mech);
        Game.explode(mech.x+16, mech.y+16, 60, isPlayerSide, false, false, !isPlayerSide, mech);
        if(isPlayerSide) {
            if(progress.killer?.faction === 'rival') {
                this.rivalMechKills++; RivalIdentity.save(this.rivalCompanyName, this.rivalMechKills);
                RunStats.kill('mech', false);
            }
            Logger.event('bot', 'lance_mech_death', mech.type, { class: mech.type, slot: mech.lanceSlot, level: mech.level });
            if(mech === this.upgradeChoiceOwner) this.forfeitUpgradeChoice();
            if(mech === this.player) this.handleControlledMechDeath();
        } else {
            if(progress.killer?.faction === 'player') {
                this.playerMechKills++;
                progress.killer.mechKills = (progress.killer.mechKills || 0) + 1;
                RunStats.rival();
                RunStats.kill('mech', true);
                this.pushKillFeed('ENEMY MECH DESTROYED');
            }
            Logger.event('combat', 'rival_mech_death', mech.type, { class: mech.type, level: mech.level });
        }
    },

    updateLogic: function() {
        // Critical hit slow-motion effect (duration: 8 frames)
        if(this.critSlowMo > 0) {
            this.critSlowMo--;
        }

        // Boss death animation timer (duration: 120 frames)
        if(this.bossDeathAnim > 0) {
            this.bossDeathAnim--;
        }

        // Scheduled explosions for boss death sequence
        for(let i=this.bossDeathExplosions.length-1;i>=0;i--) {
            let exp = this.bossDeathExplosions[i];
            if(this.frame >= exp.frame) {
                this.explode(exp.x, exp.y, 150, true, false, false);
                this.bossDeathExplosions.splice(i,1);
            }
        }

        if(this.pendingMissionOutcome && this.frame >= this.missionEndAt) {
            const outcome = this.pendingMissionOutcome;
            this.pendingMissionOutcome = null;
            this.resolveMissionEnd(outcome);
            return;
        }

        // Warp module time scale restoration
        if(this.warpTimer > 0) {
            this.warpTimer--;
            if(this.warpTimer <= 0) this.timeScale = 1.0;
        }

        if(!this.player) return;
        for(let i=0; i<this.playerLance.length; i++) this.playerLance[i].saveState();
        for(let i=0; i<this.rivalLance.length; i++) this.rivalLance[i].saveState();
        for(let i=0; i<this.enemies.length; i++) this.enemies[i].saveState();
        for(let i=0; i<this.bullets.length; i++) this.bullets[i].saveState();
        for(let i=0; i<this.parts.length; i++) this.parts[i].saveState();
        for(let i=0; i<this.debris.length; i++) this.debris[i].saveState();
        for(let i=0; i<this.weather.length; i++) this.weather[i].saveState();
        for(let i=0; i<this.floaters.length; i++) this.floaters[i].saveState();
        for(let i=0; i<this.friendlies.length; i++) this.friendlies[i].saveState();

        Cam.lastX = Cam.x; Cam.lastY = Cam.y;

        let targetX = this.player.x + 16;
        let targetY = this.player.y + 16;
        if (!this.lanceWiped) {
             let lookVelX = (Input.mouse.wx - targetX) * 0.3;
             let lookVelY = (Input.mouse.wy - targetY) * 0.3;
             targetX += lookVelX; targetY += lookVelY;
        }
        let tx = targetX - W/2;
        let ty = targetY - H/2;

        if (Cam.trauma > 0) {
             Cam.trauma = Math.max(0, Cam.trauma - 0.02);
             let shake = Cam.trauma * Cam.trauma;
             let ang = (Math.random()-0.5) * Math.PI * 2;
             tx += Math.cos(ang) * shake * 20;
             ty += Math.sin(ang) * shake * 20;
             Cam.rot = (Math.random()-0.5) * shake * 0.05;
        } else {
            Cam.rot = 0;
            if(this.shake>0){tx+=(Math.random()-.5)*this.shake;ty+=(Math.random()-.5)*this.shake;this.shake*=0.9;}
        }
        let targetZoom = 1.0;
        if (this.boss) targetZoom = 0.9;
        else if (this.enemies.length > 15) targetZoom = 0.95;
        else if (this.player.dashActive) targetZoom = 0.98;
        Cam.zoom += (targetZoom - Cam.zoom) * 0.05;
        Cam.x+=(tx-Cam.x)*0.1; Cam.y+=(ty-Cam.y)*0.1;

        if(this.lanceWiped) {
            this.deathTimer--;
            for(let i=0; i<this.debris.length; i++) this.debris[i].update();
            for(let i=this.parts.length-1;i>=0;i--) { let p=this.parts[i]; p.update(); if(p.l<=0)this.parts.splice(i,1); }
            for(let i=0; i<this.waves.length; i++) this.waves[i].update();
            for(let i=0; i<this.weather.length; i++) this.weather[i].update();
            if(this.deathTimer <= 0) this.resolveMissionEnd('wipe');
            return;
        }

        Input.mouse.wx=Input.mouse.x+Cam.x; Input.mouse.wy=Input.mouse.y+Cam.y;
        if(this.combo > 0) { this.comboT--; if(this.comboT <= 0) this.combo = 0; }
        if(this.killFeedTimer > 0) { this.killFeedTimer--; if(this.killFeedTimer <= 0) DOM.hideKillFeed(); }
        else if(this.killFeedQueue.length > 0) {
            const text = this.killFeedQueue.shift();
            DOM.showKillFeed(text, this.playerMechKills);
            this.killFeedTimer = 90;
        }

        if(!this.boss) {
            this.waveT++; if(this.waveT>1200){
                this.wave++; this.waveT=0;
                Logger.event('wave', 'wave_advance', 'WAVE ' + this.wave, { wave: this.wave });
                if(this.wave%10===0){
                    this.boss=true; DOM.show('boss-hp-box');
                    const bName = this.biome==='forest'?'mantis':(this.biome==='ruins'?'fortress':'eye');
                    document.getElementById('boss-name').innerText = "TARGET: " + bName.toUpperCase();
                    AudioSys.startMusic('boss'); this.enemies.push(new Enemy(bName));
                    Logger.event('wave', 'boss_spawn', bName, { boss: bName, biome: this.biome, wave: this.wave });
                }
            }
            const spawnRate = Math.max(20, 60-this.wave*2);

            if(this.frame%spawnRate===0&&this.enemies.length<50){
                const pool = ['zombie'];
                if(this.wave > 1) pool.push('gunner', 'gunner');
                if(this.wave > 2) pool.push('stalker');
                if(this.wave > 3) pool.push('shotman');
                if(this.wave > 4) pool.push('commando');
                if(this.wave > 5) pool.push('tank', 'tank', 'tank');
                if(this.wave >= 6) pool.push('sniper');
                if(pool.length > 0) {
                    const t = pool[Math.floor(Math.random() * pool.length)];
                    try { this.enemies.push(new Enemy(t)); } catch(e) { Logger.error('error', 'enemy_spawn', e.message, { type: t }, e.stack); }
                }
            }
        } else {
            const bossEnt = this.enemies.find(e=>['mantis','fortress','eye'].includes(e.t));
            if(bossEnt) {
                const max = (this.biome==='ruins' ? BALANCE.ENEMIES.fortress.hp : (this.biome==='dungeon' ? BALANCE.ENEMIES.eye.hp : BALANCE.ENEMIES.mantis.hp)) * this.getDifficultyMultiplier();
                document.getElementById('boss-hp-bar').style.width = (bossEnt.hp / max * 100) + "%";
                const bossVal = document.getElementById('boss-hp-value'); if(bossVal) bossVal.textContent = `${Math.ceil(bossEnt.hp)}/${Math.round(max)}`;
            } else if(!this.pendingMissionOutcome) {
                // Boss entity gone with no mission outcome queued (e.g. a stray despawn) - treat as a win.
                this.boss=false; DOM.hide('boss-hp-box'); AudioSys.startMusic('game');
            }
        }

        if(this.freeze>0)this.freeze--;

        for(let i=0; i<this.playerLance.length; i++) this.updateLanceMech(this.playerLance[i], true);
        for(let i=0; i<this.rivalLance.length; i++) this.updateLanceMech(this.rivalLance[i], false);

        // Mech<->mech mutual contact damage: two hostile mechs standing in each other were already
        // pushed apart (see Player.js's mech-mech separation) but never actually hurt each other.
        // i<j visits each pair once; Player.takeDamage's own i-frames throttle repeats for free, so
        // no extra cooldown field is needed here (unlike the mech<->enemy pairing above, since Enemy
        // has no i-frame mechanic of its own). dashActive is excluded on both sides because a
        // dashing heavy already deals its own dash damage + knockback to any rival mech it rams
        // (Game.getCombatTargets includes hostile mechs) - this would otherwise double-hit it.
        {
            const allMechs = this.getAllLanceMechs();
            for(let i=0; i<allMechs.length; i++) {
                const a = allMechs[i];
                if(a.hp <= 0 || a.flying || a.dashActive) continue;
                for(let j=i+1; j<allMechs.length; j++) {
                    const b = allMechs[j];
                    if(b.hp <= 0 || b.flying || b.dashActive || !isHostile(a, b) || !a.rectIntersect(b)) continue;
                    this.damageTarget(a, BALANCE.DAMAGE.contact, b, 'contact');
                    this.damageTarget(b, BALANCE.DAMAGE.contact, a, 'contact');
                }
            }
        }

        // Optimized entity updates - replaced forEach with for loop
        for(let i=0; i<this.enemies.length; i++) this.enemies[i].update();
        for(let i=0, len=this.bullets.length; i<len; i++) this.bullets[i].update();
        for(let i=this.friendlies.length-1;i>=0;i--) {
            let f=this.friendlies[i];
            f.update();
            if((f instanceof Turret && f.hp<=0) || (f instanceof GravityWell && f.life<=0)) {
                Game.explode(
                    f.x+8, f.y+8, 20, f.faction === 'player', true, false,
                    f.faction === 'rival', f.owner || f,
                );
                this.friendlies.splice(i,1);
            }
        }

        for(let i=this.bullets.length-1;i>=0;i--) {
            let b=this.bullets[i]; if(b.dead){this.bullets.splice(i,1);continue;}
            const targets = this.getDamageableTargets();
            for(let j=0; j<targets.length; j++) {
                const target = targets[j];
                if(!isHostile(b.source, target) || !target.rectIntersect(b)) continue;

                const hitKey = `${target.x},${target.y},${this.frame}`;
                if(b.wep === 'laser' && b.laserHits.includes(hitKey)) continue;
                if(b.wep === 'laser') b.laserHits.push(hitKey);

                const hitResult = target.t ? this.dmg(target, b.dmg, b.source) : this.damageTarget(target, b.dmg, b.source);

                // Weapon-based hit feedback: a landed (not i-frame-blocked) hit shoves the target
                // a little along the bullet's travel direction (weapon-specific, see
                // BALANCE.WEAPONS.*.knockback) and - for mechs specifically, since monsters already
                // get their own blood-colored burst a few lines up in dmg() - a weapon-colored
                // particle burst, same palette Bullet.onObstacleHit() uses against walls. Without
                // this a mech only had the damage-number floater and the invuln blink to show a hit
                // actually landed.
                if(hitResult?.applied && target.hp > 0 && (target instanceof Player || target instanceof Enemy)) {
                    const knockback = BALANCE.WEAPONS[b.wep]?.knockback;
                    if(knockback) {
                        const dirLen = Math.hypot(b.vx, b.vy) || 1;
                        target.x += (b.vx / dirLen) * knockback;
                        target.y += (b.vy / dirLen) * knockback;
                    }
                    if(target instanceof Player) {
                        const impactColor = b.wep === 'laser' ? '#f0f' : '#fa0';
                        for(let k=0; k<3; k++) this.parts.push(new Particle(target.x + target.w/2, target.y + target.h/2, impactColor, 1.5));
                    }
                }

                if(b.wep === 'rpg') {
                    Game.explode(
                        b.x+b.w/2, b.y+b.h/2, b.splashRadius(),
                        b.faction === 'player', false, false, b.faction === 'rival', b.source, b,
                    );
                    b.dead = true;
                } else if(b.wep === 'shotgun' && b.lvl >= 3) {
                    Game.explode(
                        b.x+b.w/2, b.y+b.h/2, BALANCE.WEAPONS.shotgun.explodeRadiusL3,
                        b.faction === 'player', false, false, b.faction === 'rival', b.source, b,
                    );
                    b.dead = true;
                } else if(b.wep !== 'laser') {
                    b.dead = true;
                }
                if(b.wep !== 'laser') break;
            }
        }

        for(let i=this.pows.length-1;i>=0;i--) {
            let p=this.pows[i]; p.l--; if(p.l<=0){this.pows.splice(i,1);continue;}
            let lr = {...p,w:24,h:24};
            const mechs = this.getMechs();
            for(let j=0;j<mechs.length;j++) {
                const mech = mechs[j];
                if(!mech.flying && !mech.dashActive && mech.rectIntersect(lr)) {
                    this.applyPowerup(mech, p);
                    this.pows.splice(i,1);
                    break;
                }
            }
        }

        for(let i=this.enemies.length-1;i>=0;i--) {
            let e=this.enemies[i];
            if(e.hp<=0) {
                e.dead = true;
                const isBoss = ['mantis','fortress','eye'].includes(e.t);
                const progress = this.grantKillProgressForVictim(e);
                const killedByPlayer = progress.killer === this.player;
                const killedByPlayerSide = progress.killer?.faction === 'player';

                if (!e._runStatsCounted) {
                    RunStats.kill(e.t, killedByPlayer, isBoss);
                    Logger.event('combat', isBoss ? 'boss_kill' : 'enemy_killed', e.t, {
                        type: e.t, boss: isBoss, byPlayer: killedByPlayer, wave: this.wave,
                    });
                }
                if(isBoss && killedByPlayerSide) {
                    this.bossDeathAnim = 120;
                    const msgEl = document.getElementById('boss-death-msg');
                    if(msgEl) {
                        msgEl.style.display = 'block';
                        msgEl.style.animation = 'none';
                        setTimeout(() => { msgEl.style.animation = 'bossDeathAnim 2s forwards'; }, 10);
                        setTimeout(() => { msgEl.style.display = 'none'; }, 2000);
                    }
                    // Scheduled explosions for boss death sequence (10 explosions, spacing: 3 frames)
                    for(let j=0; j<10; j++) {
                        this.bossDeathExplosions.push({
                            x: e.x+e.w/2 + (Math.random()-0.5)*100,
                            y: e.y+e.h/2 + (Math.random()-0.5)*100,
                            frame: this.frame + j*3
                        });
                    }
                    // Particle burst for boss death (50 particles)
                    for(let k=0; k<50; k++) {
                        Game.parts.push(new Particle(e.x+e.w/2, e.y+e.h/2, '#f00', 3));
                    }
                    AudioSys.boom(e.x+e.w/2);
                    Cam.trauma = 1.0;
                    this.shake = 30;
                    // Mission won - resolve once the death cinematic has played out.
                    this.pendingMissionOutcome = 'win';
                    this.missionEndAt = this.frame + 130;
                }

                // Combo only counts player kills, not AI kills
                if(killedByPlayer) {
                    this.addCombo();
                }
                this.bgCtx.save();
                if(e.blood === 'oil') {
                    let size = e.w; if(e.t==='gunner') size=20; if(e.t==='tank') size=60;
                    if(!isBoss || !killedByPlayerSide) {
                        const killer = e.lastAttacker;
                        const botKill = killer?.faction === 'rival';
                        Game.explode(
                            e.x+e.w/2, e.y+e.h/2, size, killer?.faction === 'player', true, true,
                            botKill, killer || null,
                        );
                    }
                    this.bgCtx.globalCompositeOperation='multiply';
                    new Decal(e.x+e.w/2, e.y+e.h/2, '#333').draw(this.bgCtx);
                } else {
                    this.bgCtx.globalCompositeOperation='source-over';
                    new Decal(e.x+e.w/2, e.y+e.h/2, e.blood).draw(this.bgCtx);
                    if(!isBoss || !killedByPlayerSide) {
                        for(let k=0;k<8;k++)this.parts.push(new Particle(e.x,e.y, e.blood));
                    }
                }
                this.bgCtx.restore();

                if(Math.random()<0.2)this.spawnLoot(e.x,e.y);
                this.enemies.splice(i,1);
            } else {
                const mechs = this.getMechs();
                for(let j=0; j<mechs.length; j++) {
                    const mech = mechs[j];
                    if(!mech.flying && isHostile(e, mech) && mech.rectIntersect(e)) {
                        this.damageTarget(mech, e.contact ?? BALANCE.DAMAGE.contact, e, 'contact'); // existing, untouched
                        // Mutual contact damage: a mech ramming a monster used to hurt only the mech.
                        // Dashing is exempt here (Juggernaut Dash already lands its own dash damage +
                        // knockback on this same enemy this frame - see the dash block in Player.js -
                        // so this would otherwise double-hit it). Enemy has no i-frame mechanic of its
                        // own, unlike Player, so it gets its own dedicated cooldown.
                        if(!mech.dashActive && e.contactCd <= 0) {
                            this.damageTarget(e, BALANCE.DAMAGE.contact, mech, 'contact');
                            e.contactCd = BALANCE.DAMAGE.contactCooldown;
                        }
                    }
                }
                // Turret collision
                for(let i=0; i<Game.friendlies.length; i++) {
                    let f = Game.friendlies[i];
                    if(f instanceof Turret && f.rectIntersect(e)) {
                        this.damageTarget(f, e.contact ?? BALANCE.DAMAGE.contact, e, 'contact');
                        e.hitT = 10;
                    }
                }
            }
        }
        for(let i=this.floaters.length-1;i>=0;i--) { let f=this.floaters[i]; f.update(); if(f.life<=0)this.floaters.splice(i,1); }
        for(let i=0; i<this.weather.length; i++) this.weather[i].update();
        for(let i=this.waves.length-1;i>=0;i--) { let w=this.waves[i]; w.update(); if(w.life<=0)this.waves.splice(i,1); }
        this.frame++;
    },

    loop: function(currentTime) {
        try {
            if(!this.active) return;
            requestAnimationFrame((t)=>Game.loop(t));
            if(this.paused) { this.lastTime = currentTime; return; }
            if(!this.lastTime) this.lastTime = currentTime;
            let deltaTime = (currentTime - this.lastTime) / 1000;
            this.lastTime = currentTime;
            if (deltaTime > 0.1) deltaTime = 0.1;
            this.accumulator += deltaTime;
            let steps = 0;
            const t0 = performance.now();
            while (this.active && this.accumulator >= this.step) { this.updateLogic(); this.accumulator -= this.step; steps++; }
            const updateMs = performance.now() - t0;
            const alpha = this.accumulator / this.step;
            const t1 = performance.now();
            this.draw(alpha);
            const drawMs = performance.now() - t1;
            const audioMs = AudioSys.consumePerfTime();
            if(this.frame % 30 === 0) {
                Logger.info('perf', 'frame_sample', 'tick', {
                    updateMs: +updateMs.toFixed(2),
                    drawMs: +drawMs.toFixed(2),
                    frameMs: +(updateMs + drawMs).toFixed(2),
                    particlesMs: +this.perfPhases.particlesMs.toFixed(2),
                    backgroundMs: +this.perfPhases.backgroundMs.toFixed(2),
                    domMs: +this.perfPhases.domMs.toFixed(2),
                    audioMs: +audioMs.toFixed(2),
                    steps,
                    enemies: this.enemies.length,
                    playerLance: this.playerLance.filter(m=>m.hp>0).length,
                    rivalLance: this.rivalLance.filter(m=>m.hp>0).length,
                    bullets: this.bullets.length,
                    parts: this.parts.length,
                    friendlies: this.friendlies.length,
                    wave: this.wave,
                    frame: this.frame,
                    timeScale: this.timeScale,
                });
            }
        } catch(err) {
            Logger.error('error', 'loop_crash', err && err.message ? err.message : String(err), null, err && err.stack ? err.stack : null);
            Logger.flush();
            document.getElementById('error-screen').style.display='flex';
            document.getElementById('error-msg').innerText = err.stack;
            this.active = false;
        }
    },

    applyPowerup: function(entity, p) {
        if(p.t==='mine') { Game.explode(p.x,p.y,250,entity.faction==='player',false,false,entity.faction==='rival',entity); this.damageTarget(entity, BALANCE.DAMAGE.mineHp, null); for(let k=0;k<10;k++)this.parts.push(new Particle(p.x,p.y,'#fff')); return; }
        if(p.t==='resurrect') {
            const lance = entity.faction === 'player' ? this.playerLance : (entity.faction === 'rival' ? this.rivalLance : null);
            if(!lance) return;
            const dead = lance.filter(m => m.hp <= 0);
            if(dead.length > 0) {
                const revived = dead[Math.floor(Math.random()*dead.length)];
                revived.hp = revived.maxHp; revived.shield = 0; revived.inv = 90; revived.justDied = false;
                const leader = this.leaderOf(revived) || entity;
                this.placeMechNear(revived, leader, Math.random);
                if(!entity.isBot) AudioSys.power();
                Logger.event('bot', 'resurrect', revived.type, { faction: revived.faction, slot: revived.lanceSlot });
            }
            return; // full lance: denial pickup, bonus is already consumed by the caller
        }
        if(!entity.isBot) AudioSys.power();
        if(p.t==='repair') entity.hp=Math.min(entity.maxHp, entity.hp+BALANCE.PICKUPS.repair);
        else if(p.t==='quad') entity.quad=BALANCE.QUAD.duration;
        else if(p.t==='freeze') this.freeze=BALANCE.FREEZE_DURATION;
        else if(p.t==='shield') { entity.shield=Math.min(entity.maxShield, entity.shield+BALANCE.PICKUPS.shield); }
        else if(['warp','emp','grav','overclock'].includes(p.t)) {
            // Apply module logic
            entity.module = p.t; entity.moduleCd = 0;
        }
        else { if(entity.wep===p.t) entity.levels[p.t]++; else entity.wep=p.t; }
    },

    getModuleName: function(t) {
        if(t==='turret') return 'TURRET';
        if(t==='warp') return 'WARP';
        if(t==='emp') return 'EMP';
        if(t==='grav') return 'GRAVITY';
        if(t==='overclock') return 'OCLOCK';
        return 'MODULE';
    },

    getModuleIcon: function(t) {
        if(t==='turret') return '🔫';
        if(t==='warp') return '⏳';
        if(t==='emp') return '⚡';
        if(t==='grav') return '⚫';
        if(t==='overclock') return '🔥';
        return '?';
    },

    draw: function(alpha) {
        this.perfPhases.backgroundMs = 0;
        this.perfPhases.particlesMs = 0;
        this.perfPhases.domMs = 0;
        let camX = lerp(Cam.lastX, Cam.x, alpha);
        let camY = lerp(Cam.lastY, Cam.y, alpha);
        const origCamX = Cam.x; const origCamY = Cam.y;
        Cam.x = camX; Cam.y = camY;

        renderVisual('background.darkness', { color: '#000', width: W, height: H });
        Ctx.save();
        Ctx.translate(W/2, H/2);
        Ctx.scale(Cam.zoom, Cam.zoom);
        Ctx.rotate(Cam.rot);
        Ctx.translate(-W/2, -H/2);
        Ctx.translate(-camX,-camY);

        const backgroundStartedAt = performance.now();
        renderVisual('background.map', { image: this.bgCv });
        renderVisual('background.grid', { size: 3000 });

        for(let i=0; i<this.decals.length; i++) this.decals[i].draw(Ctx);
        this.perfPhases.backgroundMs = performance.now() - backgroundStartedAt;
        const camX2 = camX + W*2, camY2 = camY + H*2;
        for(let i=0; i<this.obs.length; i++) {
            let e = this.obs[i];
            if(e.x+e.w>camX-W&&e.x<camX2&&e.y+e.h>camY-H&&e.y<camY2) {
                renderVisual('shadow.ground', { x: lerp(e.lastX, e.x, alpha), y: lerp(e.lastY, e.y, alpha) + e.h - 8, width: e.w });
            }
        }
        for(let i=0; i<this.enemies.length; i++) {
            let e = this.enemies[i];
            if(e.t!=='eye' && e.x+e.w>camX-W&&e.x<camX2&&e.y+e.h>camY-H&&e.y<camY2) {
                renderVisual('shadow.ground', { x: lerp(e.lastX, e.x, alpha), y: lerp(e.lastY, e.y, alpha) + e.h - 8, width: e.w });
            }
        }
        for(let i=0; i<this.obs.length; i++) this.obs[i].draw(alpha);
        for(let i=0; i<this.friendlies.length; i++) this.friendlies[i].draw(alpha);
        // Optimized powerup rendering - replaced forEach with for loop
        const powBounce = Math.sin(this.frame*0.1)*5;
        for(let i=0, len=this.pows.length; i<len; i++) {
            let p = this.pows[i];
            if(p.x<camX-W||p.x>camX+W*2||p.y<camY-H||p.y>camY+H*2)continue;
            const pickup = pickupVisual(p.t);
            renderVisual(pickup.id, { x: p.x, y: p.y + powBounce });
        }
        for(let i=0; i<this.enemies.length; i++) this.enemies[i].draw(alpha);
        for(let i=0; i<this.playerLance.length; i++) this.playerLance[i].draw(alpha);
        for(let i=0; i<this.rivalLance.length; i++) this.rivalLance[i].draw(alpha);
        for(let i=0; i<this.bullets.length; i++) this.bullets[i].draw(alpha);
        const particlesStartedAt = performance.now();
        for(let i=this.parts.length-1;i>=0;i--) { let p=this.parts[i]; if(!this.lanceWiped) p.update(); p.draw(alpha); if(!this.lanceWiped && p.l<=0)this.parts.splice(i,1); }
        this.perfPhases.particlesMs = performance.now() - particlesStartedAt;
        for(let i=0; i<this.debris.length; i++) this.debris[i].draw(alpha);
        for(let i=0; i<this.weather.length; i++) this.weather[i].draw(alpha);
        for(let i=0; i<this.waves.length; i++) this.waves[i].draw();
        for(let i=0; i<this.floaters.length; i++) this.floaters[i].draw(alpha);

        // Warp module screen distortion effect (wave distortion)
        if(this.warpTimer > 0 && this.timeScale < 1.0) {
            renderVisual('background.warp', {
                width: W,
                height: H,
                color: `rgba(0, 255, 255, ${0.1 * (1 - this.timeScale)})`,
            });
        }

        Ctx.resetTransform();
        renderVisual('background.darkness', {
            color: (this.biome === 'dungeon' || this.biome === 'ruins') ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)',
            width: W,
            height: H,
        });

        if(this.lanceWiped && this.deathTimer > 0) {
            const redAlpha = 0.3 + Math.random() * 0.2;
            const flash = Math.random() > 0.5;
            renderVisual('background.death', {
                width: W,
                height: H,
                redAlpha,
                flash,
                flashAlpha: flash ? Math.random() * 0.1 : 0,
                flashY: flash ? Math.random() * H : 0,
            });
        }
        Ctx.restore();
        Cam.x = origCamX; Cam.y = origCamY;

        const bossEnt = this.enemies.find(e=>['mantis','fortress','eye'].includes(e.t));
        if(bossEnt) {
            const max = (this.biome==='ruins' ? BALANCE.ENEMIES.fortress.hp : (this.biome==='dungeon' ? BALANCE.ENEMIES.eye.hp : BALANCE.ENEMIES.mantis.hp)) * this.getDifficultyMultiplier();
            renderVisual('hud.boss', {
                x: W / 2 - 300,
                y: 100,
                width: 600,
                height: 20,
                percentage: Math.max(0, bossEnt.hp / max),
                text: `TARGET: ${bossEnt.t.toUpperCase()}`,
            });
        }
        if(this.combo >= 3) {
            let callout = null;
            if(this.combo >= 30) callout = 'LEGENDARY!';
            else if(this.combo >= 20) callout = 'GODLIKE!';
            else if(this.combo >= 10) callout = 'SLAUGHTER!';
            renderVisual('hud.combo', {
                x: W / 2,
                y: 140,
                combo: this.combo,
                alpha: this.comboT / 60,
                scale: 1 + Math.sin(this.frame * 0.5) * 0.1,
                callout,
            });
        }

        if(!this.player) return;
        const domStartedAt = performance.now();
        const glitchText = (txt) => { if(this.player.hp < this.player.maxHp*0.2 && Math.random()>0.7) return "!ERR0R!"; return txt; }
        document.getElementById('score').innerText = glitchText(this.missionCE);
        DOM.updateProgression(this.player.level, this.player.xp, xpForNextLevel(this.player.level));
        document.getElementById('wave').innerText=this.boss?"DANGER":"WAVE "+this.wave;
        document.getElementById('mech-hp').style.width=((this.player.hp/this.player.maxHp)*100)+"%";
        const hpVal = document.getElementById('mech-hp-value'); if(hpVal) hpVal.textContent = `${Math.ceil(this.player.hp)}/${this.player.maxHp}`;
        const wLvl=this.player.levels[this.player.wep];
        document.getElementById('weapon').innerHTML=this.player.wep.toUpperCase()+` <span style="color:#888;font-size:12px">LVL ${wLvl}</span>`;
        if(this.player.quad > 0) DOM.show('quad-indicator'); else DOM.hide('quad-indicator'); if(this.freeze > 0) DOM.show('freeze-indicator'); else DOM.hide('freeze-indicator');
        const sb = document.getElementById('shield-val'); if(sb) { sb.style.display = this.player.shield>0 ? 'flex' : 'none'; sb.innerText=`${this.player.shield}/${this.player.maxShield}`; }
        const jb = document.getElementById('mech-jet'); if(jb) { if(this.player.type === 'heavy') { jb.style.background = HUD_COLORS.red; let pct = (this.player.fuel / this.player.maxFuel) * 100; jb.style.width = pct + "%"; } else { jb.style.background = !this.player.canFly ? HUD_COLORS.red : HUD_COLORS.orange; jb.style.width = (this.player.fuel / this.player.maxFuel * 100) + "%"; } }
        const jbVal = document.getElementById('mech-jet-value'); if(jbVal) jbVal.textContent = `${Math.ceil(this.player.fuel)}/${this.player.maxFuel}`;
        if(this.player.hp < this.player.maxHp * 0.2) { document.getElementById('ui-layer').classList.add('critical-ui'); } else { document.getElementById('ui-layer').classList.remove('critical-ui'); }

        // UI UPDATE MODULE - resynced every frame so switching control (C) reflects the new mech's module
        if(this.player.module) {
            DOM.show('module-box');
            document.getElementById('mod-name').innerText = this.getModuleName(this.player.module);
            const cdElem = document.getElementById('mod-cd');
            if(this.player.moduleCd > 0) {
                 cdElem.innerText = Math.ceil(this.player.moduleCd / 60);
                 cdElem.style.color = HUD_COLORS.warning;
            } else {
                 cdElem.innerText = "READY";
                 cdElem.style.color = HUD_COLORS.cyan;
            }
        } else {
            DOM.hide('module-box');
        }

        Hub.updateLanceHud(this.playerLance, this.activeSlot);
        this.perfPhases.domMs = performance.now() - domStartedAt;
    }
};
