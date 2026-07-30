import { Entity } from './Entity.js';
import { Cam, Ctx, W, H } from '../core/runtime.js';
import { Cache } from '../render/bake.js';

export class Obstacle extends Entity {
    constructor(x,y,type,biome) { super(x,y,32,32); this.t=type; this.b=biome; if(biome==='forest'&&type==='house'){this.w=80;this.h=60;} if(biome==='ruins'){this.w=64;this.h=64;} if(biome==='dungeon'){this.w=64;this.h=64;} if(type==='water'){this.w=64;this.h=64;} }
    draw(alpha) {
        const dX = this.x; const dY = this.y;
        if(dX+this.w<Cam.x-W||dX>Cam.x+W*2||dY+this.h<Cam.y-H||dY>Cam.y+H*2) return;
        if(this.t==='tree') { Ctx.drawImage(Cache['tree'], dX, dY, 32, 32); Ctx.fillStyle="#432"; Ctx.fillRect(dX+12,dY+28,8,8); }
        else if(this.b==='forest' && this.t==='house') { Ctx.fillStyle="#854"; Ctx.fillRect(dX, dY+20, this.w, this.h-20); Ctx.fillStyle="#632"; Ctx.beginPath(); Ctx.moveTo(dX-5,dY+20); Ctx.lineTo(dX+this.w/2,dY); Ctx.lineTo(dX+this.w+5,dY+20); Ctx.fill(); Ctx.fillStyle="#000"; Ctx.fillRect(dX+30, dY+40, 15, 20); }
        else if(this.b==='ruins' && this.t==='wall') { Ctx.drawImage(Cache['wall_ruin'], dX, dY, 64, 64); }
        else if(this.b==='dungeon' && this.t==='wall') { Ctx.drawImage(Cache['wall_cave'], dX, dY, 64, 64); }
        else if(this.t==='water') { Ctx.fillStyle=this.b==='ruins'?'#335':(this.b==='dungeon'?'#300':'#46a'); Ctx.fillRect(dX,dY,this.w,this.h); }
    }
}