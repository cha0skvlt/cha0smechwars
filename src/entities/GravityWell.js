import { Entity } from './Entity.js';
import { BALANCE } from '../config/balance.js';
import { Game } from '../game/Game.js';
import { lerp } from '../core/lerp.js';
import { Particle } from './effects.js';
import { isHostile } from '../combat/damage.js';
import { renderVisual } from '../render/PixelRenderer.js';

// @meta:GravityWell - Gravity well module that pulls enemies toward center point
export class GravityWell extends Entity {
    constructor(x,y, owner=null) {
        super(x,y,10,10);
        this.life=BALANCE.GRAV_WELL.life;
        this.owner=owner;
        this.faction=owner?.faction || 'player';
    }
    update() {
        this.life--;
        const pull = BALANCE.GRAV_WELL.pullForce;
        const deadzoneSq = BALANCE.GRAV_WELL.deadzoneSq;
        const targets = Game.getDamageableTargets().filter(target => isHostile(this, target));
        for(let i=0;i<targets.length;i++) {
             let e=targets[i];
             if(!['mantis','fortress','eye'].includes(e.t)) {
                 let dx = this.x - e.x; let dy = this.y - e.y;
                 let distSq = dx*dx + dy*dy;
                 if(distSq < BALANCE.GRAV_WELL_RADIUS_SQ && distSq > deadzoneSq) {
                     let invDist = 1 / Math.sqrt(distSq);
                     e.x += dx * invDist * pull; e.y += dy * invDist * pull;
                 }
             }
        }
        if(Game.frame%5===0) Game.parts.push(new Particle(this.x,this.y,'#000',2));
    }
    draw(alpha) {
        let dX = lerp(this.lastX, this.x, alpha); let dY = lerp(this.lastY, this.y, alpha);
        renderVisual('module.gravity.well', {
            x: dX,
            y: dY,
            radius: 400,
            pulse: Math.sin(Game.frame * 0.1) * 0.2 + 0.8,
            coreRadius: 5 + Math.random() * 5,
        });
    }
}
