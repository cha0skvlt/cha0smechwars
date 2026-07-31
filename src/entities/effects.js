import { Cam, W, H } from '../core/runtime.js';
import { lerp } from '../core/lerp.js';
import { Game } from '../game/Game.js';
import { renderVisual } from '../render/PixelRenderer.js';

export class Decal {
    constructor(x,y,c) { this.x=x; this.y=y; this.c=c||'#511'; this.blobs=[]; for(let i=0; i<4; i++) { this.blobs.push({ ox: (Math.random() - 0.5) * 20, oy: (Math.random() - 0.5) * 20, r: 4 + Math.random() * 8 }); } }
    draw(context) { renderVisual('effect.decal', { context, x: this.x, y: this.y, color: this.c, blobs: this.blobs }); }
}
export class Particle {
    constructor(x,y,c,s=1) { this.x=x; this.y=y; this.lastX=x; this.lastY=y; this.c=c; this.vx=(Math.random()-.5)*10*s; this.vy=(Math.random()-.5)*10*s; this.l=20*s; }
    saveState() { this.lastX=this.x; this.lastY=this.y; }
    update() { this.x+=this.vx; this.y+=this.vy; this.l--; this.vx*=0.9; this.vy*=0.9; }
    draw(alpha) { let dX = lerp(this.lastX, this.x, alpha); let dY = lerp(this.lastY, this.y, alpha); if(dX<Cam.x-W||dX>Cam.x+W*2) return; renderVisual('effect.particle', { x: dX, y: dY, size: 4, color: this.c, additive: this.c === '#fa0' }); }
}
export class Debris {
    constructor(x,y,c) { this.x=x; this.y=y; this.lastX=x; this.lastY=y; this.c=c; this.vx=(Math.random()-0.5)*10; this.vy=(Math.random()-0.5)*10; this.r=Math.random()*0.2; this.s=4+Math.random()*4; this.a=0; this.life=60; }
    saveState() { this.lastX=this.x; this.lastY=this.y; }
    update() { this.x+=this.vx; this.y+=this.vy; this.a+=this.r; this.life--; }
    draw(alpha) { let dX = lerp(this.lastX, this.x, alpha); let dY = lerp(this.lastY, this.y, alpha); renderVisual('effect.debris', { x: dX, y: dY, angle: this.a, size: this.s, color: this.c }); }
}
export class WeatherParticle {
    constructor(type) { this.t = type; this.reset(); this.lastX = this.x; this.lastY = this.y; }
    reset() { this.x = Cam.x + Math.random() * W; this.y = Cam.y + Math.random() * H; this.lastX = this.x; this.lastY = this.y; if(this.t === 'forest') { this.c = Math.random()>0.5?'#2d6':'#864'; this.vx = 1+Math.random(); this.vy = 0.5+Math.random(); this.s = 2; } else if(this.t === 'ruins') { this.c = '#889'; this.vx = -2-Math.random()*2; this.vy = 2+Math.random()*2; this.s = 1.5; } else if(this.t === 'dungeon') { this.c = '#f40'; this.vx = (Math.random()-0.5); this.vy = -1-Math.random(); this.s = 2; } }
    saveState() { this.lastX = this.x; this.lastY = this.y; }
    update() { this.x += this.vx; this.y += this.vy; if(this.x < Cam.x - 10 || this.x > Cam.x + W + 10 || this.y < Cam.y - 10 || this.y > Cam.y + H + 10) this.reset(); }
    draw(alpha) { let dX = lerp(this.lastX, this.x, alpha); let dY = lerp(this.lastY, this.y, alpha); renderVisual(`effect.weather.${this.t}`, { x: dX, y: dY, size: this.s, color: this.c }); }
}
export class Shockwave {
    constructor(x,y,r) { this.x=x; this.y=y; this.r=1; this.maxR=(r*0.6) * (0.8 + Math.random()*0.4); this.life=1.0; }
    update() { this.r += 5; if(this.r>this.maxR) this.life-=0.05; }
    draw() { if(this.life<=0) return; renderVisual('effect.shockwave', { x: this.x, y: this.y, radius: this.r, alpha: this.life * 0.3 }); }
}
export class Floater {
    // style: true/'crit' = enemy crit (big white); 'hurt' = damage to player (big red); falsy = normal (small white)
    constructor(x, y, val, style) {
        this.x = x + (Math.random() - 0.5) * 20;
        this.y = y;
        this.lastX = this.x;
        this.lastY = this.y;
        this.val = Math.floor(val);
        this.life = 40;
        this.isCrit = style === true || style === 'crit';
        this.isHurt = style === 'hurt';
        const isBig = this.isCrit || this.isHurt;
        this.vy = isBig ? -2 : -1;
        this.color = this.isHurt ? '#f00' : '#fff';
        this.scale = isBig ? 1.5 : 1.0;
    }
    saveState() { this.lastX = this.x; this.lastY = this.y; }
    update() { this.x += (Math.random() - 0.5) * 0.5; this.y += this.vy; this.life--; this.vy *= 0.9; }
    draw(alpha) {
        if (this.life <= 0) return;
        let dX = lerp(this.lastX, this.x, alpha);
        let dY = lerp(this.lastY, this.y, alpha);
        const pulse = 1 + Math.sin(Game.frame * 0.5) * 0.2;
        const fontSize = this.isCrit || this.isHurt
            ? Math.floor(14 * this.scale * pulse)
            : Math.floor(10 * this.scale);
        renderVisual('effect.floater', {
            x: dX,
            y: dY,
            text: this.val,
            color: this.color,
            fontSize,
            glow: this.isCrit || this.isHurt,
        });
    }
}
