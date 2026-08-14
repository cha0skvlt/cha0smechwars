import { Game } from './game/Game.js';
import { Input, resize } from './core/runtime.js';
import { bakeSprites } from './render/bake.js';
import { Logger } from './core/Logger.js';
import { fitScaleToViewport } from './core/fitScale.js';

window.__CMW_GAME__ = Game;
Logger.init();

window.onerror = function(msg, url, line, col, error) {
    // Chrome's own diagnostic for a ResizeObserver callback that couldn't finish delivering
    // notifications within one animation frame - explicitly documented by the spec/Chromium team
    // as benign (the observer still settles on the next frame, nothing is actually broken). It
    // fires as a real window error event, but it is not an application error - do not crash the
    // page over it.
    if (typeof msg === 'string' && msg.includes('ResizeObserver loop')) return true;
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

// Menu screens always fit the viewport (no scrollbars) - see core/fitScale.js.
['start-screen', 'lance-hub-screen', 'contract-briefing-screen', 'game-over-screen'].forEach(id => {
    const screenEl = document.getElementById(id);
    fitScaleToViewport(screenEl, screenEl && screenEl.querySelector('.fit-scale'));
});

// Keep the page fully in-game: no browser context menu, no devtools/view-source/save shortcuts
// stealing input mid-play (same intent as the CSS user-select:none that already blocks text
// selection). Note this only suppresses the default action where the browser lets page JS do so -
// some browsers still honor F12/devtools at the chrome level regardless.
document.addEventListener('contextmenu', e => e.preventDefault());

const UPGRADE_KEYS = { Digit1: 0, Digit2: 1, Digit3: 2 };
const BLOCKED_DEVTOOLS_KEYS = new Set(['KeyI', 'KeyJ', 'KeyC']);
document.addEventListener('keydown', e => {
    if (e.code === 'Space') e.preventDefault();
    if (
        e.code === 'F12'
        || ((e.ctrlKey || e.metaKey) && (e.code === 'KeyU' || e.code === 'KeyS'))
        || ((e.ctrlKey || e.metaKey) && e.shiftKey && BLOCKED_DEVTOOLS_KEYS.has(e.code))
    ) {
        e.preventDefault();
        return;
    }
    Input.keys[e.code] = true;
    const upgradeIndex = UPGRADE_KEYS[e.code];
    if(upgradeIndex != null && !e.repeat && Game.upgradeChoices.length > 0) {
        e.preventDefault();
        Game.selectUpgrade(upgradeIndex);
    }
    if (e.code === 'KeyP') Game.togglePause();
    if (e.code === 'KeyC' && !e.repeat) Game.switchControl();
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
        Game.beginNewRun();
        Logger.event('system', 'lance_hub_shown', 'lance hub screen');
    } catch (e) {
        Logger.error('error', 'init_failed', e.message, null, e.stack);
        document.getElementById('error-screen').style.display = 'flex';
        document.getElementById('error-msg').innerText = e.stack;
    }
};

const reboot = document.getElementById('reboot-btn');
if (reboot) reboot.addEventListener('click', () => {
    Logger.event('system', 'continue_after_wipe', 'return to lance hub');
    Game.continueAfterWipe();
});
