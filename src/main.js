import { Game } from './game/Game.js';
import { Input, resize } from './core/runtime.js';
import { bakeSprites } from './render/bake.js';

window.onerror = function(msg, url, line, col, error) {
    document.getElementById('error-screen').style.display = 'flex';
    document.getElementById('error-msg').innerText = `${msg}\nLine: ${line}`;
    return false;
};

window.addEventListener('resize', resize);
resize();

document.addEventListener('keydown', e => {
    if (e.code === 'Space') e.preventDefault();
    Input.keys[e.code] = true;
    if (e.code === 'KeyP') Game.togglePause();
}, { passive: false });
document.addEventListener('keyup', e => { Input.keys[e.code] = false; });
window.onmousemove = e => { Input.mouse.x = e.clientX; Input.mouse.y = e.clientY; };
window.onmousedown = () => Input.mouse.down = true;
window.onmouseup = () => Input.mouse.down = false;

document.getElementById('start-btn').onclick = function() {
    this.blur();
    try {
        Game.initSystem();
        Game.showClassSelect();
    } catch (e) {
        document.getElementById('error-screen').style.display = 'flex';
        document.getElementById('error-msg').innerText = e.stack;
    }
};

document.querySelectorAll('.mech-card[data-class]').forEach(card => {
    card.addEventListener('click', () => Game.selectClass(card.dataset.class));
});

const reboot = document.getElementById('reboot-btn');
if (reboot) reboot.addEventListener('click', () => location.reload());
