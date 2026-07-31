import { Entity } from './Entity.js';
import { BALANCE } from '../config/balance.js';
import { Game } from '../game/Game.js';
import { Bullet } from './Bullet.js';
import { lerp } from '../core/lerp.js';
import { AudioSys } from '../audio/audio.js';
import { applyDamage, isHostile } from '../combat/damage.js';
import { renderVisual } from '../render/PixelRenderer.js';

// @meta:Turret - Stationary turret that auto-targets and shoots enemies
export class Turret extends Entity {
    constructor(x,y, owner=null) {
        const t = BALANCE.TURRET;
        super(x, y, t.size, t.size);
        this.owner = owner;
        this.faction = owner?.faction || 'player';
        this.hp = t.hp;
        this.cd = 0;
        // Only the human player's turret grants score/XP
        this.grantsPlayerKillCredit = !!(owner && owner.isHumanPlayer);
    }
    update() {
        if(this.hp<=0) return;
        if(this.cd>0) this.cd--;
        if(this.cd<=0) {
             let closest=null; let minDSq=BALANCE.TURRET_RANGE_SQ;
             const targets = Game.getDamageableTargets();
             for(let i=0, len=targets.length; i<len; i++) {
                 let e=targets[i];
                 if(!isHostile(this, e)) continue;
                 if(!e.dead) {
                     let dx=e.x-this.x, dy=e.y-this.y;
                     let dSq=dx*dx+dy*dy;
                     if(dSq<minDSq) { minDSq=dSq; closest=e; }
                 }
             }
             if(closest) {
                 const ang = Math.atan2(closest.y-this.y, closest.x-this.x);
                 const t = BALANCE.TURRET;
                 const b = new Bullet(this.x+8, this.y+8, ang, t.weapon, false, t.weaponLevel, this);
                 b.airborne = false;
                 Game.bullets.push(b);
                 AudioSys.shoot(t.weapon, this.x);
                 this.cd = t.fireCd;
             }
        }
    }
    takeDamage(amount, source=null) {
        this.lastAttacker = source;
        return applyDamage(this, amount);
    }
    draw(alpha) {
         let dX = lerp(this.lastX, this.x, alpha); let dY = lerp(this.lastY, this.y, alpha);

         if(this.cd > BALANCE.TURRET.fireCd - 3) {
             renderVisual('effect.turret.flash', { x: dX, y: dY });
         }

         renderVisual('sprite.module.turret', { x: dX, y: dY, width: this.w, height: this.h });
    }
}
