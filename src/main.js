import { Game } from './game/Game.js';
import { Input, resize } from './core/runtime.js';
import { bakeSprites } from './render/bake.js';
import { Logger } from './core/Logger.js';

window.__CMW_GAME__ = Game;
Logger.init();

window.onerror = function(msg, url, line, col, error) {
    Logger.error('error', 'uncaught', String(msg), { url, line, col }, error && error.stack ? error.stack : null);
    document.getElementById('error-screen').style.display = 'flex';
    document.getElementById('error-msg').innerText = `${msg}\nLine: ${line}`;
    return false;
};

window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    Logger.error('error', 'unhandledrejection', String(reason && reason.message ? reason.message : reason), null, reason && reason.stack ? reason.stack : null);
});

window.addEventListener('resize', resize);
resize();

const UPGRADE_KEYS = { Digit1: 0, Digit2: 1, Digit3: 2 };
document.addEventListener('keydown', e => {
    if (e.code === 'Space') e.preventDefault();
    Input.keys[e.code] = true;
    const upgradeIndex = UPGRADE_KEYS[e.code];
    if(upgradeIndex != null && !e.repeat && Game.upgradeChoices.length > 0) {
        e.preventDefault();
        Game.selectUpgrade(upgradeIndex);
    }
    if (e.code === 'KeyP') Game.togglePause();
}, { passive: false });
document.addEventListener('keyup', e => { Input.keys[e.code] = false; });
window.onmousemove = e => { Input.mouse.x = e.clientX; Input.mouse.y = e.clientY; };
window.onmousedown = () => Input.mouse.down = true;
window.onmouseup = () => Input.mouse.down = false;

document.getElementById('start-btn').onclick = function() {
    this.blur();
    try {
        Logger.event('system', 'initiate', 'INITIATE SYSTEM');
        Game.initSystem();
        Game.showClassSelect();
        Logger.event('system', 'class_select_shown', 'class select screen');
    } catch (e) {
        Logger.error('error', 'init_failed', e.message, null, e.stack);
        document.getElementById('error-screen').style.display = 'flex';
        document.getElementById('error-msg').innerText = e.stack;
    }
};

document.querySelectorAll('.mech-card[data-class]').forEach(card => {
    card.addEventListener('click', () => Game.selectClass(card.dataset.class));
});

const reboot = document.getElementById('reboot-btn');
if (reboot) reboot.addEventListener('click', () => {
    Logger.event('system', 'reboot', 'page reload');
    location.reload();
});
