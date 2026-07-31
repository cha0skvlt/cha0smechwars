import { Entity } from './Entity.js';
import { BALANCE } from '../config/balance.js';
import { Cam, W, H } from '../core/runtime.js';
import { AudioSys } from '../audio/audio.js';
import { renderVisual } from '../render/PixelRenderer.js';
import { lerp } from '../core/lerp.js';
import { Game } from '../game/Game.js';
import { Bullet } from './Bullet.js';
import { Particle } from './effects.js';
import { applyDamage } from '../combat/damage.js';
import { shieldRingRadius } from '../combat/shield.js';

// Hex '#rgb' / '#rrggbb' → "r, g, b" for rgba()
function hexToRgbTriplet(hex) {
    if(!hex || typeof hex !== 'string') return '255, 255, 255';
    let h = hex.replace('#', '');
    if(h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    const n = parseInt(h, 16);
    if(Number.isNaN(n)) return '255, 255, 255';
    return `${(n>>16)&255}, ${(n>>8)&255}, ${n&255}`;
}

// @meta:Enemy - AI, weapons from BALANCE.ENEMIES, shared DU shield physics
export class Enemy extends Entity {
    constructor(type) {
        super(0,0,32,32);
        this.t=BALANCE.ENEMIES[type] ? type : 'zombie';
        this.faction = 'enemy';
        this.aiT=0; this.hitT=0; this.dodgeCool=0; this.dodging=false;
        this.blood='#a00'; this.dead=false; this.lastAttacker = null;
        this.shieldRegenT = 0;

        let safe=false; let attempts=0;
        while(!safe && attempts<100){
            attempts++;
            let a=Math.random()*6.28,d=500+Math.random()*400;
            this.x=Game.player.x+Math.cos(a)*d; this.y=Game.player.y+Math.sin(a)*d;
            if(this.x>50&&this.x<2950&&this.y>50&&this.y<2950) {
                safe = !Game.checkWall({x:this.x,y:this.y,w:this.w,h:this.h});
            }
        }
        if(!safe) { this.x=1500+Math.random()*200-100; this.y=1500+Math.random()*200-100; }
        this.lastX=this.x; this.lastY=this.y;

        let hpMult = Game.getDifficultyMultiplier();
        const def = BALANCE.ENEMIES[this.t];
        const scaled = def.scaleWithDifficulty ? def.hp * hpMult : def.hp;
        this.hp = scaled;
        this.spd = def.spd;
        this.w = def.w; this.h = def.h;
        this.sc = def.sc;
        this.blood = def.blood;
        this.weapons = def.weapons ? def.weapons.slice() : [];
        this.contact = def.contact ?? BALANCE.DAMAGE.contact;
        this.shield = def.shield || 0;
        this.maxShield = def.maxShield || 0;

        const colors = { zombie:'#5b5', gunner:'#eb2', shotman:'#f60', tank:'#684', commando:'#222', stalker:'#d44', sniper:'#fff', mantis:'#5f5', fortress:'#889', eye:'#a0f' };
        this.c = colors[this.t];
        this.visualId = `sprite.enemy.${this.t}`;
        this.maxHp = this.hp;
        this.baseColor = this.c;
    }

    wep(i=0) {
        return this.weapons[i] || null;
    }

    fireBullet(x, y, ang, wep, lvl=1) {
        if(!wep) return null;
        const b = new Bullet(x, y, ang, wep, true, lvl, this);
        b.airborne = !!this.flying;
        Game.bullets.push(b);
        return b;
    }

    regenShield() {
        // Regen only while shield not broken to zero
        if(this.shield > 0 && this.shield < this.maxShield) {
            this.shieldRegenT++;
            if(this.shieldRegenT >= BALANCE.SHIELD.regenRate) {
                this.shield += BALANCE.UNIT;
                this.shieldRegenT = 0;
            }
        } else {
            this.shieldRegenT = 0;
        }
    }

    update() {
        if(Game.freeze>0 || !Game.player) return;
        this.regenShield();

        const c=this.center();
        const targets = Game.getCombatTargets(this).filter(target => !target.flying);
        let target = null;
        let distSq = Infinity;
        for(let i=0; i<targets.length; i++) {
            const candidate = targets[i];
            const dx = candidate.x-c.x, dy = candidate.y-c.y;
            const candidateDistSq = dx*dx + dy*dy;
            if(candidateDistSq < distSq) {
                target = candidate;
                distSq = candidateDistSq;
            }
        }
        if(!target) return;
        let dist = Math.sqrt(distSq);

        const ang=Math.atan2(target.y-c.y, target.x-c.x);
        let spd=this.spd; if(this.hitT>0){spd*=0.5;this.hitT--;} let vx=0, vy=0;

        if(Game.timeScale < 1.0) spd *= Game.timeScale;

        for(let i=0; i<Game.enemies.length; i++) {
            let e = Game.enemies[i];
            if(e !== this && !e.dead) {
                let edx = this.x - e.x, edy = this.y - e.y;
                let dSq = edx*edx + edy*edy;
                if(dSq < BALANCE.ENEMY_SEPARATION_SQ && dSq > 0) {
                    let invD = 1 / Math.sqrt(dSq);
                    vx += edx * invD * 1.5;
                    vy += edy * invD * 1.5;
                }
            }
        }

        const primary = this.wep(0);
        const secondary = this.wep(1);
        const def = BALANCE.ENEMIES[this.t];

        if(this.t==='mantis') {
            this.aiT++;
            let rage = (this.hp < BALANCE.ENEMIES.mantis.hp * Game.getDifficultyMultiplier() * 0.5);
            let currentSpd = rage ? spd * 1.5 : spd;
            if(rage && Game.frame % 10 < 5) this.c = '#f00';
            else if(rage) this.c = '#fff';
            else this.c = this.baseColor;
            if(this.aiT < 60) { vx += Math.cos(ang)*currentSpd; vy += Math.sin(ang)*currentSpd; }
            else if(this.aiT < (rage ? 75 : 90)) { vx=0; vy=0; }
            else if(primary) {
                let step = rage ? 0.15 : 0.25;
                for(let i=-0.5; i<=0.5; i+=step) this.fireBullet(c.x,c.y,ang+i,primary);
                AudioSys.shoot(primary, this.x); this.aiT=0;
            }
        }
        else if(this.t==='fortress') {
            this.aiT++;
            vx += Math.cos(ang)*spd; vy += Math.sin(ang)*spd;
            if(this.aiT%10===0 && primary) {
                this.fireBullet(c.x,c.y,ang+(Math.random()-.2)*.4,primary);
                AudioSys.shoot(primary, this.x);
            }
            if(this.aiT%120===0 && secondary) {
                this.fireBullet(c.x,c.y,ang,secondary);
                AudioSys.shoot(secondary, this.x);
            }
        }
        else if(this.t==='eye') {
            this.aiT++;
            let dT = 250;
            if(dist < dT) { vx -= Math.cos(ang)*spd; vy -= Math.sin(ang)*spd; }
            else { vx += Math.cos(ang)*spd; vy += Math.sin(ang)*spd; }
            vx += Math.cos(this.aiT*0.05)*2; vy += Math.sin(this.aiT*0.05)*2;
            if(this.aiT%60===0 && primary) {
                this.fireBullet(c.x,c.y,ang,primary);
                AudioSys.shoot(primary, this.x);
            }
        }
        else if(this.t==='commando') {
            if(this.dodgeCool>0) this.dodgeCool--;
            if(this.dodging > 0) this.dodging--;
            let dodge=false;
            if(this.dodgeCool <= 0) {
                for(let i=0;i<Game.bullets.length && !dodge;i++) {
                    let b=Game.bullets[i];
                    if(!b.enemy && !b.dead) {
                        let bdx=b.x-c.x, bdy=b.y-c.y;
                        if(bdx*bdx+bdy*bdy < BALANCE.COMMANDO_DODGE_RADIUS_SQ) {
                            let perp = ang + Math.PI/2 * (Math.random()>0.5?1:-1);
                            vx += Math.cos(perp)*spd*4; vy += Math.sin(perp)*spd*4;
                            dodge=true; this.dodging = 20; this.dodgeCool = 120;
                        }
                    }
                }
            }
            if(!dodge && !this.dodging) {
                this.aiT++;
                if(this.aiT > 100) {
                    vx=0; vy=0;
                    if(this.aiT%5===0 && primary) {
                        this.fireBullet(c.x,c.y,ang+(Math.random()-.5)*0.2,primary);
                        AudioSys.shoot(primary, this.x);
                    }
                    if(this.aiT>120) this.aiT=0;
                } else {
                    vx += Math.cos(ang + Math.sin(this.aiT*0.1))*spd;
                    vy += Math.sin(ang + Math.sin(this.aiT*0.1))*spd;
                }
            }
        }
        else if(this.t==='stalker') {
            let angleOffset = Math.sin(Game.frame * 0.05) * 1.5;
            let approachAngle = ang + angleOffset;
            vx += Math.cos(approachAngle) * spd; vy += Math.sin(approachAngle) * spd;
        }
        else if(this.t==='tank') {
            vx+=Math.cos(ang)*spd; vy+=Math.sin(ang)*spd;
            this.aiT++;
            if(this.aiT>=def.aiCd && dist<350 && primary) {
                this.fireBullet(c.x,c.y,ang,primary);
                AudioSys.shoot(primary, this.x); this.aiT=0;
            }
        }
        else if(this.t==='gunner') {
            if(dist>250){vx+=Math.cos(ang)*spd;vy+=Math.sin(ang)*spd;}
            else if(dist<150){vx+=-Math.cos(ang)*spd;vy+=-Math.sin(ang)*spd;}
            this.aiT++;
            if(this.aiT>120&&dist<400 && primary){
                this.fireBullet(c.x,c.y,ang,primary); this.aiT=0; AudioSys.shoot(primary, this.x);
            }
        }
        else if(this.t==='shotman') {
            if(dist<300){vx+=-Math.cos(ang)*spd;vy+=-Math.sin(ang)*spd;}
            else if(dist>500){vx+=Math.cos(ang)*spd;vy+=Math.sin(ang)*spd;}
            this.aiT++;
            if(this.aiT>=def.aiCd && dist<600 && primary){
                const spread = BALANCE.WEAPONS.shotgun.spreadL1;
                for(let i=0; i<def.pellets; i++) {
                    const offset = def.pellets === 1 ? 0 : (i / (def.pellets - 1) - 0.5) * spread;
                    this.fireBullet(c.x, c.y, ang + offset, primary);
                }
                this.aiT=0; AudioSys.shoot(primary, this.x);
            }
        }
        else if(this.t==='sniper') {
            if(dist < 450) { vx += -Math.cos(ang)*spd; vy += -Math.sin(ang)*spd; }
            else if(dist > 600) { vx += Math.cos(ang)*spd; vy += Math.sin(ang)*spd; }
            else { vx += Math.cos(ang+1.57)*spd*0.5; vy += Math.sin(ang+1.57)*spd*0.5; }
            this.aiT++;
            if(this.aiT > 80) {
                vx=0; vy=0;
                if(this.aiT > 120 && primary) {
                    this.fireBullet(c.x,c.y,ang,primary);
                    AudioSys.shoot(primary, this.x); this.aiT=0;
                }
            }
        }
        else {
            vx+=Math.cos(ang)*spd; vy+=Math.sin(ang)*spd;
        }

        if(this.t==='eye') { this.x+=vx; this.y+=vy; }
        else {
            if(!Game.checkWall({x:this.x+vx,y:this.y,w:this.w,h:this.h}))this.x+=vx;
            if(!Game.checkWall({x:this.x,y:this.y+vy,w:this.w,h:this.h}))this.y+=vy;
        }
    }

    takeDamage(amount, source=null) {
        const result = applyDamage(this, amount);
        if(source) this.lastAttacker = source;
        return result;
    }

    draw(alpha) {
        let dX = lerp(this.lastX, this.x, alpha); let dY = lerp(this.lastY, this.y, alpha);
        if(dX+this.w<Cam.x-W||dX>Cam.x+W*2||dY+this.h<Cam.y-H||dY>Cam.y+H*2) return;
        let spriteId = this.visualId;
        if(this.hitT>0) spriteId += '.hit'; else if(Game.freeze>0) spriteId += '.freeze';
        let yOff = 0; let scale = 1;
        if(this.t==='commando' && this.dodging > 0) { yOff = -10; scale = 1.2; }
        renderVisual('shadow.ground', { x: dX, y: this.t === 'eye' ? dY + this.h + 16 : dY + this.h - 8, width: this.w });
        if(this.t==='mantis' && this.c==='#f00') {
            renderVisual('effect.mantis.rage', {
                spriteId: this.hitT > 0 ? this.visualId : `${this.visualId}.hit`,
                x: dX,
                y: dY,
                width: this.w,
                height: this.h,
            });
        } else {
            renderVisual(spriteId, {
                x: dX - (this.w * (scale - 1) / 2),
                y: dY + yOff,
                width: this.w * scale,
                height: this.h * scale,
            });
        }

        // Shield ring — color matches mob (like bot shield = red)
        if(this.shield > 0) {
            const col = hexToRgbTriplet(this.baseColor || this.c);
            const pulse = 0.6 + Math.sin(Game.frame * 0.2) * 0.2;
            renderVisual('effect.shield.enemy', {
                x: dX + this.w / 2,
                y: dY + this.h / 2 + yOff,
                radius: shieldRingRadius(this.w, this.h),
                rgb: col,
                pulse,
            });
        }

        if(this.hp < this.maxHp * 0.5) {
            const spark = Math.random() > 0.9
                ? { x: (Math.random() - 0.5) * 20, y: (Math.random() - 0.5) * 20 }
                : null;
            renderVisual('effect.damage.smoke', {
                x: dX + this.w / 2,
                y: dY + this.h / 2,
                radius: this.w / 3,
                alpha: 0.3 + Math.sin(Game.frame * 0.2) * 0.2,
                spark,
            });
        }
    }
}
