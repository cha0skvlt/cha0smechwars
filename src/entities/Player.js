import { Entity } from './Entity.js';
import { BALANCE } from '../config/balance.js';
import { DOM } from '../core/dom.js';
import { Input, W, H, Cam } from '../core/runtime.js';
import { Grid } from '../core/grid.js';
import { AudioSys } from '../audio/audio.js';
import { renderVisual } from '../render/PixelRenderer.js';
import { lerp } from '../core/lerp.js';
import { Game } from '../game/Game.js';
import { BotController } from './BotController.js';
import { Bullet } from './Bullet.js';
import { Turret } from './Turret.js';
import { GravityWell } from './GravityWell.js';
import { Particle, Shockwave, Floater } from './effects.js';
import { Logger } from '../core/Logger.js';
import { applyDamage, isHostile } from '../combat/damage.js';
import { separationPush } from '../combat/collision.js';
import { rpgFireKick, rpgFireShake } from '../combat/rpgFeel.js';
import { regenerateFuel } from './fuel.js';
import { initializeProgression } from '../progression/progression.js';

// @meta:Player - Main mech entity with weapons, modules, abilities, and class-specific stats
// v8 Lance Update: same class drives every lance mech (human-controlled, AI-follow, or rival) -
// control routing is `isBot`/`isHumanPlayer`, flipped at runtime by Game.switchControl().
export class Player extends Entity {
    constructor(type, options={}) {
        super(W/2,H/2,32,32);
        if(typeof options === 'boolean') options = { isBot: options };
        this.type = type;
        this.isBot = !!options.isBot;
        this.isHumanPlayer = !this.isBot;
        this.faction = options.faction || (this.isBot ? 'rival' : 'player');
        this.role = options.role || (this.isBot ? (this.faction === 'rival' ? 'rival' : 'ally') : 'human');
        this.owner = options.owner || null;
        this.lanceSlot = Number.isInteger(options.lanceSlot) ? options.lanceSlot : 0;
        this.ownsProgression = true;
        this.wep='pistol'; this.cd=0; this.inv=0; this.levels={pistol:1,shotgun:1,mg:1,rpg:1,laser:1}; this.quad=0;
        this.shield=0; this.shieldRegenT = 0;
        // Module system properties (turret, warp, emp, grav, overclock)
        this.module = null;
        this.moduleCd = 0;
        this.moduleMaxCd = 0;
        this.overclock = 0;
        initializeProgression(this);

        // Tactical upgrade flags (v8) - set by progression/tacticalUpgrades.js applyLoadout(), read here and in Game.js/Turret.js/BotController.js.
        this.bastionShield = false;
        this.seismicSlam = false;
        this.juggernautMk2 = false;
        this.permaFlight = false;
        this.formationTactics = false;
        this.turretVariant = 'mg';

        this.recoilOff = {x:0, y:0};
        const mech = BALANCE.MECHS[type] || BALANCE.MECHS.battle;
        this.hp = mech.hp; this.maxHp = mech.hp; this.spd = mech.spd;
        this.fuel = mech.fuel; this.maxFuel = mech.maxFuel; this.canFly = mech.canFly;
        this.baseMaxFuel = mech.maxFuel;
        this.maxShield = mech.shield;
        this.jetMult = mech.jetMult || 1;
        this.fuelRefillThreshold = mech.fuelRefillThreshold || 0;
        this.fuelRegen = mech.fuelRegen || 0;
        this.fuelDrain = mech.fuelDrain || 0;
        this.flying=false; this.dashActive = false; this.dashVec = {x:0, y:0}; this.dashInv = 0;
        this.facing = 0;
        this.hitT = 0;
        this.mechKills = 0; // enemy mechs this specific mech has personally destroyed (HUD skull badges)

        // Battle ships with its turret module pre-equipped - no pickup required (v8 section 9.2).
        if(type === 'battle') {
            this.module = 'turret';
            this.moduleCd = 0;
            this.moduleMaxCd = BALANCE.MODULE_COOLDOWN.turret;
        }

        let safe = false; let attempts = 0;
        while(!safe && attempts < 100) {
            attempts++;
            this.x = this.isBot ? (Math.random()*2800+100) : (1500);
            this.y = this.isBot ? (Math.random()*2800+100) : (1500);
            safe = !Game.checkWall({x:this.x, y:this.y, w:this.w, h:this.h});
        }
        if(!safe) { this.x = 1500; this.y = 1500; }
        this.lastX = this.x; this.lastY = this.y;

        if(this.isBot) {
             this.brain = new BotController(this);
        }
    }
    update() {
        if(this.hp <= 0) return; // dead lance mechs are corpses until Resurrect revives them
        this.recoilOff.x *= 0.8; this.recoilOff.y *= 0.8;
        if(this.shield > 0 && this.shield < this.maxShield && this.overclock <= 0) {
            this.shieldRegenT++;
            if(this.shieldRegenT >= this.shieldRegenRate) { this.shield += BALANCE.UNIT; this.shieldRegenT = 0; }
        }
        let vx=0, vy=0;
        let input;
        if(this.isBot) { this.brain.update(); input = this.brain.input; }
        else { input = { w: Input.keys['KeyW'], s: Input.keys['KeyS'], a: Input.keys['KeyA'], d: Input.keys['KeyD'], space: Input.keys['Space'], mouse: Input.mouse, shift: Input.keys['ShiftLeft'] }; }

        if(!this.dashActive) { if(input.w) vy=-this.spd; if(input.s) vy=this.spd; if(input.a) vx=-this.spd; if(input.d) vx=this.spd; if(vx!=0&&vy!=0) {vx*=0.707; vy*=0.707;} }

        if(this.type !== 'heavy') {
            if(this.permaFlight) {
                // Perma-Flight (v8 scout upgrade): inverted jetpack - airborne by default, hold Space to land.
                // Fuel drains while flying (the default state) and regenerates while grounded.
                const wantsGround = !!input.space;
                if(wantsGround || this.fuel <= 0) {
                    if(this.flying) this.land();
                    this.flying = false;
                    if(this.fuel < this.maxFuel) regenerateFuel(this, this.fuelRegen);
                } else {
                    this.flying = true;
                    this.fuel = Math.max(0, this.fuel - this.fuelDrain);
                    let mult = this.jetMult;
                    if(this.isBot) { } else if(vx!==0 || vy!==0) { vx*=mult; vy*=mult; }
                    if(Game.frame%3===0) Game.parts.push(new Particle(this.x+16, this.y+32, '#0ff', 2)); if(!this.isBot) AudioSys.jetpack(this.x);
                }
            } else {
                if(this.fuel <= 0) this.canFly = false; if(this.fuel > this.fuelRefillThreshold) this.canFly = true;
                if(input.space && this.canFly && this.fuel > 0) {
                    this.flying=true; this.fuel -= this.fuelDrain; let mult = this.jetMult;
                    if(this.isBot) { } else if(vx!==0 || vy!==0) { vx*=mult; vy*=mult; }
                    if(Game.frame%3===0) Game.parts.push(new Particle(this.x+16, this.y+32, '#0ff', 2)); if(!this.isBot) AudioSys.jetpack(this.x);
                } else { if(this.flying) this.land(); this.flying=false; if(this.fuel < this.maxFuel) regenerateFuel(this, this.fuelRegen); }
            }
        } else {
            // Juggernaut Dash (v8): ground rush held with Space, drains fuel per frame, ends when
            // fuel runs out or the button is released. Contact-immune while rushing, still bullet-vulnerable.
            const heavy = BALANCE.MECHS.heavy;
            const dashDamage = this.juggernautMk2 ? BALANCE.DAMAGE.dashMk2 : BALANCE.DAMAGE.dash;
            const fuelDrain = this.juggernautMk2 ? heavy.dashFuelDrain * 0.7 : heavy.dashFuelDrain;
            if(this.dashActive) {
                if(input.space && this.fuel > 0) {
                    vx = this.dashVec.x; vy = this.dashVec.y;
                    this.fuel = Math.max(0, this.fuel - fuelDrain);
                    const targets = Game.getCombatTargets(this);
                    for(let i=0, len=targets.length; i<len; i++) {
                        let e = targets[i];
                        if(this.rectIntersect(e)) {
                            Game.dmg(e, dashDamage, this);
                            const ang = Math.atan2(e.y-this.y, e.x-this.x);
                            e.x += Math.cos(ang)*heavy.dashKnockback;
                            e.y += Math.sin(ang)*heavy.dashKnockback;
                            if(!this.isBot) {
                                Game.shake = 5;
                                AudioSys.impact(this.x);
                            }
                        }
                    }
                    Game.parts.push(new Particle(this.x+16, this.y+32, '#fa0', 1.5));
                } else {
                    this.endJuggernautDash();
                }
            } else {
                 if(this.fuel < this.maxFuel) regenerateFuel(this, heavy.fuelRegen);
                 if(input.space && this.fuel > 0) {
                     let mx = input.mouse.wx || (input.mouse.x+Cam.x); let my = input.mouse.wy || (input.mouse.y+Cam.y);
                     let ang = Math.atan2(my - (this.y+16), mx - (this.x+16));
                     if(!this.isBot && (vx!==0 || vy!==0)) ang = Math.atan2(vy, vx);
                     this.dashVec = { x: Math.cos(ang)*heavy.dashSpeed, y: Math.sin(ang)*heavy.dashSpeed };
                     this.dashActive = true; this.facing = ang;
                     if(!this.isBot) AudioSys.dash(this.x);
                 }
            }
        }

        // Module activation logic (trigger: shift key, cooldown: moduleCd)
        if(this.moduleCd > 0) this.moduleCd--;
        if(input.shift && this.module && this.moduleCd <= 0) {
            AudioSys.moduleDeploy();
            Logger.event('player', 'module_activate', this.module, { module: this.module, bot: !!this.isBot, class: this.type });
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
                Game.friendlies.push(new Turret(this.x, this.y, this));
                this.moduleMaxCd = BALANCE.MODULE_COOLDOWN.turret;
            }
            else if(this.module === 'warp') {
                Game.timeScale = 0.2; Game.warpTimer = BALANCE.MODULE_DURATION.warp;
                AudioSys.warpSound();
                this.moduleMaxCd = BALANCE.MODULE_COOLDOWN.warp;
            }
            else if(this.module === 'emp') {
                Game.bullets = Game.bullets.filter(b => !isHostile(b.source, this));
                const targets = Game.getCombatTargets(this);
                for(let i=0; i<targets.length; i++) {
                    let e = targets[i];
                    e.hitT = 120;
                    Game.dmg(e, BALANCE.DAMAGE.emp, this);
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

                Game.friendlies.push(new GravityWell(mx, my, this));
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

        if(vx !== 0 || vy !== 0) this.facing = Math.atan2(vy, vx);

        // Lance mech separation: with 6 mechs on the field (both lances), AI steering alone
        // routinely parks multiple mechs on the exact same spot (e.g. wing mechs closing on the
        // same enemy at the same desiredDist/angle) with nothing to keep them apart - mirrors the
        // existing Enemy-Enemy separation (Enemy.js) so mechs get the same clear-boundary push.
        // Skipped during Juggernaut Dash - the dash is a deliberate contact-ram through the pack.
        if(!this.dashActive) {
            const allMechs = Game.getAllLanceMechs();
            let sepVx = 0, sepVy = 0;
            for(let i=0, len=allMechs.length; i<len; i++) {
                const m = allMechs[i];
                if(m === this || m.hp <= 0) continue;
                const mdx = this.x - m.x, mdy = this.y - m.y;
                const dSq = mdx*mdx + mdy*mdy;
                if(dSq < BALANCE.MECH_SEPARATION_SQ && dSq > 0) {
                    const invD = 1 / Math.sqrt(dSq);
                    sepVx += mdx * invD * 1.5;
                    sepVy += mdy * invD * 1.5;
                }
            }
            vx += sepVx; vy += sepVy;
        }

        // Mech<->enemy separation: monsters/bosses previously had zero physical presence against a
        // mech (only one-directional contact damage - see Game.js's enemy update loop - no push),
        // so a mech could stand fully inside a boss sprite. Size-aware (enemies range 32-64px,
        // unlike the uniform 32x32 pairing above) via the shared separationPush helper. Skipped
        // flying/dashing for the same reasons as the mech-mech separation just above.
        if(!this.flying && !this.dashActive) {
            const cx = this.x + this.w/2, cy = this.y + this.h/2, myHalf = this.w/2;
            let sepVx = 0, sepVy = 0;
            for(let i=0, len=Game.enemies.length; i<len; i++) {
                const en = Game.enemies[i];
                if(en.dead || en.hp <= 0) continue;
                const push = separationPush(
                    cx, cy, myHalf,
                    en.x + en.w/2, en.y + en.h/2, en.w/2,
                    BALANCE.MECH_ENEMY_SEPARATION_PAD, BALANCE.SEPARATION_PUSH_MULT,
                );
                if(push) { sepVx += push.x; sepVy += push.y; }
            }
            vx += sepVx; vy += sepVy;
        }

        if(this.flying) { this.x+=vx; this.y+=vy; } else {
             const margin=6; let cx = vx; let cy = vy; if(this.isBot) { cx=vx; cy=vy; }
             const nx={x:this.x+cx+margin,y:this.y+margin,w:this.w-margin*2,h:this.h-margin*2};
             if(!Game.checkWall(nx)) this.x+=cx; else if(this.dashActive) { this.endJuggernautDash(); if(!this.isBot){Game.shake=10; AudioSys.impact(this.x);} }
             const ny={x:this.x+margin,y:this.y+cy+margin,w:this.w-margin*2,h:this.h-margin*2};
             if(!Game.checkWall(ny)) this.y+=cy; else if(this.dashActive) { this.endJuggernautDash(); if(!this.isBot){Game.shake=10; AudioSys.impact(this.x);} }
             if(Game.checkWall({x:this.x, y:this.y, w:this.w, h:this.h})) { this.resolveStuck(); }
        }
        this.x=Math.max(0,Math.min(3000-this.w,this.x)); this.y=Math.max(0,Math.min(3000-this.h,this.y));
        if(this.cd>0) this.cd--; if(this.inv>0) this.inv--; if(this.dashInv>0) this.dashInv--; if(this.quad>0) this.quad--; if(this.hitT>0) this.hitT--;

        if(input.mouse.down && this.cd<=0 && !this.dashActive) {
            const c=this.center(), ang=Math.atan2(input.mouse.wy-c.y, input.mouse.wx-c.x);
            const l=this.levels[this.wep];
            let kick = this.wep==='rpg'
                ? rpgFireKick(l)
                : (this.wep==='shotgun'?4:1);
            // Level 2+ dual shots: MG/RPG/Laser get recoil multiplier
            const hasDual = l >= 2 && (this.wep==='mg' || this.wep==='rpg' || this.wep==='laser');
            if(hasDual && this.wep!=='rpg') kick *= 1.5;
            this.recoilOff.x -= Math.cos(ang) * kick; this.recoilOff.y -= Math.sin(ang) * kick;
            if(this.wep!=='laser' && !this.flying) {
                let kx = Math.cos(ang)*kick; let ky = Math.sin(ang)*kick;
                if(!Game.checkWall({x:this.x-kx,y:this.y,w:this.w,h:this.h})) this.x-=kx;
                if(!Game.checkWall({x:this.x,y:this.y-ky,w:this.w,h:this.h})) this.y-=ky;
                if(!this.isBot) {
                    Game.shake = this.wep==='rpg' ? rpgFireShake(l) : kick*1.5;
                }
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
                let b = new Bullet(c.x+ox, c.y+oy, bulletAng, this.wep, false, l, this);
                b.airborne = !!this.flying;
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
                const sg = BALANCE.WEAPONS.shotgun;
                let cnt = sg.pelletsBase + l;
                if(l >= 2) cnt *= 2;
                const spread = l >= 2 ? sg.spreadL2 : sg.spreadL1;
                for(let i=0; i<cnt; i++) {
                    spawn(0, 0, (Math.random()-.5)*spread);
                }
            } else {
                spawn(0, 0);
            }

            // Unified fire rate: max(minCd, baseCd - (level - 1))
            const wcfg = BALANCE.WEAPONS[this.wep] || BALANCE.WEAPONS.pistol;
            let baseCd = Math.max(wcfg.minCd, wcfg.baseCd - (l - 1));
            baseCd = Math.ceil(baseCd * this.fireRateMult);

            if(this.overclock > 0) baseCd = Math.floor(baseCd * 0.5);
            this.cd = baseCd;

            AudioSys.shoot(this.wep, this.x);
            Logger.debug('combat', 'shoot', this.wep, { wep: this.wep, bot: !!this.isBot, lvl: l });
        }
        if(!this.isBot) AudioSys.updateFilter(this.hp/this.maxHp);
    }
    endJuggernautDash() {
        if(!this.dashActive) return;
        this.dashActive = false;
        this.dashInv = BALANCE.MECHS.heavy.dashPostInv;
        if(this.seismicSlam) {
            Game.explode(
                this.x+16, this.y+16, BALANCE.HEAVY_ABILITIES.seismicSlamRadius,
                this.faction === 'player', false, false, this.faction === 'rival', this, null, BALANCE.DAMAGE.seismicSlam,
            );
            if(!this.isBot) { Game.shake = 15; AudioSys.impact(this.x); }
        }
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
        if (this.isBot) { Game.explode(this.x+16, this.y+32, 80, false, true, false, true, this, null, BALANCE.DAMAGE.dash); }
        else { Game.explode(this.x+16, this.y+32, 80, true, true, false, false, this, null, BALANCE.DAMAGE.dash); }
    }
    draw(alpha) {
        if(this.hp <= 0) return; // corpses render nothing until Resurrect revives them
        let dX = lerp(this.lastX, this.x, alpha); let dY = lerp(this.lastY, this.y, alpha);
        let dx = this.recoilOff.x; let dy = this.recoilOff.y;
        renderVisual('shadow.ground', { x: dX, y: this.flying ? dY + 48 : dY + 24, width: 32 });
        const s = this.flying ? 1.2 : 1; const off = this.flying ? -10 : 0;
        const rival = this.faction === 'rival';
        let spriteId = rival ? `sprite.rival.${this.type}` : `sprite.player.${this.type}`;
        // Hit feedback: white flash right on impact (hitT), then alternates color/white for the
        // rest of regular i-frames (no visual for dash/post-dash inv, to avoid confusion with the
        // dash echo). Previously this skipped the draw call entirely, which showed the dark
        // background through the mech instead of an actual flash - read as "flashing to black".
        if(this.hitT > 0 || (this.inv > 0 && Game.frame % 4 < 2)) spriteId += '.hit';
        else if(this.quad > 0 && !rival) spriteId += '.quad';
        renderVisual(spriteId, { x: dX - (s-1)*16 + dx, y: dY - (s-1)*16 + off + dy, width: 32*s, height: 32*s });
        if(this.shield > 0) renderVisual(rival ? 'effect.shield.rival' : 'effect.shield.player', {
            x: dX + 16,
            y: dY + 16 + off,
            radius: this.bastionShield ? 28 * BALANCE.HEAVY_ABILITIES.bastionShieldRadiusMult : 28,
            rgb: rival ? '255, 0, 0' : '0, 255, 255',
            pulse: 0.6 + Math.sin(Game.frame * 0.2) * 0.2,
        });
        if(this.dashActive) renderVisual('effect.dash.echo', {
            spriteId,
            x: dX - this.dashVec.x * 2,
            y: dY - this.dashVec.y * 2,
            width: 32,
            height: 32,
        });
        if(this.overclock > 0) renderVisual('effect.overclock', {
            x: dX,
            y: dY,
            width: 32,
            height: 32,
            alpha: Math.sin(Game.frame) * 0.5,
        });
    }
    takeDamage(amt, source=null, channel='generic') {
        // Juggernaut Dash: contact-immune while rushing, bullets/explosions still land.
        if(this.type === 'heavy' && this.dashActive && channel === 'contact') return false;
        // Invulnerability: post-hit i-frames OR post-dash invulnerability window for heavy
        if(this.inv>0 || (this.type === 'heavy' && this.dashInv > 0)) return false;
        this.lastAttacker = source;
        if(!this.isBot) { DOM.glitch(); if(amt >= 3) AudioSys.triggerConcussion(); }
        Game.floaters.push(new Floater(this.x + 16, this.y, amt, 'hurt'));
        const { shieldDamage, hpDamage } = applyDamage(this, amt);
        if(shieldDamage > 0) {
            AudioSys.playTone(800, 'sawtooth', 0.1, 0.1, null, this.x);
            this.inv = BALANCE.IFRAMES.shieldHit;
        }
        if(hpDamage > 0) {
            this.inv = BALANCE.IFRAMES.hpHit;
        }
        this.hitT = 8;
        if(!this.isBot) Game.shake=5;
        Game.parts.push(new Particle(this.x, this.y, this.faction === 'rival' ? '#f00' : '#0ff'));
        return true;
    }
}
