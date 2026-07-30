import { Entity } from './Entity.js';
import { BALANCE } from '../config/balance.js';
import { Cam, Ctx, W, H } from '../core/runtime.js';
import { AudioSys } from '../audio/audio.js';
import { Cache, ShadowCv } from '../render/bake.js';
import { Sprites } from '../render/sprites.js';
import { lerp } from '../core/lerp.js';
import { Game } from '../game/Game.js';
import { Bullet } from './Bullet.js';
import { Turret } from './Turret.js';
import { Particle } from './effects.js';

// @meta:Enemy - Enemy entity with AI behavior, types, and difficulty scaling
export class Enemy extends Entity {
    constructor(type) {
        super(0,0,32,32); this.t=type; this.aiT=0; this.hitT=0; this.dodgeCool=0; this.dodging=false; this.blood='#a00'; this.dead=false; this.lastAttacker = null;
        let safe=false; let attempts=0; while(!safe && attempts<100){ attempts++; let a=Math.random()*6.28,d=500+Math.random()*400; this.x=Game.player.x+Math.cos(a)*d; this.y=Game.player.y+Math.sin(a)*d; if(this.x>50&&this.x<2950&&this.y>50&&this.y<2950) { safe = !Game.checkWall({x:this.x,y:this.y,w:this.w,h:this.h}); } }
        if(!safe) { this.x=1500+Math.random()*200-100; this.y=1500+Math.random()*200-100; }
        this.lastX=this.x; this.lastY=this.y;
        let hpMult = Game.getDifficultyMultiplier();
        if(type==='zombie'){this.hp=2;this.spd=2;this.c='#5b5';this.spr=Sprites.zombie;this.sc=10;} else if(type==='gunner'){this.hp=3*hpMult;this.spd=1.5;this.c='#eb2';this.spr=Sprites.gunner;this.sc=30;this.blood='oil';} else if(type==='rocketman'){this.hp=4*hpMult;this.spd=2;this.c='#f60';this.spr=Sprites.rocketman;this.sc=30;this.blood='oil';} else if(type==='tank'){this.hp=25*hpMult;this.spd=1;this.w=48;this.h=48;this.c='#684';this.spr=Sprites.tank;this.sc=150;this.blood='oil';} else if(type==='commando'){this.hp=6*hpMult;this.spd=2.8;this.c='#222';this.spr=Sprites.soldier;this.sc=50;this.blood='oil';} else if(type==='stalker'){this.hp=2*hpMult;this.spd=5.0;this.c='#d44';this.spr=Sprites.soldier;this.sc=50;} else if(type==='sniper'){this.hp=1;this.spd=3;this.c='#fff';this.spr=Sprites.sniper;this.sc=80;} else if(type==='mantis'){this.hp=200*hpMult;this.spd=5.5;this.w=48;this.h=48;this.c='#5f5';this.spr=Sprites.mantis;this.sc=5000;} else if(type==='fortress'){this.hp=400*hpMult;this.spd=0.5;this.w=64;this.h=64;this.c='#889';this.spr=Sprites.fortress;this.sc=5000;this.blood='oil';} else if(type==='eye'){this.hp=180*hpMult;this.spd=4;this.w=48;this.h=48;this.c='#a0f';this.spr=Sprites.eye;this.sc=5000;this.blood='#000';}
        this.maxHp = this.hp;
    }
    update() {
        if(Game.freeze>0 || !Game.player) return; const p=Game.player.center(), c=this.center();

        // TARGET LOGIC: Include Turrets - optimized with squared distances
        let target = Game.player;
        const dx = p.x-c.x, dy = p.y-c.y;
        let distSq = dx*dx + dy*dy;
        let dist = Math.sqrt(distSq);

        // Check for friendlies (Turrets) - use squared distances for comparison
        let closestF = null; let minFSq = distSq;
        const turretRangeSq = BALANCE.TURRET_RANGE_SQ;
        for(let i=0; i<Game.friendlies.length; i++) {
            let f = Game.friendlies[i];
            if(f instanceof Turret && f.hp > 0) {
                const dx = f.x - c.x, dy = f.y - c.y;
                const dSq = dx*dx + dy*dy;
                if(dSq < minFSq) { minFSq = dSq; closestF = f; }
            }
        }
        if(closestF && minFSq < turretRangeSq) {
            target = closestF;
            distSq = minFSq;
            dist = Math.sqrt(minFSq);
        }

        if(Game.bot && Game.bot.hp > 0 && !Game.bot.flying) {
            const dx = Game.bot.x-c.x, dy = Game.bot.y-c.y;
            const distBotSq = dx*dx + dy*dy;
            if(distBotSq < distSq) {
                target = Game.bot;
                distSq = distBotSq;
                dist = Math.sqrt(distBotSq);
            }
        }

        const ang=Math.atan2(target.y-c.y, target.x-c.x);
        let spd=this.spd; if(this.hitT>0){spd*=0.5;this.hitT--;} let vx=0, vy=0;

        // TIME WARP EFFECT
        if(Game.timeScale < 1.0) spd *= Game.timeScale;

        // Enemy separation - optimized with inverse sqrt
        for(let i=0; i<Game.enemies.length; i++) {
            let e = Game.enemies[i];
            if(e !== this && !e.dead) {
                let dx = this.x - e.x, dy = this.y - e.y;
                let dSq = dx*dx + dy*dy;
                if(dSq < BALANCE.ENEMY_SEPARATION_SQ && dSq > 0) {
                    let invD = 1 / Math.sqrt(dSq);
                    vx += dx * invD * 1.5;
                    vy += dy * invD * 1.5;
                }
            }
        }
        if(this.t==='mantis') { this.aiT++; let rage = (this.hp < 200 * Game.getDifficultyMultiplier() * 0.5); let currentSpd = rage ? spd * 1.5 : spd; if(rage && Game.frame % 10 < 5) this.c = '#f00'; else if(rage) this.c = '#fff'; else this.c = '#5f5'; if(this.aiT < 60) { vx += Math.cos(ang)*currentSpd; vy += Math.sin(ang)*currentSpd; } else if(this.aiT < (rage ? 75 : 90)) { vx=0; vy=0; } else { let step = rage ? 0.15 : 0.25; for(let i=-0.5; i<=0.5; i+=step) Game.bullets.push(new Bullet(c.x,c.y,ang+i,'shotgun',true)); AudioSys.shoot('shotgun', this.x); this.aiT=0; } }
        else if(this.t==='fortress') { this.aiT++; vx += Math.cos(ang)*spd; vy += Math.sin(ang)*spd; if(this.aiT%10===0) { Game.bullets.push(new Bullet(c.x,c.y,ang+(Math.random()-.2)*.4,'mg',true)); AudioSys.shoot('mg', this.x); } if(this.aiT%120===0) { Game.bullets.push(new Bullet(c.x,c.y,ang,'rpg',true)); AudioSys.shoot('rpg', this.x); } }
        else if(this.t==='eye') { this.aiT++; let dT = 250; if(dist < dT) { vx -= Math.cos(ang)*spd; vy -= Math.sin(ang)*spd; } else { vx += Math.cos(ang)*spd; vy += Math.sin(ang)*spd; } vx += Math.cos(this.aiT*0.05)*2; vy += Math.sin(this.aiT*0.05)*2; if(this.aiT%60===0) { Game.bullets.push(new Bullet(c.x,c.y,ang,'laser',true)); AudioSys.shoot('laser', this.x); } }
        else if(this.t==='commando') { if(this.dodgeCool>0) this.dodgeCool--; if(this.dodging > 0) this.dodging--; let dodge=false; if(this.dodgeCool <= 0) { for(let i=0;i<Game.bullets.length && !dodge;i++) { let b=Game.bullets[i]; if(!b.enemy && !b.dead) { let dx=b.x-c.x, dy=b.y-c.y; if(dx*dx+dy*dy < BALANCE.COMMANDO_DODGE_RADIUS_SQ) { let perp = ang + Math.PI/2 * (Math.random()>0.5?1:-1); vx += Math.cos(perp)*spd*4; vy += Math.sin(perp)*spd*4; dodge=true; this.dodging = 20; this.dodgeCool = 120; } } } } if(!dodge && !this.dodging) { this.aiT++; if(this.aiT > 100) { vx=0; vy=0; if(this.aiT%5===0) { Game.bullets.push(new Bullet(c.x,c.y,ang+(Math.random()-.5)*0.2,'mg',true)); AudioSys.shoot('mg', this.x); } if(this.aiT>120) this.aiT=0; } else { vx += Math.cos(ang + Math.sin(this.aiT*0.1))*spd; vy += Math.sin(ang + Math.sin(this.aiT*0.1))*spd; } } }
        else if(this.t==='stalker') { let angleOffset = Math.sin(Game.frame * 0.05) * 1.5; let approachAngle = ang + angleOffset; vx += Math.cos(approachAngle) * spd; vy += Math.sin(approachAngle) * spd; }
        else if(this.t==='tank') { vx+=Math.cos(ang)*spd; vy+=Math.sin(ang)*spd; this.aiT++; if(this.aiT>150 && dist<350) { for(let i=-.3;i<=.3;i+=.15)Game.bullets.push(new Bullet(c.x,c.y,ang+i,'shotgun',true)); AudioSys.shoot('shotgun', this.x); this.aiT=0; } }
        else if(this.t==='gunner') { if(dist>250){vx+=Math.cos(ang)*spd;vy+=Math.sin(ang)*spd;}else if(dist<150){vx+=-Math.cos(ang)*spd;vy+=-Math.sin(ang)*spd;} this.aiT++; if(this.aiT>120&&dist<400){Game.bullets.push(new Bullet(c.x,c.y,ang,'pistol',true));this.aiT=0;AudioSys.shoot('pistol', this.x);} }
        else if(this.t==='rocketman') { if(dist<300){vx+=-Math.cos(ang)*spd;vy+=-Math.sin(ang)*spd;}else if(dist>500){vx+=Math.cos(ang)*spd;vy+=Math.sin(ang)*spd;} this.aiT++; if(this.aiT>180 && dist<600){ let perp = ang + Math.PI/2; Game.bullets.push(new Bullet(c.x + Math.cos(perp)*10, c.y + Math.sin(perp)*10, ang, 'rpg', true)); Game.bullets.push(new Bullet(c.x - Math.cos(perp)*10, c.y - Math.sin(perp)*10, ang, 'rpg', true)); this.aiT=0; AudioSys.shoot('rpg', this.x); } }
        else if(this.t==='sniper') { if(dist < 450) { vx += -Math.cos(ang)*spd; vy += -Math.sin(ang)*spd; } else if(dist > 600) { vx += Math.cos(ang)*spd; vy += Math.sin(ang)*spd; } else { vx += Math.cos(ang+1.57)*spd*0.5; vy += Math.sin(ang+1.57)*spd*0.5; } this.aiT++; if(this.aiT > 80) { vx=0; vy=0; if(this.aiT > 120) { Game.bullets.push(new Bullet(c.x,c.y,ang,'laser',true)); AudioSys.shoot('laser', this.x); this.aiT=0; } } }
        else {vx+=Math.cos(ang)*spd;vy+=Math.sin(ang)*spd;}
        if(this.t==='eye') { this.x+=vx; this.y+=vy; } else { if(!Game.checkWall({x:this.x+vx,y:this.y,w:this.w,h:this.h}))this.x+=vx; if(!Game.checkWall({x:this.x,y:this.y+vy,w:this.w,h:this.h}))this.y+=vy; }
    }
    draw(alpha) {
        let dX = lerp(this.lastX, this.x, alpha); let dY = lerp(this.lastY, this.y, alpha);
        if(dX+this.w<Cam.x-W||dX>Cam.x+W*2||dY+this.h<Cam.y-H||dY>Cam.y+H*2) return;
        let k=this.t; if(this.hitT>0) k+='_w'; else if(Game.freeze>0) k+='_b';
        let yOff = 0; let scale = 1; if(this.t==='commando' && this.dodging > 0) { yOff = -10; scale = 1.2; }
        if(this.t==='mantis' && this.c==='#f00') k+='_w';
        if(this.t!=='eye') Ctx.drawImage(ShadowCv, dX, dY+this.h-8, this.w, 16); else Ctx.drawImage(ShadowCv, dX, dY+this.h+16, this.w, 16);
        if(this.t==='mantis' && this.c==='#f00') { Ctx.save(); Ctx.globalCompositeOperation = 'source-atop'; Ctx.fillStyle = '#f00'; Ctx.drawImage(Cache[k]||Cache['mantis'], dX, dY, this.w, this.h); Ctx.globalCompositeOperation = 'lighter'; Ctx.fillStyle = 'rgba(255,0,0,0.5)'; Ctx.fillRect(dX, dY, this.w, this.h); Ctx.restore(); }
        else { Ctx.drawImage(Cache[k]||Cache['zombie'], dX - (this.w*(scale-1)/2), dY + yOff, this.w*scale, this.h*scale); }
        if(this.hp < this.maxHp * 0.5) {
            Ctx.save(); Ctx.translate(dX+this.w/2, dY+this.h/2);
            Ctx.fillStyle = `rgba(0,0,0,${0.3 + Math.sin(Game.frame*0.2)*0.2})`; Ctx.beginPath(); Ctx.arc(0,0,this.w/3,0,Math.PI*2); Ctx.fill();
            if(Math.random()>0.9) { Ctx.fillStyle='#fff'; Ctx.fillRect((Math.random()-0.5)*20,(Math.random()-0.5)*20,2,2); }
            Ctx.restore();
        }
    }
}