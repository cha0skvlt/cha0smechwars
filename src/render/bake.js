import { Sprites } from './sprites.js';

export const Cache = {}; export const ShadowCv = document.createElement('canvas'); ShadowCv.width=32; ShadowCv.height=16;
const sCtx = ShadowCv.getContext('2d'); sCtx.fillStyle="rgba(0,0,0,0.5)"; sCtx.beginPath(); sCtx.ellipse(16,8,16,8,0,0,Math.PI*2); sCtx.fill();

export function bakeSprites() {
    const list = [
        {k:'player',s:Sprites.soldier,c:'#00eaff'},{k:'player_q',s:Sprites.soldier,c:'#f0f'},
        {k:'heavy',s:Sprites.heavy,c:'#00eaff'},{k:'heavy_q',s:Sprites.heavy,c:'#f0f'},
        {k:'scout',s:Sprites.scout,c:'#00eaff'},{k:'scout_q',s:Sprites.scout,c:'#f0f'},
        {k:'bot_battle',s:Sprites.soldier,c:'#f00'},
        {k:'bot_heavy',s:Sprites.heavy,c:'#f00'},
        {k:'bot_scout',s:Sprites.scout,c:'#f00'},
        {k:'zombie',s:Sprites.zombie,c:'#5b5'},{k:'gunner',s:Sprites.gunner,c:'#eb2'},
        {k:'rocketman',s:Sprites.rocketman,c:'#f60'},{k:'sniper',s:Sprites.sniper,c:'#fff'},
        {k:'tank',s:Sprites.tank,c:'#684'},
        {k:'mantis',s:Sprites.mantis,c:'#5f5'}, {k:'fortress',s:Sprites.fortress,c:'#889'}, {k:'eye',s:Sprites.eye,c:'#a0f'},
        {k:'stalker',s:Sprites.soldier,c:'#d44'},{k:'commando',s:Sprites.soldier,c:'#222'},
        {k:'tree',s:Sprites.tree,c:'#2d6'},{k:'box',s:Sprites.box,c:'#fff'},
        {k:'wall_ruin',s:Sprites.wall_ruin,c:'#766'},{k:'wall_cave',s:Sprites.wall_cave,c:'#544'},
        {k:'turret',s:Sprites.turret,c:'#00eaff'}
    ];
    list.forEach(i => { Cache[i.k] = createCv(i.s, i.c); if(!['tree','box','wall_ruin','wall_cave','turret'].includes(i.k)){Cache[i.k+'_w']=createCv(i.s,'#fff'); Cache[i.k+'_b']=createCv(i.s,'#60f');} });
    renderPreview('preview-battle', 'player'); renderPreview('preview-heavy', 'heavy'); renderPreview('preview-scout', 'scout');
}
export function createCv(data, color) { const c=document.createElement('canvas'); c.width=data[0].length; c.height=data.length; const ctx=c.getContext('2d'); ctx.fillStyle=color; for(let y=0;y<data.length;y++)for(let x=0;x<data[y].length;x++)if(data[y][x]==='1')ctx.fillRect(x,y,1,1); return c; }
export function renderPreview(id, key) { const cv = document.getElementById(id); if(!cv) return; const ctx = cv.getContext('2d'); cv.width = 96; cv.height = 96; ctx.imageSmoothingEnabled = false; if(Cache[key]) ctx.drawImage(Cache[key], 0, 0, 96, 96); }
