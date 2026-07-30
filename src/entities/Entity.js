// @meta:Entity - Base class for all game objects with position, size, and collision
export class Entity {
    constructor(x,y,w,h) { this.x=x; this.y=y; this.w=w; this.h=h; this.lastX = x; this.lastY = y; this.lastAttacker = null; }
    saveState() { this.lastX = this.x; this.lastY = this.y; }
    center() { return {x:this.x+this.w/2, y:this.y+this.h/2}; }
    rectIntersect(r) { return !(r.x>this.x+this.w || r.x+r.w<this.x || r.y>this.y+this.h || r.y+r.h<this.y); }
}
