export const Canvas = document.getElementById('game');
export const Ctx = Canvas.getContext('2d');
export let W, H;
export const Cam = {x:0, y:0, lastX:0, lastY:0, zoom:1.0, rot:0, trauma:0};
export const Input = {keys:{}, mouse:{x:0,y:0,down:false,wx:0,wy:0}};

export function resize() {
    W = Canvas.width = window.innerWidth;
    H = Canvas.height = window.innerHeight;
    Ctx.imageSmoothingEnabled = false;
}
