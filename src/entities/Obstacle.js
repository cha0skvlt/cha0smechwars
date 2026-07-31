import { Entity } from './Entity.js';
import { Cam, W, H } from '../core/runtime.js';
import { renderVisual } from '../render/PixelRenderer.js';

export class Obstacle extends Entity {
    constructor(x,y,type,biome) { super(x,y,32,32); this.t=type; this.b=biome; if(biome==='forest'&&type==='house'){this.w=80;this.h=60;} if(biome==='ruins'){this.w=64;this.h=64;} if(biome==='dungeon'){this.w=64;this.h=64;} if(type==='water'){this.w=64;this.h=64;} }
    draw(alpha) {
        const dX = this.x; const dY = this.y;
        if(dX+this.w<Cam.x-W||dX>Cam.x+W*2||dY+this.h<Cam.y-H||dY>Cam.y+H*2) return;
        if(this.t==='tree') {
            renderVisual('sprite.obstacle.tree', { x: dX, y: dY, width: 32, height: 32 });
            renderVisual('obstacle.tree.trunk', { x: dX, y: dY });
        }
        else if(this.b==='forest' && this.t==='house') renderVisual('obstacle.house', { x: dX, y: dY, width: this.w, height: this.h });
        else if(this.b==='ruins' && this.t==='wall') renderVisual('sprite.obstacle.wall.ruins', { x: dX, y: dY, width: 64, height: 64 });
        else if(this.b==='dungeon' && this.t==='wall') renderVisual('sprite.obstacle.wall.dungeon', { x: dX, y: dY, width: 64, height: 64 });
        else if(this.t==='water') renderVisual('obstacle.water', {
            x: dX,
            y: dY,
            width: this.w,
            height: this.h,
            color: this.b==='ruins'?'#335':(this.b==='dungeon'?'#300':'#46a'),
        });
    }
}