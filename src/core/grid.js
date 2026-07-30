export const Grid = {
    cell: 128, map: {},
    clear: function() { this.map={}; },
    add: function(obj) {
        const x1 = Math.floor(obj.x/this.cell), x2 = Math.floor((obj.x+obj.w)/this.cell);
        const y1 = Math.floor(obj.y/this.cell), y2 = Math.floor((obj.y+obj.h)/this.cell);
        for(let x=x1; x<=x2; x++) for(let y=y1; y<=y2; y++) { const k = x+','+y; if(!this.map[k]) this.map[k] = []; this.map[k].push(obj); }
    },
    get: function(rect) {
        const res = []; const x1 = Math.floor(rect.x/this.cell), x2 = Math.floor((rect.x+rect.w)/this.cell); const y1 = Math.floor(rect.y/this.cell), y2 = Math.floor((rect.y+rect.h)/this.cell);
        for(let x=x1; x<=x2; x++) for(let y=y1; y<=y2; y++) { const k = x+','+y; if(this.map[k]) for(let o of this.map[k]) res.push(o); } return res;
    }
};
