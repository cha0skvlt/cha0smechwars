import { Cam, Ctx, W, H } from '../core/runtime.js';
import { lerp } from '../core/lerp.js';
import { Game } from '../game/Game.js';

export class Decal {
    constructor(x,y,c) { this.x=x; this.y=y; this.c=c||'#511'; this.blobs=[]; for(let i=0; i<4; i++) { this.blobs.push({ ox: (Math.random() - 0.5) * 20, oy: (Math.random() - 0.5) * 20, r: 4 + Math.random() * 8 }); } }
    draw(ctx) { ctx.fillStyle=this.c; this.blobs.forEach(b=>{ ctx.beginPath(); ctx.arc(this.x+b.ox, this.y+b.oy, b.r, 0, Math.PI*2); ctx.fill(); }); }
}
export class Particle {
    constructor(x,y,c,s=1) { this.x=x; this.y=y; this.lastX=x; this.lastY=y; this.c=c; this.vx=(Math.random()-.5)*10*s; this.vy=(Math.random()-.5)*10*s; this.l=20*s; }
    saveState() { this.lastX=this.x; this.lastY=this.y; }
    update() { this.x+=this.vx; this.y+=this.vy; this.l--; this.vx*=0.9; this.vy*=0.9; }
    draw(alpha) { let dX = lerp(this.lastX, this.x, alpha); let dY = lerp(this.lastY, this.y, alpha); if(dX<Cam.x-W||dX>Cam.x+W*2) return; Ctx.save(); if(this.c==='#fa0') Ctx.globalCompositeOperation='lighter'; Ctx.fillStyle=this.c; Ctx.fillRect(dX,dY,4,4); Ctx.restore(); }
}
export class Debris {
    constructor(x,y,c) { this.x=x; this.y=y; this.lastX=x; this.lastY=y; this.c=c; this.vx=(Math.random()-0.5)*10; this.vy=(Math.random()-0.5)*10; this.r=Math.random()*0.2; this.s=4+Math.random()*4; this.a=0; this.life=60; }
    saveState() { this.lastX=this.x; this.lastY=this.y; }
    update() { this.x+=this.vx; this.y+=this.vy; this.a+=this.r; this.life--; }
    draw(alpha) { let dX = lerp(this.lastX, this.x, alpha); let dY = lerp(this.lastY, this.y, alpha); Ctx.save(); Ctx.translate(dX,dY); Ctx.rotate(this.a); Ctx.fillStyle=this.c; Ctx.fillRect(-this.s/2,-this.s/2,this.s,this.s); Ctx.restore(); }
}
export class WeatherParticle {
    constructor(type) { this.t = type; this.reset(); this.lastX = this.x; this.lastY = this.y; }
    reset() { this.x = Cam.x + Math.random() * W; this.y = Cam.y + Math.random() * H; this.lastX = this.x; this.lastY = this.y; if(this.t === 'forest') { this.c = Math.random()>0.5?'#2d6':'#864'; this.vx = 1+Math.random(); this.vy = 0.5+Math.random(); this.s = 2; } else if(this.t === 'ruins') { this.c = '#889'; this.vx = -2-Math.random()*2; this.vy = 2+Math.random()*2; this.s = 1.5; } else if(this.t === 'dungeon') { this.c = '#f40'; this.vx = (Math.random()-0.5); this.vy = -1-Math.random(); this.s = 2; } }
    saveState() { this.lastX = this.x; this.lastY = this.y; }
    update() { this.x += this.vx; this.y += this.vy; if(this.x < Cam.x - 10 || this.x > Cam.x + W + 10 || this.y < Cam.y - 10 || this.y > Cam.y + H + 10) this.reset(); }
    draw(alpha) { let dX = lerp(this.lastX, this.x, alpha); let dY = lerp(this.lastY, this.y, alpha); Ctx.fillStyle=this.c; Ctx.fillRect(dX, dY, this.s, this.s); }
}
export class Shockwave {
    constructor(x,y,r) { this.x=x; this.y=y; this.r=1; this.maxR=(r*0.6) * (0.8 + Math.random()*0.4); this.life=1.0; }
    update() { this.r += 5; if(this.r>this.maxR) this.life-=0.05; }
    draw() { if(this.life<=0) return; Ctx.save(); Ctx.beginPath(); Ctx.arc(this.x,this.y,this.r,0,Math.PI*2); Ctx.strokeStyle=`rgba(255,255,255,${this.life*0.3})`; Ctx.lineWidth=2; Ctx.stroke(); Ctx.restore(); }
}
export class Floater {
    constructor(x, y, val, isCrit) { this.x = x + (Math.random() - 0.5) * 20; this.y = y; this.lastX = this.x; this.lastY = this.y; this.val = Math.floor(val); this.life = 40; this.isCrit = isCrit; this.vy = isCrit ? -2 : -1; this.color = isCrit ? '#f00' : '#fff'; this.scale = isCrit ? 1.5 : 1.0; }
    saveState() { this.lastX = this.x; this.lastY = this.y; }
    update() { this.x += (Math.random() - 0.5) * 0.5; this.y += this.vy; this.life--; this.vy *= 0.9; }
    draw(alpha) { if (this.life <= 0) return; let dX = lerp(this.lastX, this.x, alpha); let dY = lerp(this.lastY, this.y, alpha); Ctx.save();
        if(this.isCrit) {
            // Critical hit glow effect
            Ctx.shadowBlur = 10;
            Ctx.shadowColor = '#f00';
            let pulse = 1 + Math.sin(Game.frame * 0.5) * 0.2;
            Ctx.font = `${Math.floor(14 * this.scale * pulse)}px "Press Start 2P"`;
        } else {
            Ctx.font = `${Math.floor(10 * this.scale)}px "Press Start 2P"`;
        }
        Ctx.fillStyle = this.color; Ctx.shadowColor = '#000'; Ctx.shadowBlur = 0; Ctx.fillText(this.val, dX, dY); Ctx.restore(); }
}
