import { Entity } from './Entity.js';
import { BALANCE } from '../config/balance.js';
import { Game } from '../game/Game.js';
import { Bullet } from './Bullet.js';
import { Ctx } from '../core/runtime.js';
import { Cache } from '../render/bake.js';
import { lerp } from '../core/lerp.js';
import { AudioSys } from '../audio/audio.js';

// @meta:Turret - Stationary turret that auto-targets and shoots enemies
export class Turret extends Entity {
    constructor(x,y) { super(x,y,16,16); this.hp=10; this.cd=0; }
    update() {
        if(this.hp<=0) return;
        if(this.cd>0) this.cd--;
        if(this.cd<=0) {
             // Optimized turret targeting - use balance constant and cache length
             let closest=null; let minDSq=BALANCE.TURRET_RANGE_SQ;
             for(let i=0, len=Game.enemies.length; i<len; i++) {
                 let e=Game.enemies[i];
                 if(!e.dead) {
                     let dx=e.x-this.x, dy=e.y-this.y;
                     let dSq=dx*dx+dy*dy;
                     if(dSq<minDSq) { minDSq=dSq; closest=e; }
                 }
             }
             if(closest) {
                 const ang = Math.atan2(closest.y-this.y, closest.x-this.x);
                 Game.bullets.push(new Bullet(this.x+8, this.y+8, ang, 'mg', false, 1));
                 AudioSys.shoot('mg', this.x);
                 this.cd=10;
             }
        }
    }
    draw(alpha) {
         let dX = lerp(this.lastX, this.x, alpha); let dY = lerp(this.lastY, this.y, alpha);

         // Muzzle flash when turret fires
         if(this.cd > 7) {
             Ctx.save();
             Ctx.globalCompositeOperation = 'lighter';
             Ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
             Ctx.fillRect(dX-2, dY-2, 20, 20);
             Ctx.restore();
         }

         Ctx.drawImage(Cache['turret'], dX, dY, 16, 16);
    }
}