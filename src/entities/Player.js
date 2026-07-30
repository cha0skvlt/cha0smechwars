import { Entity } from './Entity.js';
import { BALANCE } from '../config/balance.js';
import { DOM } from '../core/dom.js';
import { Cam, Ctx, Input, W, H } from '../core/runtime.js';
import { Grid } from '../core/grid.js';
import { AudioSys } from '../audio/audio.js';
import { Cache, ShadowCv } from '../render/bake.js';
import { lerp } from '../core/lerp.js';
import { Game } from '../game/Game.js';
import { BotController } from './BotController.js';
import { Bullet } from './Bullet.js';
import { Turret } from './Turret.js';
import { GravityWell } from './GravityWell.js';
import { Particle, Shockwave, Floater } from './effects.js';

// @meta:Player - Main player entity with weapons, modules, abilities, and class-specific stats
export class Player extends Entity {
    constructor(type, isBot=false) {
        super(W/2,H/2,32,32);
        this.type = type; this.isBot = isBot;
        this.wep='pistol'; this.cd=0; this.inv=0; this.levels={pistol:1,shotgun:1,mg:1,rpg:1,laser:1}; this.quad=0;
        this.shield=0; this.shieldRegenT = 0;
        // Module system properties (turret, warp, emp, grav, overclock)
        this.module = null;
        this.moduleCd = 0;
        this.moduleMaxCd = 0;
        this.overclock = 0;

        this.recoilOff = {x:0, y:0};
        if(type === 'heavy') { this.hp = 18; this.maxHp = 18; this.spd = 3.5; this.fuel = 0; this.canFly = false; this.maxShield = 12; this.shieldRate = 180; }
        else if(type === 'scout') { this.hp = 10; this.maxHp = 10; this.spd = 5.0; this.fuel = 300; this.maxFuel = 300; this.canFly = true; this.maxShield = 4; this.shieldRate = 300; }
        else { this.hp = 12; this.maxHp = 12; this.spd = 4.5; this.fuel = 100; this.maxFuel = 100; this.canFly = true; this.maxShield = 6; this.shieldRate = 180; }
        this.flying=false; this.dashActive = false; this.dashVec = {x:0, y:0}; this.dashTime = 0; this.dashInv = 0; // Post-dash invulnerability for heavy mech

        let safe = false; let attempts = 0;
        while(!safe && attempts < 100) {
            attempts++;
            this.x = isBot ? (Math.random()*2800+100) : (1500);
            this.y = isBot ? (Math.random()*2800+100) : (1500);
            safe = !Game.checkWall({x:this.x, y:this.y, w:this.w, h:this.h});
        }
        if(!safe) { this.x = 1500; this.y = 1500; }
        this.lastX = this.x; this.lastY = this.y;

        if(this.isBot) {
             this.brain = new BotController(this);
        }
    }
    update() {
        this.recoilOff.x *= 0.8; this.recoilOff.y *= 0.8;
        if(this.shield > 0 && this.shield < this.maxShield && this.overclock <= 0) { this.shieldRegenT++; if(this.shieldRegenT >= this.shieldRate) { this.shield++; this.shieldRegenT = 0; } }
        let vx=0, vy=0;
        let input;
        if(this.isBot) { this.brain.update(); input = this.brain.input; }
        else { input = { w: Input.keys['KeyW'], s: Input.keys['KeyS'], a: Input.keys['KeyA'], d: Input.keys['KeyD'], space: Input.keys['Space'], mouse: Input.mouse, shift: Input.keys['ShiftLeft'] }; }

        if(!this.dashActive) { if(input.w) vy=-this.spd; if(input.s) vy=this.spd; if(input.a) vx=-this.spd; if(input.d) vx=this.spd; if(vx!=0&&vy!=0) {vx*=0.707; vy*=0.707;} }

        if(this.type !== 'heavy') {
            if(this.fuel <= 0) this.canFly = false; if(this.fuel > (this.type==='scout'?50:20)) this.canFly = true;
            if(input.space && this.canFly && this.fuel > 0) {
                this.flying=true; this.fuel -= 1.0; let mult = this.type === 'scout' ? 2.0 : 1.5;
                if(this.isBot) { } else if(vx!==0 || vy!==0) { vx*=mult; vy*=mult; }
                if(Game.frame%3===0) Game.parts.push(new Particle(this.x+16, this.y+32, '#0ff', 2)); if(!this.isBot) AudioSys.jetpack(this.x);
            } else { if(this.flying) this.land(); this.flying=false; if(this.fuel < (this.type==='scout'?300:100)) this.fuel += 0.5; }
        } else {
            if(this.dashActive) {
                vx = this.dashVec.x; vy = this.dashVec.y; this.dashTime--;
                if(this.dashTime <= 0) {
                    this.dashActive = false;
                    // Post-dash invulnerability for heavy mech (12 frames = 0.2s at 60fps)
                    // Balanced: fuel takes time to restore to 50, preventing spam
                    if(this.type === 'heavy') {
                        this.dashInv = 12;
                    }
                }
                // Optimized dash collision - replaced forEach with for loop
                let targets = this.isBot ? [Game.player, ...Game.enemies] : Game.enemies;
                for(let i=0, len=targets.length; i<len; i++) {
                    let e = targets[i];
                    if(this.rectIntersect(e)) {
                        Game.dmg(e, 5, this);
                        const ang = Math.atan2(e.y-this.y, e.x-this.x);
                        e.x += Math.cos(ang)*30;
                        e.y += Math.sin(ang)*30;
                        if(!this.isBot) {
                            Game.shake = 5;
                            AudioSys.impact(this.x);
                        }
                    }
                }
                Game.parts.push(new Particle(this.x+16, this.y+32, '#fa0', 1.5));
            } else {
                 if(this.fuel < 50) this.fuel++;
                 if(input.space && this.fuel >= 50) {
                     let mx = input.mouse.wx || (input.mouse.x+Cam.x); let my = input.mouse.wy || (input.mouse.y+Cam.y);
                     let ang = Math.atan2(my - (this.y+16), mx - (this.x+16));
                     if(!this.isBot && (vx!==0 || vy!==0)) ang = Math.atan2(vy, vx);
                     this.dashVec = { x: Math.cos(ang)*10, y: Math.sin(ang)*10 }; this.dashActive = true; this.dashTime = 8; this.fuel = 0; if(!this.isBot) AudioSys.dash(this.x);
                 }
            }
        }

        // Module activation logic (trigger: shift key, cooldown: moduleCd)
        if(this.moduleCd > 0) this.moduleCd--;
        if(input.shift && this.module && this.moduleCd <= 0) {
            AudioSys.moduleDeploy();
            if(this.module === 'turret') {
                // Turret module activation effect (15 particles, shockwave)
                if(!this.isBot) {
                    for(let i=0; i<15; i++) {
                        let ang = (Math.PI * 2 / 15) * i;
                        Game.parts.push(new Particle(
                            this.x + 16 + Math.cos(ang) * 10,
                            this.y + 16 + Math.sin(ang) * 10,
                            '#00eaff', 1.5
                        ));
                    }
                    Game.waves.push(new Shockwave(this.x+16, this.y+16, 50));
                }
                Game.friendlies.push(new Turret(this.x, this.y));
                this.moduleMaxCd = 900; // 15s
            }
            else if(this.module === 'warp') {
                Game.timeScale = 0.2; Game.warpTimer = BALANCE.MODULE_DURATION.warp;
                AudioSys.warpSound();
                this.moduleMaxCd = BALANCE.MODULE_COOLDOWN.warp;
            }
            else if(this.module === 'emp') {
                // THUNDERCLAP: 5 DMG to all enemies + Bullet Clear + Stun
                Game.bullets = Game.bullets.filter(b => !b.enemy);
                for(let i=0; i<Game.enemies.length; i++) {
                    let e = Game.enemies[i];
                    e.hitT = 120;
                    Game.dmg(e, 5, this);
                }
                // EMP activation visual effect (3 shockwaves, 30 lightning particles)
                if(!this.isBot) {
                    for(let i=0; i<3; i++) {
                        Game.waves.push(new Shockwave(this.x+16, this.y+16, 300 - i*50));
                    }
                    for(let i=0; i<30; i++) {
                        let ang = Math.random() * Math.PI * 2;
                        let dist = Math.random() * 300;
                        Game.parts.push(new Particle(
                            this.x+16 + Math.cos(ang)*dist,
                            this.y+16 + Math.sin(ang)*dist,
                            '#fff', 2
                        ));
                    }
                } else {
                    Game.waves.push(new Shockwave(this.x+16, this.y+16, 300));
                }
                AudioSys.empSound();
                this.moduleMaxCd = BALANCE.MODULE_COOLDOWN.emp;
            }
            else if(this.module === 'grav') {
                let mx = Input.mouse.wx || this.x + 16; let my = Input.mouse.wy || this.y + 16;
                // If bot, throw grav at target
                if(this.isBot && this.brain.target) { mx = this.brain.target.x; my = this.brain.target.y; }
                else if(!this.isBot && (!Input.mouse.wx || !Input.mouse.wy)) { mx = this.x + 16; my = this.y + 16; }

                Game.friendlies.push(new GravityWell(mx, my));
                AudioSys.gravSound();
                this.moduleMaxCd = BALANCE.MODULE_COOLDOWN.grav;
            }
            else if(this.module === 'overclock') {
                // Overclock module: Double fire rate, disable shield regen (duration: 300, penalty: shield=0)
                this.overclock = BALANCE.MODULE_DURATION.overclock;
                this.shield = 0;
                this.moduleMaxCd = BALANCE.MODULE_COOLDOWN.overclock;
                if(!this.isBot) {
                    DOM.show('overclock-indicator');
                    // Overclock activation effect (20 particles, shockwave)
                    for(let i=0; i<20; i++) {
                        Game.parts.push(new Particle(
                            this.x + 16, this.y + 16,
                            '#f00', 2
                        ));
                    }
                    Game.waves.push(new Shockwave(this.x+16, this.y+16, 100));
                }
            }
            this.moduleCd = this.moduleMaxCd;
        }
        if(this.overclock > 0) {
            this.overclock--;
            if(this.overclock <= 0) DOM.hide('overclock-indicator');
        }

        if(this.flying) { this.x+=vx; this.y+=vy; } else {
             const margin=6; let cx = vx; let cy = vy; if(this.isBot) { cx=vx; cy=vy; }
             const nx={x:this.x+cx+margin,y:this.y+margin,w:this.w-margin*2,h:this.h-margin*2};
             if(!Game.checkWall(nx)) this.x+=cx; else if(this.dashActive) { this.dashActive=false; if(!this.isBot){Game.shake=10; AudioSys.impact(this.x);} }
             const ny={x:this.x+margin,y:this.y+cy+margin,w:this.w-margin*2,h:this.h-margin*2};
             if(!Game.checkWall(ny)) this.y+=cy; else if(this.dashActive) { this.dashActive=false; if(!this.isBot){Game.shake=10; AudioSys.impact(this.x);} }
             if(Game.checkWall({x:this.x, y:this.y, w:this.w, h:this.h})) { this.resolveStuck(); }
        }
        this.x=Math.max(0,Math.min(3000-this.w,this.x)); this.y=Math.max(0,Math.min(3000-this.h,this.y));
        if(this.cd>0) this.cd--; if(this.inv>0) this.inv--; if(this.dashInv>0) this.dashInv--; if(this.quad>0) this.quad--;

        if(input.mouse.down && this.cd<=0 && !this.dashActive) {
            const c=this.center(), ang=Math.atan2(input.mouse.wy-c.y, input.mouse.wx-c.x);
            const l=this.levels[this.wep];
            let kick = this.wep==='rpg'?8:(this.wep==='shotgun'?4:1);
            // Level 2+ dual shots: MG/RPG/Laser get recoil multiplier
            const hasDual = l >= 2 && (this.wep==='mg' || this.wep==='rpg' || this.wep==='laser');
            if(hasDual) kick *= 1.5;
            this.recoilOff.x -= Math.cos(ang) * kick; this.recoilOff.y -= Math.sin(ang) * kick;
            if(this.wep!=='laser' && !this.flying) {
                let kx = Math.cos(ang)*kick; let ky = Math.sin(ang)*kick;
                if(!Game.checkWall({x:this.x-kx,y:this.y,w:this.w,h:this.h})) this.x-=kx;
                if(!Game.checkWall({x:this.x,y:this.y-ky,w:this.w,h:this.h})) this.y-=ky;
                if(!this.isBot) Game.shake=kick*1.5;
            }
            // Muzzle flash effect when firing (weapon-specific, 2 particles)
            if(!this.isBot) {
                let flashColor = this.wep==='laser' ? '#f0f' : (this.wep==='rpg' ? '#ff0' : '#fff');
                for(let i=0; i<2; i++) {
                    let flashAng = ang + (Math.random()-0.5)*0.5;
                    let flashDist = 15 + Math.random()*5;
                    Game.parts.push(new Particle(
                        c.x + Math.cos(flashAng)*flashDist,
                        c.y + Math.sin(flashAng)*flashDist,
                        flashColor, 2
                    ));
                }
            }
            const spawn = (ox, oy, spreadAngle=0) => {
                let bulletAng = ang + spreadAngle;
                let b = new Bullet(c.x+ox, c.y+oy, bulletAng, this.wep, false, l);
                if(this.isBot) b.bot = true;
                Game.bullets.push(b);
            };

            // Level 2+ effects: dual shots for MG/RPG/Laser
            if(hasDual) {
                const perp = ang + Math.PI/2;
                const offX = Math.cos(perp)*10;
                const offY = Math.sin(perp)*10;
                spawn(offX, offY);
                spawn(-offX, -offY);
            } else if(this.wep==='shotgun') {
                // Shotgun: Level 2+ doubles pellets and reduces spread
                let cnt = 5 + l;
                if(l >= 2) cnt *= 2; // Double pellets at level 2+
                const spread = l >= 2 ? 0.48 : 0.8; // Tighter spread at level 2+
                for(let i=0; i<cnt; i++) {
                    spawn(0, 0, (Math.random()-.5)*spread);
                }
            } else if(this.wep==='rpg' && l >= 2) {
                // Level 2+ RPG: dual rockets
                const perp = ang + Math.PI/2;
                const offX = Math.cos(perp)*10;
                const offY = Math.sin(perp)*10;
                spawn(offX, offY);
                spawn(-offX, -offY);
            } else if(this.wep==='laser' && l >= 2) {
                // Level 2+ Laser: dual lasers
                const perp = ang + Math.PI/2;
                const offX = Math.cos(perp)*8;
                const offY = Math.sin(perp)*8;
                spawn(offX, offY);
                spawn(-offX, -offY);
            } else {
                spawn(0, 0);
            }

            // Unified fire rate scaling: baseCooldown - (level - 1)
            let baseCd = 0;
            const baseCooldowns = {
                pistol: 18,
                shotgun: 45,
                mg: 6,
                rpg: 80,
                laser: 50
            };
            const minCooldowns = {
                pistol: 5,
                shotgun: 20,
                mg: 2,
                rpg: 40,
                laser: 30
            };
            const baseCooldown = baseCooldowns[this.wep] || 18;
            const minCooldown = minCooldowns[this.wep] || 5;
            baseCd = Math.max(minCooldown, baseCooldown - (l - 1));

            if(this.overclock > 0) baseCd = Math.floor(baseCd * 0.5);
            this.cd = baseCd;

            AudioSys.shoot(this.wep, this.x);
        }
        if(!this.isBot) AudioSys.updateFilter(this.hp/this.maxHp);
    }
    resolveStuck() {
        const nearby = Grid.get({x:this.x, y:this.y, w:this.w, h:this.h});
        // Optimized collision check - replaced for...of with for loop
        for(let i=0, len=nearby.length; i<len; i++) {
            let o = nearby[i];
            if(o.rectIntersect(this)) {
                const cx = this.x + this.w/2; const cy = this.y + this.h/2;
                const ox = o.x + o.w/2; const oy = o.y + o.h/2;
                let dx = cx - ox; let dy = cy - oy;
                const distSq = dx*dx + dy*dy;
                const dist = Math.sqrt(distSq);
                if(dist > 0) { this.x += (dx/dist) * 2; this.y += (dy/dist) * 2; } else { this.x += 1; }
            }
        }
    }
    land() {
        if(!this.isBot) { Game.shake=20; AudioSys.impact(this.x); }
        if (this.isBot) { Game.explode(this.x+16, this.y+32, 80, false, true, false, true, this); }
        else { Game.explode(this.x+16, this.y+32, 80, true, true, false, false, this); }
    }
    draw(alpha) {
        let dX = lerp(this.lastX, this.x, alpha); let dY = lerp(this.lastY, this.y, alpha);
        let dx = this.recoilOff.x; let dy = this.recoilOff.y;
        // Visual invulnerability: only regular inv (no visual effect for dash/post-dash inv to avoid confusion)
        if(this.inv>0&&Game.frame%4<2) return;
        if(this.flying) Ctx.drawImage(ShadowCv, dX, dY+48, 32, 16); else Ctx.drawImage(ShadowCv, dX, dY+24, 32, 16);
        const s = this.flying ? 1.2 : 1; const off = this.flying ? -10 : 0;
        let key = this.isBot ? ('bot_'+this.type) : (this.type==='battle'?'player':this.type); if(this.quad > 0 && !this.isBot) key += '_q';
        Ctx.drawImage(Cache[key], dX - (s-1)*16 + dx, dY - (s-1)*16 + off + dy, 32*s, 32*s);
        if(this.shield > 0) { Ctx.save(); Ctx.globalCompositeOperation = 'lighter'; let col = this.isBot ? '255, 0, 0' : '0, 255, 255'; Ctx.strokeStyle = `rgba(${col}, ${0.6 + Math.sin(Game.frame*0.2)*0.2})`; Ctx.fillStyle = `rgba(${col}, 0.15)`; Ctx.lineWidth = 2; Ctx.beginPath(); Ctx.arc(dX+16, dY+16+off, 28, 0, Math.PI*2); Ctx.fill(); Ctx.stroke(); Ctx.restore(); }
        if(this.dashActive) { Ctx.globalAlpha = 0.5; Ctx.drawImage(Cache[key], dX - this.dashVec.x*2, dY - this.dashVec.y*2, 32, 32); Ctx.globalAlpha = 1.0; }
        if(this.overclock > 0) { Ctx.save(); Ctx.globalCompositeOperation='lighter'; Ctx.fillStyle=`rgba(255,0,0,${Math.sin(Game.frame)*0.5})`; Ctx.fillRect(dX,dY,32,32); Ctx.restore(); }
    }
    takeDamage(amt=1, source=null) {
        // Invulnerability: during dash OR post-dash invulnerability for heavy mech
        if(this.inv>0 || this.dashActive || (this.type === 'heavy' && this.dashInv > 0)) return;
        this.lastAttacker = source;
        if(!this.isBot) { DOM.glitch(); if(amt >= 3) AudioSys.triggerConcussion(); }
        Game.floaters.push(new Floater(this.x + 16, this.y, amt, true));
        if(this.shield > 0) { this.shield -= amt; AudioSys.playTone(800, 'sawtooth', 0.1, 0.1, null, this.x); this.inv=20; } else { this.hp -= amt; this.inv=30; }
        if(!this.isBot) Game.shake=5; Game.parts.push(new Particle(this.x, this.y, this.isBot ? '#f00' : '#0ff'));
    }
}
