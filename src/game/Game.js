import { BALANCE } from '../config/balance.js';
import { DOM } from '../core/dom.js';
import { lerp } from '../core/lerp.js';
import { Grid } from '../core/grid.js';
import { Logger } from '../core/Logger.js';
import { RunStats } from '../core/RunStats.js';
import { HighScores } from '../core/HighScores.js';
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
import { addXp, applyUpgrade, grantAiProgress, killReward, progressionOwner, rollUpgradeChoices, xpForNextLevel } from '../progression/progression.js';
import { isHostile, resolveOutgoingDamage, rpgSplashDamage } from '../combat/damage.js';
import { rpgExplodeFx } from '../combat/rpgFeel.js';
import { randomMechClass, randomRivalGroupSize } from '../entities/mechLifecycle.js';

// @meta:Game - Main game state and loop controller - manages all entities, rendering, and game logic
export const Game = {
    active: false, paused: false, frame: 0, score: 0, rivalKills: 0, shake: 0, wave: 1, waveT: 0, boss: false, freeze: 0, biome: 'forest',
    player: null, allies: [], rivals: [], enemies: [], bullets: [], obs: [], parts: [], decals: [], pows: [], floaters: [], weather: [], waves: [], difficulty: 1.0,
    combo: 0, comboT: 0, bgCv: null, bgCtx: null, selectedClass: 'battle', rivalRespawnTimer: 0, companionRespawnTimer: 0,
    playerDead: false, deathTimer: 0, deathReason: null, debris: [],
    lastTime: 0, accumulator: 0, step: 1/60,

    friendlies: [],
    timeScale: 1.0,
    warpTimer: 0,
    critSlowMo: 0,
    critFlash: 0,
    bossDeathExplosions: [],
    upgradeChoices: [],
    pendingUpgradeCount: 0,
    perfPhases: { backgroundMs: 0, particlesMs: 0, domMs: 0 },

    initSystem: function() { AudioSys.init(); AudioSys.resume(); bakeSprites(); this.bgCv = document.createElement('canvas'); this.bgCv.width = 3000; this.bgCv.height = 3000; this.bgCtx = this.bgCv.getContext('2d'); this.floaters = []; Logger.event('system', 'init_system', 'audio+sprites ready'); },
    showClassSelect: function() { DOM.hide('start-screen'); DOM.show('class-select-screen'); },
    getMechs: function() {
        return [this.player, ...this.allies, ...this.rivals].filter(Boolean);
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
            const dx = x - this.player.x;
            const dy = y - this.player.y;
            if(dx*dx + dy*dy < 250000) continue;
            if(!this.checkWall({ x, y, w: mech.w, h: mech.h })) {
                mech.x = x; mech.y = y; mech.saveState();
                return true;
            }
        }
        return this.placeMechNear(mech, this.player, rng);
    },
    spawnCompanion: function(rng=Math.random) {
        if(!this.player || this.player.companionCapacity < 1 || this.allies.length > 0) return null;
        const ally = new Player(randomMechClass(rng), {
            isBot: true,
            faction: 'player',
            role: 'ally',
            owner: this.player,
        });
        this.placeMechNear(ally, this.player, rng);
        this.allies.push(ally);
        Logger.event('bot', 'companion_spawn', ally.type, { class: ally.type });
        return ally;
    },
    spawnRivalGroup: function(rng=Math.random) {
        if(this.rivals.length > 0) return [];
        const count = randomRivalGroupSize(rng);
        const spawned = [];
        for(let i=0; i<count; i++) {
            const rival = new Player(randomMechClass(rng), {
                isBot: true,
                faction: 'rival',
                role: 'rival',
            });
            this.placeMechInField(rival, rng);
            spawned.push(rival);
        }
        this.rivals.push(...spawned);
        Logger.event('bot', 'rival_group_spawn', `${count} rivals`, {
            count,
            classes: spawned.map(mech => mech.type),
        });
        return spawned;
    },
    selectClass: function(type) { this.selectedClass = type; Logger.event('player', 'select_class', type, { class: type }); DOM.hide('class-select-screen'); this.restart(); },
    togglePause: function() { if(!this.active)return; this.paused=!this.paused; const p=document.getElementById('pause-screen'); if(this.paused){ AudioSys.stopMusic(); if(p)p.classList.remove('hidden'); this.lastTime = 0; Logger.event('system', 'pause', 'paused'); }else{ AudioSys.startMusic(this.boss?'boss':'game'); if(p)p.classList.add('hidden'); Logger.event('system', 'unpause', 'resumed'); } },
    offerUpgrade: function() {
        if(!this.player || this.pendingUpgradeCount <= 0 || this.upgradeChoices.length > 0) return;
        this.upgradeChoices = rollUpgradeChoices(this.player);
        if(this.upgradeChoices.length === 0) {
            this.pendingUpgradeCount = 0;
            DOM.hideUpgradeChoices();
            return;
        }
        DOM.showUpgradeChoices(this.upgradeChoices);
    },
    selectUpgrade: function(index) {
        const choice = this.upgradeChoices[index];
        if(!choice || !this.player) return false;
        applyUpgrade(this.player, choice.id);
        if(choice.id === 'companionProtocol') this.spawnCompanion();
        this.pendingUpgradeCount = Math.max(0, this.pendingUpgradeCount - 1);
        this.upgradeChoices = [];
        DOM.hideUpgradeChoices();
        Logger.event('progression', 'upgrade_selected', choice.id, {
            level: this.player.level,
            rarity: choice.rarity,
            pending: this.pendingUpgradeCount,
        });
        this.offerUpgrade();
        return true;
    },
    grantKillProgress: function(reward) {
        this.score += reward;
        const levelsGained = addXp(this.player, reward);
        if(levelsGained <= 0) return;

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
        const reward = killReward(victim.maxHp);
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
    restart: function() {
        AudioSys.stopMusic(); DOM.hideAll(); DOM.show('ui-layer'); DOM.hide('boss-hp-box');
        this.active=true; this.paused=false; this.score=0; this.rivalKills=0; this.wave=1; this.waveT=0; this.boss=false; this.biome=this.randBiome();
        this.combo=0; this.comboT=0; this.playerDead=false; this.deathTimer=0; this.deathReason=null; this.debris=[];
        this.lastTime = 0; this.accumulator = 0; Cam.x = 0; Cam.y = 0; Cam.lastX = 0; Cam.lastY = 0; Cam.rot = 0; Cam.trauma = 0;
        this.player = new Player(this.selectedClass);
        this.allies = [];
        this.rivals = [];
        this.rivalRespawnTimer = 0;
        this.companionRespawnTimer = 0;

        this.enemies=[]; this.bullets=[]; this.parts=[]; this.decals=[]; this.pows=[]; this.floaters=[]; this.weather=[]; this.waves=[];
        this.friendlies=[]; this.timeScale = 1.0; this.warpTimer = 0; this.critSlowMo = 0; this.bossDeathAnim = 0; this.calmWavePeriod = false; this.bossDeathExplosions = [];
        this.upgradeChoices = []; this.pendingUpgradeCount = 0; DOM.hideUpgradeChoices();

        for(let i=0;i<50;i++) this.weather.push(new WeatherParticle(this.biome));
        this.genMap();
        this.spawnRivalGroup();
        AudioSys.startMusic('game');
        RunStats.reset({ class: this.selectedClass, biome: this.biome });
        Logger.event('system', 'restart', 'run start', {
            class: this.selectedClass,
            biome: this.biome,
            rivalClasses: this.rivals.map(mech => mech.type),
        });
        requestAnimationFrame((t) => Game.loop(t));
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
    switchBiome: function() {
        const prev=this.biome;
        this.biome=this.randBiome(this.biome);
        this.genMap();
        this.player.x=1500; this.player.y=1500; this.player.saveState();
        for(const ally of this.allies) this.placeMechNear(ally, this.player);
        for(const rival of this.rivals) this.placeMechInField(rival);
        this.enemies=[]; this.bullets=[]; this.friendlies=[];
        RunStats.setMeta({ biome: this.biome });
        Logger.event('wave', 'biome_switch', this.biome, { from: prev, to: this.biome });
    },
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
    damageTarget: function(target, baseDamage, source) {
        if(!target || typeof target.takeDamage !== 'function') return null;
        const resolved = resolveOutgoingDamage(source, target, baseDamage);
        if(resolved.isCrit) {
            this.critSlowMo = 8;
            AudioSys.critHit();
            Logger.debug('combat', 'crit', 'critical hit', { finalDmg: resolved.amount, critSlowMo: this.critSlowMo, timeScale: this.timeScale });
        }
        const applied = target.takeDamage(resolved.amount, source);
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

        if(e.hp <= 0 && ['mantis','fortress','eye'].includes(e.t)) {
            const killer = progressionOwner(source);
            if(killer?.faction === 'rival') {
                // Count boss kill before gameOver snapshot (death loop would be too late)
                RunStats.kill(e.t, false, true);
                Logger.event('combat', 'boss_kill', e.t, {
                    type: e.t, score: 0, boss: true, byPlayer: false, wave: this.wave,
                });
                e._runStatsCounted = true;
                this.gameOver("RIVAL ELIMINATED TARGET");
            }
        }
        return result;
    },
    spawnLoot: function(x,y) {
        // Updated Loot Table with Modules
        const lootTable = [
            'repair','repair','repair',
            'shotgun','shotgun',
            'mg','mg',
            'rpg',
            'laser',
            'shield','shield',
            'quad','freeze',
            'turret','warp','emp','grav','overclock' // Modules
        ];
        const t = lootTable[Math.floor(Math.random()*lootTable.length)];
        this.pows.push({x:x,y:y,t:t,l:800});
    },
    addCombo: function() { this.combo++; this.comboT = 60; },

    _fmtKillBag: function(bag) {
        const keys = Object.keys(bag).sort((a, b) => (bag[b] | 0) - (bag[a] | 0) || a.localeCompare(b));
        if (!keys.length) return '—';
        return keys.map((k) => `${k.toUpperCase()} ×${bag[k]}`).join('  ');
    },

    renderRunSummary: function(snap, hsResult) {
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
        set('final-score', snap.score);
        set('death-reason', snap.reason || 'SYSTEM COLLAPSE');
        set('go-wave', 'WAVE ' + snap.wave);
        set('go-class', (snap.class || '?').toUpperCase());
        set('go-biome', (snap.biome || '?').toUpperCase());
        set('go-rival', String(snap.rivalKills | 0));
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
                    return `<div${mark}><span class="hs-rank">#${i + 1}</span> <span class="text-highlight">${e.score|0}</span> · ${(e.class||'?').toUpperCase()} · W${e.wave|0} · P${e.playerTotal|0}/B${e.botTotal|0} · R${e.rivalKills|0}</div>`;
                }).join('')
                : '<div class="hs-row hs-empty">NO RECORDS</div>';
        }
    },

    gameOver: function(reason) {
        const why = reason || this.deathReason || 'SYSTEM COLLAPSE';
        this.active=false; AudioSys.stopMusic(); DOM.hideAll(); DOM.show('game-over-screen');
        RunStats.setMeta({
            class: this.selectedClass,
            biome: this.biome,
            wave: this.wave,
            score: this.score,
            rivalKills: this.rivalKills,
        });
        const snap = RunStats.snapshot(why);
        const hsResult = HighScores.submit(snap);
        this.renderRunSummary(snap, hsResult);
        Logger.event('player', 'game_over', why, snap);
        Logger.flush();
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

        // Warp module time scale restoration
        if(this.warpTimer > 0) {
            this.warpTimer--;
            if(this.warpTimer <= 0) this.timeScale = 1.0;
        }

        if(!this.player) return;
        this.player.saveState();
        for(let i=0; i<this.allies.length; i++) this.allies[i].saveState();
        for(let i=0; i<this.rivals.length; i++) this.rivals[i].saveState();
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
        if (!this.playerDead) {
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

        if(this.playerDead) {
            this.deathTimer--;
            for(let i=0; i<this.debris.length; i++) this.debris[i].update();
            for(let i=this.parts.length-1;i>=0;i--) { let p=this.parts[i]; p.update(); if(p.l<=0)this.parts.splice(i,1); }
            for(let i=0; i<this.waves.length; i++) this.waves[i].update();
            for(let i=0; i<this.weather.length; i++) this.weather[i].update();
            if(this.deathTimer <= 0) this.gameOver(this.deathReason || 'SYSTEM COLLAPSE');
            return;
        }

        Input.mouse.wx=Input.mouse.x+Cam.x; Input.mouse.wy=Input.mouse.y+Cam.y;
        if(this.combo > 0) { this.comboT--; if(this.comboT <= 0) this.combo = 0; }

        if(!this.boss) {
            this.waveT++; if(this.waveT>1200){
                this.wave++; this.waveT=0;
                Logger.event('wave', 'wave_advance', 'WAVE ' + this.wave, { wave: this.wave });
                // Reset calm period after waves 13, 23, etc (calm waves: bossWave to bossWave+2)
                const bossWave = Math.floor((this.wave-1)/10)*10 + 10;
                if(this.wave > bossWave + 2) {
                    this.calmWavePeriod = false;
                }
                if(this.wave%10===0){
                    this.boss=true; DOM.show('boss-hp-box');
                    const bName = this.biome==='forest'?'mantis':(this.biome==='ruins'?'fortress':'eye');
                    document.getElementById('boss-name').innerText = "TARGET: " + bName.toUpperCase();
                    AudioSys.startMusic('boss'); this.enemies.push(new Enemy(bName));
                    Logger.event('wave', 'boss_spawn', bName, { boss: bName, biome: this.biome, wave: this.wave });
                }
            }
            // Calm period after boss kill - waves 10-11-12, 20-21-22, etc (reduced spawn rate, enemy limit: 30)
            const bossWave = Math.floor((this.wave-1)/10)*10 + 10;
            const isCalmPeriod = this.calmWavePeriod && this.wave >= bossWave && this.wave <= bossWave + 2;
            const spawnRate = isCalmPeriod ? Math.max(40, 120-this.wave*2) : Math.max(20,60-this.wave*2);

            if(this.frame%spawnRate===0&&this.enemies.length<(isCalmPeriod ? 30 : 50)){
                const pool = ['zombie'];
                if(this.wave > 1) pool.push('gunner', 'gunner');
                if(this.wave > 2 && !isCalmPeriod) pool.push('stalker');
                if(this.wave > 3 && !isCalmPeriod) pool.push('shotman');
                if(this.wave > 4 && !isCalmPeriod) pool.push('commando');
                if(this.wave > 5 && !isCalmPeriod) pool.push('tank', 'tank', 'tank');
                if(this.wave >= 6 && !isCalmPeriod) pool.push('sniper');
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
            } else {
                // Boss killed - switch biome only if player killed boss (condition: calmWavePeriod active)
                this.boss=false; DOM.hide('boss-hp-box'); AudioSys.startMusic('game');
                Logger.event('wave', 'boss_cleared', 'boss entity gone', { calm: !!this.calmWavePeriod, biome: this.biome });
                if(this.calmWavePeriod) {
                    this.switchBiome();
                    this.calmWavePeriod = false;
                }
            }
        }

        if(this.freeze>0)this.freeze--;
        this.player.update();

        for(let i=this.allies.length-1; i>=0; i--) {
            const ally = this.allies[i];
            if(ally.hp > 0) ally.update();
            if(ally.hp <= 0) {
                this.grantKillProgressForVictim(ally);
                Game.explode(ally.x+16, ally.y+16, 60, true, false, false, false, ally);
                Logger.event('bot', 'companion_death', ally.type, {
                    class: ally.type,
                    level: ally.level,
                });
                this.allies.splice(i, 1);
                this.companionRespawnTimer = BALANCE.BOTS.companionRespawnDelay;
            }
        }
        for(let i=this.rivals.length-1; i>=0; i--) {
            const rival = this.rivals[i];
            if(rival.hp > 0) rival.update();
            if(rival.hp <= 0) {
                const progress = this.grantKillProgressForVictim(rival);
                Game.explode(rival.x+16, rival.y+16, 60, false, false, false, true, rival);
                if(progress.killer === this.player) {
                    this.rivalKills++;
                    RunStats.rival();
                    Logger.event('combat', 'rival_kill', rival.type, {
                        class: rival.type,
                        rivalKills: this.rivalKills,
                        reward: progress.reward,
                    });
                } else {
                    Logger.event('bot', 'rival_death', rival.type, {
                        class: rival.type,
                        level: rival.level,
                    });
                }
                this.rivals.splice(i, 1);
                if(this.rivals.length === 0) this.rivalRespawnTimer = BALANCE.BOTS.respawnDelay;
            }
        }
        if(this.rivals.length === 0 && this.rivalRespawnTimer > 0) {
            this.rivalRespawnTimer--;
            if(this.rivalRespawnTimer === 0) this.spawnRivalGroup();
        }
        if(this.player.companionCapacity > 0 && this.allies.length === 0 && this.companionRespawnTimer > 0) {
            this.companionRespawnTimer--;
            if(this.companionRespawnTimer === 0) this.spawnCompanion();
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

                if(target.t) this.dmg(target, b.dmg, b.source);
                else this.damageTarget(target, b.dmg, b.source);

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
            if(!this.player.flying && !this.player.dashActive && this.player.rectIntersect(lr)) { this.applyPowerup(this.player, p); this.pows.splice(i,1); continue; }
            const aiMechs = [...this.allies, ...this.rivals];
            for(let j=0; j<aiMechs.length; j++) {
                const mech = aiMechs[j];
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
                const reward = killedByPlayer ? progress.reward : 0;

                if (!e._runStatsCounted) {
                    RunStats.kill(e.t, killedByPlayer, isBoss);
                    Logger.event('combat', isBoss ? 'boss_kill' : 'enemy_killed', e.t, {
                        type: e.t, score: reward, boss: isBoss, byPlayer: killedByPlayer, wave: this.wave,
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
                    // Activate calm period after boss kill
                    this.calmWavePeriod = true;
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
                        this.damageTarget(mech, e.contact ?? BALANCE.DAMAGE.contact, e);
                    }
                }
                // Turret collision
                for(let i=0; i<Game.friendlies.length; i++) {
                    let f = Game.friendlies[i];
                    if(f instanceof Turret && f.rectIntersect(e)) {
                        this.damageTarget(f, e.contact ?? BALANCE.DAMAGE.contact, e);
                        e.hitT = 10;
                    }
                }
            }
        }
        if(this.player.hp<=0 && !this.playerDead) {
            this.playerDead = true; this.deathTimer = 150;
            if (!this.deathReason) this.deathReason = 'SYSTEM COLLAPSE';
            Logger.event('player', 'player_death', 'player down', { wave: this.wave, score: this.score, class: this.player.type });
            Game.explode(this.player.x+16, this.player.y+16, 120, true, false, false, false, this.player);
            this.shake = 30; Cam.trauma = 1.0;
            for(let k=0; k<10; k++) this.debris.push(new Debris(this.player.x+16, this.player.y+16, '#00eaff'));
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
            while (this.accumulator >= this.step) { this.updateLogic(); this.accumulator -= this.step; steps++; }
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
                    allies: this.allies.length,
                    rivals: this.rivals.length,
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
        if(!entity.isBot) AudioSys.power();
        if(p.t==='repair') entity.hp=Math.min(entity.maxHp, entity.hp+BALANCE.PICKUPS.repair);
        else if(p.t==='quad') entity.quad=BALANCE.QUAD.duration;
        else if(p.t==='freeze') this.freeze=BALANCE.FREEZE_DURATION;
        else if(p.t==='shield') { entity.shield=Math.min(entity.maxShield, entity.shield+BALANCE.PICKUPS.shield); }
        else if(['turret','warp','emp','grav','overclock'].includes(p.t)) {
            // Apply module logic
            entity.module = p.t; entity.moduleCd = 0;
            if(!entity.isBot) {
                const mu = document.getElementById('module-box');
                mu.classList.remove('hidden');
                document.getElementById('mod-name').innerText = this.getModuleName(p.t);
                document.getElementById('mod-cd').innerText = "READY";
                document.getElementById('mod-cd').style.color = "#0ff";
            }
        }
        else { if(entity.wep===p.t) entity.levels[p.t]++; else { entity.wep=p.t; entity.levels[p.t]=1; } }
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
        for(let i=0; i<this.allies.length; i++) this.allies[i].draw(alpha);
        for(let i=0; i<this.rivals.length; i++) this.rivals[i].draw(alpha);
        if(!this.playerDead) this.player.draw(alpha);
        for(let i=0; i<this.bullets.length; i++) this.bullets[i].draw(alpha);
        const particlesStartedAt = performance.now();
        for(let i=this.parts.length-1;i>=0;i--) { let p=this.parts[i]; if(!this.playerDead) p.update(); p.draw(alpha); if(!this.playerDead && p.l<=0)this.parts.splice(i,1); }
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

        if(this.playerDead && this.deathTimer > 0) {
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
        document.getElementById('score').innerText = glitchText(this.score);
        DOM.updateProgression(this.player.level, this.player.xp, xpForNextLevel(this.player.level));
        document.getElementById('rival-kills').innerText = this.rivalKills;
        document.getElementById('wave').innerText=this.boss?"DANGER":"WAVE "+this.wave;
        document.getElementById('mech-hp').style.width=((this.player.hp/this.player.maxHp)*100)+"%";
        const wLvl=this.player.levels[this.player.wep];
        document.getElementById('weapon').innerHTML=this.player.wep.toUpperCase()+` <span style="color:#888;font-size:12px">LVL ${wLvl}</span>`;
        if(this.player.quad > 0) DOM.show('quad-indicator'); else DOM.hide('quad-indicator'); if(this.freeze > 0) DOM.show('freeze-indicator'); else DOM.hide('freeze-indicator');
        const sb = document.getElementById('shield-val'); if(sb) { sb.style.display = this.player.shield>0 ? 'flex' : 'none'; sb.innerText=this.player.shield; }
        const jb = document.getElementById('mech-jet'); if(jb) { if(this.player.type === 'heavy') { jb.style.background = HUD_COLORS.red; let pct = (this.player.fuel / this.player.maxFuel) * 100; jb.style.width = pct + "%"; } else { jb.style.background = !this.player.canFly ? HUD_COLORS.red : HUD_COLORS.orange; jb.style.width = (this.player.fuel / this.player.maxFuel * 100) + "%"; } }
        if(this.player.hp < this.player.maxHp * 0.2) { document.getElementById('ui-layer').classList.add('critical-ui'); } else { document.getElementById('ui-layer').classList.remove('critical-ui'); }

        // UI UPDATE MODULE
        if(this.player.module) {
            const cdElem = document.getElementById('mod-cd');
            if(this.player.moduleCd > 0) {
                 cdElem.innerText = Math.ceil(this.player.moduleCd / 60);
                 cdElem.style.color = HUD_COLORS.warning;
            } else {
                 cdElem.innerText = "READY";
                 cdElem.style.color = HUD_COLORS.cyan;
            }
        }
        this.perfPhases.domMs = performance.now() - domStartedAt;
    }
};
