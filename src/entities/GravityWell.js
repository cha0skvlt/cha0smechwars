import { Entity } from './Entity.js';
import { BALANCE } from '../config/balance.js';
import { Game } from '../game/Game.js';
import { Ctx } from '../core/runtime.js';
import { lerp } from '../core/lerp.js';
import { Particle } from './effects.js';

// @meta:GravityWell - Gravity well module that pulls enemies toward center point
export class GravityWell extends Entity {
    constructor(x,y) { super(x,y,10,10); this.life=180; }
    update() {
        this.life--;
        for(let i=0;i<Game.enemies.length;i++) {
             let e=Game.enemies[i];
             if(!['mantis','fortress','eye'].includes(e.t)) {
                 let dx = this.x - e.x; let dy = this.y - e.y;
                 let distSq = dx*dx + dy*dy;
                 if(distSq < BALANCE.GRAV_WELL_RADIUS_SQ && distSq > 100) {
                     // Normalize using fast inverse sqrt approximation for better performance
                     let invDist = 1 / Math.sqrt(distSq);
                     e.x += dx * invDist * 4; e.y += dy * invDist * 4;
                 }
             }
        }
        if(Game.frame%5===0) Game.parts.push(new Particle(this.x,this.y,'#000',2));
    }
    draw(alpha) {
        let dX = lerp(this.lastX, this.x, alpha); let dY = lerp(this.lastY, this.y, alpha);
        Ctx.save();

        // Gravity well pull radius visualization (400px radius)
        let radius = 400;
        let pulse = Math.sin(Game.frame * 0.1) * 0.2 + 0.8;
        Ctx.strokeStyle = `rgba(240, 0, 255, ${0.3 * pulse})`;
        Ctx.lineWidth = 2;
        Ctx.beginPath();
        Ctx.arc(dX, dY, radius * pulse, 0, Math.PI * 2);
        Ctx.stroke();

        // Inner circle for depth effect
        Ctx.strokeStyle = `rgba(240, 0, 255, ${0.5 * pulse})`;
        Ctx.lineWidth = 1;
        Ctx.beginPath();
        Ctx.arc(dX, dY, radius * 0.5 * pulse, 0, Math.PI * 2);
        Ctx.stroke();

        // Central point with random size variation
        Ctx.fillStyle="#000";
        Ctx.strokeStyle="#f0f";
        Ctx.lineWidth=2;
        Ctx.beginPath();
        Ctx.arc(dX, dY, 5 + Math.random()*5, 0, Math.PI*2);
        Ctx.fill();
        Ctx.stroke();

        Ctx.restore();
    }
}
