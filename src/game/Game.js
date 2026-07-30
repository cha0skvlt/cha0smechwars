import { BALANCE } from '../config/balance.js';
import { DOM } from '../core/dom.js';
import { lerp } from '../core/lerp.js';
import { Grid } from '../core/grid.js';
import { Canvas, Ctx, Cam, Input, W, H, resize } from '../core/runtime.js';
import { AudioSys } from '../audio/audio.js';
import { Cache, ShadowCv, bakeSprites } from '../render/bake.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Obstacle } from '../entities/Obstacle.js';
import { Turret } from '../entities/Turret.js';
import { GravityWell } from '../entities/GravityWell.js';
import { Particle, Debris, WeatherParticle, Shockwave, Floater, Decal } from '../entities/effects.js';

// @meta:Game - Main game state and loop controller - manages all entities, rendering, and game logic
export const Game = {
    active: false, paused: false, frame: 0, score: 0, rivalKills: 0, shake: 0, wave: 1, waveT: 0, boss: false, freeze: 0, biome: 'forest',
    player: null, bot: null, enemies: [], bullets: [], obs: [], parts: [], decals: [], pows: [], floaters: [], weather: [], waves: [], difficulty: 1.0,
    combo: 0, comboT: 0, bgCv: null, bgCtx: null, selectedClass: 'battle', botRespawnTimer: 0,
    playerDead: false, deathTimer: 0, debris: [],
    lastTime: 0, accumulator: 0, step: 1/60,

    friendlies: [],
    timeScale: 1.0,
    warpTimer: 0,
    critSlowMo: 0,
    critFlash: 0,
    bossDeathExplosions: [],

    initSystem: function() { AudioSys.init(); AudioSys.resume(); bakeSprites(); this.bgCv = document.createElement('canvas'); this.bgCv.width = 3000; this.bgCv.height = 3000; this.bgCtx = this.bgCv.getContext('2d'); this.floaters = []; },
    showClassSelect: function() { DOM.hide('start-screen'); DOM.show('class-select-screen'); },
    selectClass: function(type) { this.selectedClass = type; DOM.hide('class-select-screen'); this.restart(); },
    togglePause: function() { if(!this.active)return; this.paused=!this.paused; const p=document.getElementById('pause-screen'); if(this.paused){ AudioSys.stopMusic(); if(p)p.classList.remove('hidden'); this.lastTime = 0; }else{ AudioSys.startMusic(this.boss?'boss':'game'); if(p)p.classList.add('hidden'); } },
    restart: function() {
        AudioSys.stopMusic(); DOM.hideAll(); DOM.show('ui-layer'); DOM.hide('boss-hp-box');
        this.active=true; this.paused=false; this.score=0; this.rivalKills=0; this.wave=1; this.waveT=0; this.boss=false; this.biome=this.randBiome();
        this.combo=0; this.comboT=0; this.playerDead=false; this.deathTimer=0; this.debris=[];
        this.lastTime = 0; this.accumulator = 0; Cam.x = 0; Cam.y = 0; Cam.lastX = 0; Cam.lastY = 0; Cam.rot = 0; Cam.trauma = 0;
        this.player = new Player(this.selectedClass);
        this.bot = new Player(['battle','heavy','scout'][Math.floor(Math.random()*3)], true);

        this.enemies=[]; this.bullets=[]; this.parts=[]; this.decals=[]; this.pows=[]; this.floaters=[]; this.weather=[]; this.waves=[];
        this.friendlies=[]; this.timeScale = 1.0; this.warpTimer = 0; this.critSlowMo = 0; this.bossDeathAnim = 0; this.calmWavePeriod = false; this.bossDeathExplosions = [];

        for(let i=0;i<50;i++) this.weather.push(new WeatherParticle(this.biome));
        this.genMap(); AudioSys.startMusic('game');
        requestAnimationFrame((t) => Game.loop(t));
    },
    getDifficultyMultiplier: function() { return 1 + (Math.floor(this.wave / 10) * 0.1); },
    randBiome: function(exclude) { const b = ['forest','ruins','dungeon']; let res = b[Math.floor(Math.random()*3)]; if(exclude) { while(res === exclude) res = b[Math.floor(Math.random()*3)]; } return res; },
    genMap: function() {
        this.obs=[]; Grid.clear(); this.bgCtx.fillStyle = this.biome==='dungeon'?'#1a0505':(this.biome==='ruins'?'#101520':'#051005'); this.bgCtx.fillRect(0,0,3000,3000);
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
    switchBiome: function() { this.biome=this.randBiome(this.biome); this.genMap(); this.player.x=1500; this.player.y=1500; this.player.saveState(); this.enemies=[]; this.bullets=[]; this.friendlies=[]; },
    checkWall: function(r) {
        if(r.x<0||r.x+r.w>3000||r.y<0||r.y+r.h>3000)return true;
        const nearby = Grid.get(r);
        // Optimized collision check - replaced for...of with for loop
        for(let i=0, len=nearby.length; i<len; i++) {
            if(nearby[i].rectIntersect(r)) return true;
        }
        return false;
    },

    explode: function(x,y,rad,friend,pushOnly=false, noScorch=false, isBotSource=false, sourceEntity=null, rpgBullet=null) {
        const isBigExplosion = rad > 90;
        const radSq = rad*rad; // Cache squared radius for all checks
        const isRPG = rpgBullet !== null && rpgBullet.wep === 'rpg';

        // Visual and audio effects
        if(!pushOnly) {
            AudioSys.boom(x); this.waves.push(new Shockwave(x,y,rad));
            let shakeAmt = 5;
            if((!friend && !isBotSource) || isBigExplosion) {
                shakeAmt = 15;
                Cam.trauma = Math.min(1.0, Cam.trauma + 0.5);
            }
            if(isBotSource && !isBigExplosion) shakeAmt = 8;
            this.shake = Math.max(this.shake, shakeAmt);
            for(let i=0;i<20;i++)this.parts.push(new Particle(x,y,'#fa0'));
            if(!noScorch) { this.bgCtx.save(); this.bgCtx.globalCompositeOperation='multiply'; new Decal(x,y,'rgba(0,0,0,0.5)').draw(this.bgCtx); this.bgCtx.restore(); }
        }

        // RPG splash damage zones (close: 5+lvl, medium: 3+lvl, far: 1+lvl)
        const getRPGDamage = (distSq) => {
            if(!isRPG) return pushOnly ? 2 : 10; // Default explosion damage
            const dist = Math.sqrt(distSq);
            const closeRadius = 30; // Close range
            const mediumRadius = 50; // Medium range
            const farRadius = rad; // Max splash radius (80)
            const lvl = rpgBullet.lvl;
            if(dist <= closeRadius) return 5 + lvl;
            if(dist <= mediumRadius) return 3 + lvl;
            if(dist <= farRadius) return 1 + lvl;
            return 0;
        };

        // Damage calculation - refactored to reduce duplication
        const damageEnemy = (e, dmgSource) => {
            const dx = e.x-x, dy = e.y-y;
            const distSq = dx*dx + dy*dy;
            if(distSq < radSq) {
                const dmg = isRPG ? getRPGDamage(distSq) : (pushOnly ? 2 : 10);
                if(dmg > 0) this.dmg(e, dmg, dmgSource);
            }
        };

        const damageEntity = (ent, dmg, dmgSource) => {
            if(!ent) return;
            const dx = ent.x-x, dy = ent.y-y;
            const distSq = dx*dx + dy*dy;
            if(distSq < radSq && ent !== sourceEntity) {
                const finalDmg = isRPG ? getRPGDamage(distSq) : dmg;
                if(finalDmg > 0) ent.takeDamage(finalDmg, dmgSource);
            }
        };

        if(friend) {
            // Friendly explosion - damages enemies, bot, turrets
            for(let i=0, len=this.enemies.length; i<len; i++) damageEnemy(this.enemies[i], sourceEntity || this.player);
            damageEntity(this.bot, pushOnly?1:5, sourceEntity);
            // Turrets damage
            for(let i=0, len=this.friendlies.length; i<len; i++) {
                let f = this.friendlies[i];
                if(f instanceof Turret) {
                    const dx = f.x-x, dy = f.y-y;
                    if(dx*dx + dy*dy < radSq) f.hp -= 5;
                }
            }
        } else if(isBotSource) {
            // Bot explosion - damages enemies and player
            for(let i=0, len=this.enemies.length; i<len; i++) damageEnemy(this.enemies[i], this.bot);
            damageEntity(this.player, pushOnly?1:5, sourceEntity);
        } else {
            // Enemy explosion - damages player, bot, turrets
            damageEntity(this.player, pushOnly?0:1, null);
            damageEntity(this.bot, 1, null);
            // Turrets damage
            for(let i=0, len=this.friendlies.length; i<len; i++) {
                let f = this.friendlies[i];
                if(f instanceof Turret) {
                    const dx = f.x-x, dy = f.y-y;
                    if(dx*dx + dy*dy < radSq) f.hp -= 5;
                }
            }
        }
    },
    dmg: function(e,d, source) {
        if(!this.player) return;
        const isCrit = this.player.quad > 0 || Math.random() < 0.1;
        const finalDmg = d * (this.player.quad > 0 ? 4 : 1) * (isCrit ? 2 : 1);

        // Critical hit effects activation (slow-mo + sound, duration: 8 frames)
        if(isCrit && (!source || (source && !source.isBot))) {
            this.critSlowMo = 8;
            AudioSys.critHit();
        }

        e.hp -= finalDmg; e.hitT = 5;
        if(source) e.lastAttacker = source;
        this.floaters.push(new Floater(e.x + e.w/2, e.y, finalDmg, isCrit));
        let c = e.blood==='oil' ? '#333' : e.blood;
        for(let i=0;i<3;i++)this.parts.push(new Particle(e.x+e.w/2,e.y+e.h/2, c));

        if(e.hp <= 0 && ['mantis','fortress','eye'].includes(e.t)) {
            if(source && source.isBot) {
                this.gameOver("RIVAL ELIMINATED TARGET");
            }
        }
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
    gameOver: function(reason) {
        this.active=false; AudioSys.stopMusic(); DOM.hideAll(); DOM.show('game-over-screen');
        document.getElementById('final-score').innerText=this.score;
        if(reason) document.getElementById('death-reason').innerText = reason;
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
        if(this.bot) this.bot.saveState();
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
            if(this.deathTimer <= 0) this.gameOver();
            return;
        }

        Input.mouse.wx=Input.mouse.x+Cam.x; Input.mouse.wy=Input.mouse.y+Cam.y;
        if(this.combo > 0) { this.comboT--; if(this.comboT <= 0) this.combo = 0; }

        if(!this.boss) {
            this.waveT++; if(this.waveT>1200){
                this.wave++; this.waveT=0;
                // Reset calm period after waves 13, 23, etc (calm waves: bossWave to bossWave+2)
                const bossWave = Math.floor((this.wave-1)/10)*10 + 10;
                if(this.wave > bossWave + 2) {
                    this.calmWavePeriod = false;
                }
                if(!this.bot) {
                    this.bot = new Player(['battle','heavy','scout'][Math.floor(Math.random()*3)], true);
                }
                if(this.wave%10===0){
                    this.boss=true; DOM.show('boss-hp-box');
                    const bName = this.biome==='forest'?'mantis':(this.biome==='ruins'?'fortress':'eye');
                    document.getElementById('boss-name').innerText = "TARGET: " + bName.toUpperCase();
                    AudioSys.startMusic('boss'); this.enemies.push(new Enemy(bName));
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
                if(this.wave > 3 && !isCalmPeriod) pool.push('rocketman');
                if(this.wave > 4 && !isCalmPeriod) pool.push('commando');
                if(this.wave > 5 && !isCalmPeriod) pool.push('tank', 'tank', 'tank');
                if(this.wave >= 6 && !isCalmPeriod) pool.push('sniper');
                if(pool.length > 0) {
                    const t = pool[Math.floor(Math.random() * pool.length)];
                    try { this.enemies.push(new Enemy(t)); } catch(e) { console.error('Enemy spawn error:', e); }
                }
            }
        } else {
            const bossEnt = this.enemies.find(e=>['mantis','fortress','eye'].includes(e.t));
            if(bossEnt) {
                const max = (this.biome==='fortress'?400:(this.biome==='dungeon'?180:200)) * this.getDifficultyMultiplier();
                document.getElementById('boss-hp-bar').style.width = (bossEnt.hp / max * 100) + "%";
            } else {
                // Boss killed - switch biome only if player killed boss (condition: calmWavePeriod active)
                this.boss=false; DOM.hide('boss-hp-box'); AudioSys.startMusic('game');
                if(this.calmWavePeriod) {
                    this.switchBiome();
                    this.calmWavePeriod = false;
                }
            }
        }

        if(this.freeze>0)this.freeze--;
        this.player.update();

        if(this.bot) {
            this.bot.update();
            if(this.bot.hp <= 0) {
                 Game.explode(this.bot.x+16, this.bot.y+16, 60, true);
                 if(this.bot.lastAttacker === this.player) {
                     this.rivalKills++;
                 }
                 this.bot = null;
            }
        }

        // Optimized entity updates - replaced forEach with for loop
        for(let i=0; i<this.enemies.length; i++) this.enemies[i].update();
        for(let i=0, len=this.bullets.length; i<len; i++) this.bullets[i].update();
        for(let i=this.friendlies.length-1;i>=0;i--) {
            let f=this.friendlies[i];
            f.update();
            if((f instanceof Turret && f.hp<=0) || (f instanceof GravityWell && f.life<=0)) {
                Game.explode(f.x+8, f.y+8, 20, true, true);
                this.friendlies.splice(i,1);
            }
        }

        for(let i=this.bullets.length-1;i>=0;i--) {
            let b=this.bullets[i]; if(b.dead){this.bullets.splice(i,1);continue;}
            if(b.bot) {
                 if(this.player.rectIntersect(b)) {
                     if(b.wep==='laser') {
                         // @meta-ref:balance.json:weapons.laser - Laser damage: 5+level, penetrates player
                         let hitKey = this.player.x + ',' + this.player.y + ',' + Game.frame;
                         if(!b.laserHits.includes(hitKey)) {
                             b.laserHits.push(hitKey);
                             this.player.takeDamage(b.dmg, this.bot);
                         }
                     } else {
                         this.player.takeDamage(b.dmg, this.bot);
                         b.dead=true;
                     }
                 }
                 else {
                     // Optimized enemy collision check - replaced for...of with for loop
                     for(let j=0, len=this.enemies.length; j<len; j++) {
                         let e = this.enemies[j];
                         if(e.rectIntersect(b)) {
                             if(b.wep==='rpg') {
                                 // @meta-ref:balance.json:weapons.rpg - RPG: 10+level direct damage + splash (5+level close, 3+level medium, 1+level far)
                                 this.dmg(e, b.dmg, this.bot); // Direct hit: 10+level
                                 // Level 3+ RPG: 1.5x splash radius
                                 const splashRadius = b.lvl >= 3 ? 120 : 80;
                                 Game.explode(b.x+b.w/2, b.y+b.h/2, splashRadius, false, false, false, true, this.bot, b);
                                 b.dead=true;
                             }
                             else if(b.wep==='laser') {
                                 // @meta-ref:balance.json:weapons.laser - Laser: 5+level damage, penetrates all enemies
                                 let hitKey = e.x + ',' + e.y + ',' + Game.frame;
                                 if(!b.laserHits.includes(hitKey)) {
                                     b.laserHits.push(hitKey);
                                     this.dmg(e, b.dmg, this.bot);
                                 }
                             }
                             else {
                                 this.dmg(e, b.dmg, this.bot); // Use bullet damage (scales with level)
                                 // Level 3+ Shotgun: explosive rounds
                                 if(b.wep==='shotgun' && b.lvl >= 3) {
                                     const explosionX = b.x + b.w/2;
                                     const explosionY = b.y + b.h/2;
                                     const splashRadius = 30;
                                     Game.explode(explosionX, explosionY, splashRadius, false, false, false, true, this.bot, b);
                                 }
                                 b.dead=true;
                                 break;
                             }
                             if(b.wep!=='laser') break;
                         }
                     }
                 }
            } else if(b.enemy) {
                 if(this.player.rectIntersect(b)) {
                     if(b.wep==='rpg') {
                         // @meta-ref:balance.json:weapons.rpg - RPG: 10+level direct damage + splash (5+level close, 3+level medium, 1+level far)
                         this.player.takeDamage(b.dmg, null); // Direct hit: 10+level
                         // Level 3+ RPG: 1.5x splash radius
                         const splashRadius = b.lvl >= 3 ? 120 : 80;
                         Game.explode(b.x+b.w/2, b.y+b.h/2, splashRadius, false, false, false, false, null, b);
                         b.dead=true;
                     } else if(b.wep==='laser') {
                         // @meta-ref:balance.json:weapons.laser - Laser damage: 5+level to player
                         this.player.takeDamage(b.dmg, null);
                     } else {
                         this.player.takeDamage(b.dmg, null);
                     }
                     if(b.wep!=='laser') b.dead=true;
                 }
                 else if(this.bot && this.bot.rectIntersect(b)) {
                     if(b.wep==='rpg') {
                         // @meta-ref:balance.json:weapons.rpg - RPG: 10+level direct damage + splash (5+level close, 3+level medium, 1+level far)
                         this.bot.takeDamage(b.dmg, null); // Direct hit: 10+level
                         // Level 3+ RPG: 1.5x splash radius
                         const splashRadius = b.lvl >= 3 ? 120 : 80;
                         Game.explode(b.x+b.w/2, b.y+b.h/2, splashRadius, false, false, false, false, null, b);
                         b.dead=true;
                     } else if(b.wep==='laser') {
                         // @meta-ref:balance.json:weapons.laser - Laser damage: 5+level to bot
                         this.bot.takeDamage(b.dmg, null);
                     } else {
                         this.bot.takeDamage(b.dmg, null);
                     }
                     if(b.wep!=='laser') b.dead=true;
                 }
                 else {
                     // Check turrets
                     for(let j=0; j<Game.friendlies.length; j++) {
                         let f = Game.friendlies[j];
                         if(f instanceof Turret && f.rectIntersect(b)) {
                             f.hp -= b.dmg; b.dead = true;
                         }
                     }
                 }
            } else {
                if(this.bot && this.bot.rectIntersect(b)) {
                        if(b.wep==='rpg') {
                        // @meta-ref:balance.json:weapons.rpg - RPG: 10+level direct damage + splash (5+level close, 3+level medium, 1+level far)
                        this.bot.takeDamage(b.dmg, this.player); // Direct hit: 10+level
                        // Level 3+ RPG: 1.5x splash radius
                        const splashRadius = b.lvl >= 3 ? 120 : 80;
                        Game.explode(b.x+b.w/2, b.y+b.h/2, splashRadius, true, false, false, false, this.player, b);
                        b.dead=true;
                    }
                    else if(b.wep==='laser') {
                        // @meta-ref:balance.json:weapons.laser - Laser damage: 5+level to bot (from player)
                        this.bot.takeDamage(b.dmg, this.player);
                    }
                    else { this.bot.takeDamage(b.dmg, this.player); if(b.wep!=='laser') b.dead=true; }
                }
                else {
                    // Optimized enemy collision check - replaced for...of with for loop
                    for(let j=0, len=this.enemies.length; j<len; j++) {
                        let e = this.enemies[j];
                        if(e.rectIntersect(b)) {
                            if(b.wep==='rpg') {
                                // @meta-ref:balance.json:weapons.rpg - RPG: 10+level direct damage + splash (5+level close, 3+level medium, 1+level far)
                                this.dmg(e, b.dmg, this.player); // Direct hit: 10+level
                                // Level 3+ RPG: 1.5x splash radius
                                const splashRadius = b.lvl >= 3 ? 120 : 80;
                                Game.explode(b.x+b.w/2, b.y+b.h/2, splashRadius, true, false, false, false, this.player, b);
                                b.dead=true;
                            }
                            else if(b.wep==='laser') {
                                // @meta-ref:balance.json:weapons.laser - Laser: 5+level damage, penetrates all enemies (hit tracking per frame)
                                let hitKey = e.x + ',' + e.y + ',' + Game.frame;
                                if(!b.laserHits.includes(hitKey)) {
                                    b.laserHits.push(hitKey);
                                    this.dmg(e, b.dmg, this.player);
                                }
                            }
                            else {
                                this.dmg(e, b.dmg, this.player); // Use bullet damage (scales with level)
                                // Level 3+ Shotgun: explosive rounds
                                if(b.wep==='shotgun' && b.lvl >= 3) {
                                    const explosionX = b.x + b.w/2;
                                    const explosionY = b.y + b.h/2;
                                    const splashRadius = 30;
                                    Game.explode(explosionX, explosionY, splashRadius, true, false, false, false, this.player, b);
                                }
                                b.dead=true;
                                break;
                            }
                            if(b.wep!=='laser') break;
                        }
                    }
                }
            }
        }

        for(let i=this.pows.length-1;i>=0;i--) {
            let p=this.pows[i]; p.l--; if(p.l<=0){this.pows.splice(i,1);continue;}
            let lr = {...p,w:24,h:24};
            if(!this.player.flying && !this.player.dashActive && this.player.rectIntersect(lr)) { this.applyPowerup(this.player, p); this.pows.splice(i,1); continue; }
            if(this.bot && !this.bot.flying && !this.bot.dashActive && this.bot.rectIntersect(lr)) { this.applyPowerup(this.bot, p); this.pows.splice(i,1); continue; }
        }

        for(let i=this.enemies.length-1;i>=0;i--) {
            let e=this.enemies[i];
            if(e.hp<=0) {
                e.dead = true;
                const isBoss = ['mantis','fortress','eye'].includes(e.t);
                const killedByPlayer = !e.lastAttacker || (e.lastAttacker && !e.lastAttacker.isBot);

                // Boss death: Epic animation and rewards (reward multiplier: 5x, condition: isBoss && killedByPlayer)
                if(isBoss && killedByPlayer) {
                    this.bossDeathAnim = 120;
                    const msgEl = document.getElementById('boss-death-msg');
                    if(msgEl) {
                        msgEl.style.display = 'block';
                        msgEl.style.animation = 'none';
                        setTimeout(() => { msgEl.style.animation = 'bossDeathAnim 2s forwards'; }, 10);
                        setTimeout(() => { msgEl.style.display = 'none'; }, 2000);
                    }
                    let bossReward = e.sc * 5;
                    this.score += bossReward;
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

                // Combo only counts player kills, not bot kills
                if(killedByPlayer) {
                    this.addCombo();
                }
                let waveMult = Math.pow(2, Math.floor((this.wave-1)/10));
                if(!isBoss || !killedByPlayer) {
                    this.score += e.sc * Math.max(1, this.combo) * waveMult;
                }
                this.bgCtx.save();
                if(e.blood === 'oil') {
                    let size = e.w; if(e.t==='gunner') size=20; if(e.t==='tank') size=60;
                    if(!isBoss || !killedByPlayer) {
                        Game.explode(e.x+e.w/2, e.y+e.h/2, size, true, true, true);
                    }
                    this.bgCtx.globalCompositeOperation='multiply';
                    new Decal(e.x+e.w/2, e.y+e.h/2, '#333').draw(this.bgCtx);
                } else {
                    this.bgCtx.globalCompositeOperation='source-over';
                    new Decal(e.x+e.w/2, e.y+e.h/2, e.blood).draw(this.bgCtx);
                    if(!isBoss || !killedByPlayer) {
                        for(let k=0;k<8;k++)this.parts.push(new Particle(e.x,e.y, e.blood));
                    }
                }
                this.bgCtx.restore();

                if(Math.random()<0.2)this.spawnLoot(e.x,e.y);
                this.enemies.splice(i,1);
            } else {
                if(!this.player.flying && this.player.rectIntersect(e)) this.player.takeDamage(1, null);
                if(this.bot && !this.bot.flying && this.bot.rectIntersect(e)) this.bot.takeDamage(1, null);
                // Turret collision
                for(let i=0; i<Game.friendlies.length; i++) {
                    let f = Game.friendlies[i];
                    if(f instanceof Turret && f.rectIntersect(e)) { f.hp--; e.hitT = 10; }
                }
            }
        }
        if(this.player.hp<=0 && !this.playerDead) {
            this.playerDead = true; this.deathTimer = 150;
            Game.explode(this.player.x+16, this.player.y+16, 120, false, false, false, false, null);
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
            while (this.accumulator >= this.step) { this.updateLogic(); this.accumulator -= this.step; }
            const alpha = this.accumulator / this.step;
            this.draw(alpha);
        } catch(err) { document.getElementById('error-screen').style.display='flex'; document.getElementById('error-msg').innerText = err.stack; this.active = false; }
    },

    applyPowerup: function(entity, p) {
        if(p.t==='mine') { Game.explode(p.x,p.y,250,true); entity.hp-=4; entity.inv=20; for(let k=0;k<10;k++)this.parts.push(new Particle(p.x,p.y,'#fff')); return; }
        if(!entity.isBot) AudioSys.power();
        if(p.t==='repair') entity.hp=Math.min(entity.maxHp, entity.hp+3);
        else if(p.t==='quad') entity.quad=240;
        else if(p.t==='freeze') this.freeze=240;
        else if(p.t==='shield') { let amt=(entity.type==='scout')?3:5; entity.shield=Math.min(entity.maxShield, entity.shield+amt); }
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
        let camX = lerp(Cam.lastX, Cam.x, alpha);
        let camY = lerp(Cam.lastY, Cam.y, alpha);
        const origCamX = Cam.x; const origCamY = Cam.y;
        Cam.x = camX; Cam.y = camY;

        Ctx.fillStyle='#000'; Ctx.fillRect(0,0,W,H);
        Ctx.save();
        Ctx.translate(W/2, H/2);
        Ctx.scale(Cam.zoom, Cam.zoom);
        Ctx.rotate(Cam.rot);
        Ctx.translate(-W/2, -H/2);
        Ctx.translate(-camX,-camY);

        Ctx.drawImage(this.bgCv, 0, 0);
        Ctx.strokeStyle='rgba(0,255,255,0.1)'; Ctx.lineWidth=1; Ctx.beginPath(); for(let i=0;i<=3000;i+=100){Ctx.moveTo(i,0);Ctx.lineTo(i,3000);} for(let i=0;i<=3000;i+=100){Ctx.moveTo(0,i);Ctx.lineTo(3000,i);} Ctx.stroke(); Ctx.strokeStyle='#f00'; Ctx.strokeRect(0,0,3000,3000);

        for(let i=0; i<this.decals.length; i++) this.decals[i].draw(Ctx);
        const camX2 = camX + W*2, camY2 = camY + H*2;
        for(let i=0; i<this.obs.length; i++) {
            let e = this.obs[i];
            if(e.x+e.w>camX-W&&e.x<camX2&&e.y+e.h>camY-H&&e.y<camY2) {
                Ctx.drawImage(ShadowCv, lerp(e.lastX, e.x, alpha), lerp(e.lastY, e.y, alpha)+e.h-8, e.w, 16);
            }
        }
        for(let i=0; i<this.enemies.length; i++) {
            let e = this.enemies[i];
            if(e.t!=='eye' && e.x+e.w>camX-W&&e.x<camX2&&e.y+e.h>camY-H&&e.y<camY2) {
                Ctx.drawImage(ShadowCv, lerp(e.lastX, e.x, alpha), lerp(e.lastY, e.y, alpha)+e.h-8, e.w, 16);
            }
        }
        for(let i=0; i<this.obs.length; i++) this.obs[i].draw(alpha);
        for(let i=0; i<this.friendlies.length; i++) this.friendlies[i].draw(alpha);
        // Optimized powerup rendering - replaced forEach with for loop
        const powBounce = Math.sin(this.frame*0.1)*5;
        for(let i=0, len=this.pows.length; i<len; i++) {
            let p = this.pows[i];
            if(p.x<camX-W||p.x>camX+W*2||p.y<camY-H||p.y>camY+H*2)continue;
            let c='#fff',char='';
            if(p.t==='shotgun'){char='S';c='#f90';} else if(p.t==='mg'){char='M';c='#bf0';} else if(p.t==='rpg'){char='R';c='#ff0';} else if(p.t==='laser'){char='L';c='#f0f'}
            else if(p.t==='repair'){char='A';c='#00eaff';} else if(p.t==='quad'){char='Q';c='#f0f';} else if(p.t==='freeze'){char='Z';c='#60f';} else if(p.t==='mine'){char='M';c='#f00';} else if(p.t==='shield'){char='O';c='#00eaff';}
            else { char='E'; c='#0ff'; } // Modules

            Ctx.save(); Ctx.shadowBlur=0; Ctx.globalCompositeOperation='lighter'; Ctx.fillStyle=c; Ctx.globalAlpha = 0.5; Ctx.fillRect(p.x-5, p.y+powBounce-5, 34, 34); Ctx.globalAlpha = 1.0; Ctx.fillRect(p.x,p.y+powBounce,24,24); Ctx.restore(); Ctx.fillStyle='#000'; Ctx.font='16px monospace'; Ctx.fillText(char,p.x+6,p.y+powBounce+18);
        }
        for(let i=0; i<this.enemies.length; i++) this.enemies[i].draw(alpha);
        if(this.bot) this.bot.draw(alpha);
        if(!this.playerDead) this.player.draw(alpha);
        for(let i=0; i<this.bullets.length; i++) this.bullets[i].draw(alpha);
        for(let i=this.parts.length-1;i>=0;i--) { let p=this.parts[i]; if(!this.playerDead) p.update(); p.draw(alpha); if(!this.playerDead && p.l<=0)this.parts.splice(i,1); }
        for(let i=0; i<this.debris.length; i++) this.debris[i].draw(alpha);
        for(let i=0; i<this.weather.length; i++) this.weather[i].draw(alpha);
        for(let i=0; i<this.waves.length; i++) this.waves[i].draw();
        for(let i=0; i<this.floaters.length; i++) this.floaters[i].draw(alpha);

        // Warp module screen distortion effect (wave distortion)
        if(this.warpTimer > 0 && this.timeScale < 1.0) {
            Ctx.save();
            Ctx.globalCompositeOperation = 'overlay';
            let wave = Math.sin(Game.frame * 0.3) * 2;
            for(let y = 0; y < H; y += 5) {
                let offset = Math.sin((y + Game.frame * 5) * 0.1) * wave;
                Ctx.fillStyle = `rgba(0, 255, 255, ${0.1 * (1 - this.timeScale)})`;
                Ctx.fillRect(0, y, W, 2);
            }
            Ctx.restore();
        }

        Ctx.resetTransform();
        Ctx.fillStyle = (this.biome === 'dungeon' || this.biome === 'ruins') ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)';
        Ctx.fillRect(0,0,W,H);

        if(this.playerDead && this.deathTimer > 0) {
            Ctx.save(); Ctx.globalCompositeOperation = 'multiply'; Ctx.fillStyle = `rgba(255, 0, 0, ${0.3 + Math.random()*0.2})`; Ctx.fillRect(0,0,W,H);
            if(Math.random()>0.5) { Ctx.globalCompositeOperation = 'source-over'; Ctx.fillStyle = `rgba(255,255,255,${Math.random()*0.1})`; Ctx.fillRect(0, Math.random()*H, W, 20); }
            Ctx.restore();
        }
        Ctx.restore();
        Cam.x = origCamX; Cam.y = origCamY;

        const bossEnt = this.enemies.find(e=>['mantis','fortress','eye'].includes(e.t));
        if(bossEnt) { const max = (this.biome==='fortress'?400:(this.biome==='dungeon'?180:200)) * this.getDifficultyMultiplier(); const pct = Math.max(0, bossEnt.hp / max); const bw = 600; const bh = 20; const bx = W/2 - bw/2; const by = 100; Ctx.fillStyle = 'rgba(0,0,0,0.8)'; Ctx.fillRect(bx, by, bw, bh); Ctx.strokeStyle = '#f00'; Ctx.lineWidth = 2; Ctx.strokeRect(bx, by, bw, bh); let grad = Ctx.createLinearGradient(bx,0,bx+bw,0); grad.addColorStop(0,'#f00'); grad.addColorStop(1,'#800'); Ctx.fillStyle = grad; Ctx.fillRect(bx, by, bw*pct, bh); Ctx.fillStyle = '#f00'; Ctx.font = '16px "Press Start 2P"'; Ctx.textAlign = "center"; Ctx.fillText("TARGET: " + bossEnt.t.toUpperCase(), W/2, by - 10); }
        if(this.combo >= 3) { Ctx.save(); Ctx.fillStyle = `rgba(255, 0, 0, ${this.comboT/60})`; Ctx.font = '20px "Press Start 2P"'; Ctx.textAlign = "center"; Ctx.translate(W/2, 140); let scale = 1 + Math.sin(this.frame*0.5)*0.1; Ctx.scale(scale, scale); Ctx.fillText(this.combo + "x COMBO", 0, 0); if(this.combo >= 10) { Ctx.fillStyle = "#f00"; Ctx.font = '30px "Press Start 2P"'; let txt = "SLAUGHTER!"; if(this.combo >= 20) txt = "GODLIKE!"; if(this.combo >= 30) txt = "LEGENDARY!"; Ctx.fillText(txt, 0, 40); } Ctx.restore(); }

        if(!this.player) return;
        const glitchText = (txt) => { if(this.player.hp < this.player.maxHp*0.2 && Math.random()>0.7) return "!ERR0R!"; return txt; }
        document.getElementById('score').innerText = glitchText(this.score);
        document.getElementById('rival-kills').innerText = this.rivalKills;
        document.getElementById('wave').innerText=this.boss?"DANGER":"WAVE "+this.wave;
        document.getElementById('mech-hp').style.width=((this.player.hp/this.player.maxHp)*100)+"%";
        const wLvl=this.player.levels[this.player.wep];
        document.getElementById('weapon').innerHTML=this.player.wep.toUpperCase()+` <span style="color:#888;font-size:12px">LVL ${wLvl}</span>`;
        if(this.player.quad > 0) DOM.show('quad-indicator'); else DOM.hide('quad-indicator'); if(this.freeze > 0) DOM.show('freeze-indicator'); else DOM.hide('freeze-indicator');
        const sb = document.getElementById('shield-val'); if(sb) { sb.style.display = this.player.shield>0 ? 'flex' : 'none'; sb.innerText=this.player.shield; }
        const jb = document.getElementById('mech-jet'); if(jb) { if(this.player.type === 'heavy') { jb.style.background = '#f00'; let pct = (this.player.fuel / 50) * 100; jb.style.width = pct + "%"; } else { jb.style.background = !this.player.canFly ? '#f00' : '#f90'; jb.style.width = (this.player.fuel / this.player.maxFuel * 100) + "%"; } }
        if(this.player.hp < this.player.maxHp * 0.2) { document.getElementById('ui-layer').classList.add('critical-ui'); } else { document.getElementById('ui-layer').classList.remove('critical-ui'); }

        // UI UPDATE MODULE
        if(this.player.module) {
            const cdElem = document.getElementById('mod-cd');
            if(this.player.moduleCd > 0) {
                 cdElem.innerText = Math.ceil(this.player.moduleCd / 60);
                 cdElem.style.color = "#ea9e22";
            } else {
                 cdElem.innerText = "READY";
                 cdElem.style.color = "#0ff";
            }
        }
    }
};
