import { Entity } from './Entity.js';
import { Cam, W, H } from '../core/runtime.js';
import { lerp } from '../core/lerp.js';
import { Game } from '../game/Game.js';
import { Particle } from './effects.js';
import { AudioSys } from '../audio/audio.js';
import { Logger } from '../core/Logger.js';
import { BALANCE } from '../config/balance.js';
import { weaponDamage } from '../combat/damage.js';
import { renderVisual } from '../render/PixelRenderer.js';

// @meta:Bullet - Projectile entity; damage = WEAPONS[wep].damage * level (DU)
export class Bullet extends Entity {
    constructor(x,y,ang,w,e,lvl=1,source=null) {
        const cfg = BALANCE.WEAPONS[w] || BALANCE.WEAPONS.pistol;
        super(x, y, cfg.size || 6, cfg.sizeH || 6);
        this.vx=Math.cos(ang);
        this.vy=Math.sin(ang);
        this.wep=w;
        this.enemy=source?.faction === 'enemy' || !!e;
        this.lvl=lvl;
        this.source=source;
        this.faction=source?.faction || (e ? 'enemy' : 'player');
        this.airborne = false;

        this.dmg = weaponDamage(w, lvl);

        let s = cfg.speed;
        if(w === 'rpg') {
            this.w = cfg.size;
            this.h = cfg.sizeH;
        } else if(w === 'laser') {
            this.w = lvl >= 3 ? cfg.sizeL3 : cfg.size;
            this.h = lvl >= 3 ? cfg.sizeHL3 : cfg.sizeH;
        }

        if(w === 'mg' && lvl >= 3 && cfg.speedMultL3) {
            s *= cfg.speedMultL3;
        }

        // Same weapon physics for all shooters (no enemy speed mercy)
        this.vx *= s;
        this.vy *= s;
        this.life = BALANCE.BULLET_LIFE;
        this.bot = this.faction === 'rival';
        this.laserHits = [];
    }

    splashRadius() {
        const splash = BALANCE.WEAPONS.rpg.splash;
        return this.lvl >= 3 ? splash.rL3 : splash.rBase;
    }

    // Grounded impact vs map obstacles — mirrors entity-hit feedback
    onObstacleHit() {
        if(this.dead) return;
        this.dead = true;
        const explosionX = this.x + this.w/2;
        const explosionY = this.y + this.h/2;
        Logger.debug('combat', 'obstacle_hit', this.wep, { wep: this.wep, x: +explosionX.toFixed(0), y: +explosionY.toFixed(0), airborne: !!this.airborne });
        const source = this.source;

        if(this.wep === 'rpg') {
            Game.explode(explosionX, explosionY, this.splashRadius(), this.faction === 'player', false, false, this.bot, source, this);
            return;
        }
        if(this.wep === 'shotgun' && this.lvl >= 3) {
            const r = BALANCE.WEAPONS.shotgun.explodeRadiusL3;
            Game.explode(explosionX, explosionY, r, this.faction === 'player', false, false, this.bot, source, this);
            return;
        }
        for(let i = 0; i < 3; i++) {
            Game.parts.push(new Particle(explosionX, explosionY, this.wep === 'laser' ? '#f0f' : '#fa0', 1.5));
        }
        AudioSys.obstacleHit(explosionX, explosionY);
    }

    onExpire() {
        if(this.dead) return;
        this.dead = true;
        if(this.wep === 'rpg') {
            Game.explode(this.x + this.w/2, this.y + this.h/2, this.splashRadius(), !this.enemy && !this.bot, false, false, this.bot, this.source, this);
        } else if(this.wep === 'shotgun' && this.lvl >= 3) {
            const r = BALANCE.WEAPONS.shotgun.explodeRadiusL3;
            Game.explode(this.x + this.w/2, this.y + this.h/2, r, !this.enemy && !this.bot, false, false, this.bot, this.source, this);
        }
    }

    update() {
        let spd = 1.0;
        if(this.faction !== 'player' && Game.timeScale < 1.0) spd = Game.timeScale;

        const dx = this.vx * spd;
        const dy = this.vy * spd;
        const dist = Math.hypot(dx, dy);
        const stepMax = 8;
        const steps = dist > stepMax ? Math.ceil(dist / stepMax) : 1;
        const sx = dx / steps;
        const sy = dy / steps;

        for(let i = 0; i < steps; i++) {
            this.x += sx;
            this.y += sy;
            if(!this.airborne && Game.checkWall(this)) {
                this.onObstacleHit();
                return;
            }
        }

        this.life--;
        if(this.wep==='rpg'&&Game.frame%4===0) Game.parts.push(new Particle(this.x,this.y,'#888'));

        if(this.life <= 0) this.onExpire();
    }

    draw(alpha) {
        let dX = lerp(this.lastX, this.x, alpha);
        let dY = lerp(this.lastY, this.y, alpha);
        if(dX<Cam.x-W||dX>Cam.x+W*2) return;
        let c = this.enemy ? '#f00' : (this.bot ? '#f00' : (this.wep==='rpg'?'#ff0':'#ff0'));
        if(this.wep==='laser') {
            renderVisual('projectile.laser', {
                x: dX,
                y: dY,
                width: this.w,
                height: this.h,
                color: c,
                angle: Math.atan2(this.vy, this.vx),
            });
        } else {
            renderVisual('projectile.bullet', { x: dX, y: dY, width: this.w, height: this.h, color: c });
        }
    }
}
