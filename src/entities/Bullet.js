import { Entity } from './Entity.js';
import { Cam, Ctx, W, H } from '../core/runtime.js';
import { lerp } from '../core/lerp.js';
import { Game } from '../game/Game.js';
import { Particle } from './effects.js';

// @meta:Bullet - Projectile entity with weapon-specific properties and collision
export class Bullet extends Entity {
    constructor(x,y,ang,w,e,lvl=1) {
        super(x,y,6,6);
        this.vx=Math.cos(ang);
        this.vy=Math.sin(ang);
        this.wep=w;
        this.enemy=e;
        this.lvl=lvl;

        // Unified damage scaling: base + (level - 1)
        if(w==='rpg') {
            this.dmg = 9 + lvl; // Base 10, adjusted to 9+lvl to maintain balance
        } else if(w==='laser') {
            this.dmg = 4 + lvl; // Base 5, adjusted to 4+lvl to maintain balance
        } else {
            this.dmg = lvl; // Pistol/Shotgun/MG: base 1, so lvl
        }

        // Speed and size
        let s=15;
        if(w==='rpg') {
            s=8;
            this.w=8;
            this.h=8;
        } else if(w==='laser') {
            s=30;
            // Level 3+ laser: increased width
            this.w = lvl >= 3 ? 45 : 30;
            this.h = lvl >= 3 ? 3 : 2;
        }

        // Level 3+ MG: 1.5x bullet speed
        if(w==='mg' && lvl >= 3) {
            s *= 1.5;
        }

        if(e) s*=0.6;
        this.vx*=s;
        this.vy*=s;
        this.life=100;
        this.bot = false;
        this.laserHits = [];
    }
    update() {
        let spd = 1.0;
        if((this.enemy || this.bot) && Game.timeScale < 1.0) spd = Game.timeScale;

        this.x+=this.vx * spd; this.y+=this.vy * spd;

        this.life--;
        if(this.wep==='rpg'&&Game.frame%4===0) Game.parts.push(new Particle(this.x,this.y,'#888'));

        // Level 3+ Shotgun: explosive rounds on hit (enemy or wall)
        if(this.wep==='shotgun' && this.lvl >= 3 && (this.life<=0 || Game.checkWall(this))) {
            this.dead=true;
            const explosionX = this.x + this.w/2;
            const explosionY = this.y + this.h/2;
            const splashRadius = 30; // Explosion radius for shotgun pellets
            Game.explode(explosionX, explosionY, splashRadius, !this.enemy && !this.bot, false, false, this.bot, this.enemy ? null : (this.bot ? Game.bot : Game.player), this);
        }
        // RPG detonates on walls or when life expires
        else if(this.wep==='rpg' && (this.life<=0 || Game.checkWall(this))) {
            this.dead=true;
            // RPG explosion with splash damage (no fragments)
            const explosionX = this.x + this.w/2;
            const explosionY = this.y + this.h/2;
            // Level 3+ RPG: 1.5x splash radius
            const splashRadius = this.lvl >= 3 ? 120 : 80;
            Game.explode(explosionX, explosionY, splashRadius, !this.enemy && !this.bot, false, false, this.bot, this.enemy ? null : (this.bot ? Game.bot : Game.player), this);
        } else if(this.life<=0) {
            this.dead=true;
        } }
    draw(alpha) { let dX = lerp(this.lastX, this.x, alpha); let dY = lerp(this.lastY, this.y, alpha); if(dX<Cam.x-W||dX>Cam.x+W*2) return; Ctx.save(); let c = this.enemy ? '#f00' : (this.bot ? '#f00' : (this.wep==='rpg'?'#ff0':'#ff0')); if(this.wep==='laser') { Ctx.globalCompositeOperation='lighter'; Ctx.shadowBlur=0; Ctx.fillStyle=c; Ctx.translate(dX,dY); Ctx.rotate(Math.atan2(this.vy,this.vx)); Ctx.fillRect(0,0,this.w,this.h); Ctx.fillStyle='#fff'; Ctx.fillRect(0,1,this.w,this.h/2); } else { Ctx.fillStyle=c; Ctx.fillRect(dX,dY,this.w,this.h); } Ctx.restore(); }
}
