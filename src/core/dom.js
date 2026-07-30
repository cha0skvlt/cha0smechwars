// @meta:DOM - DOM manipulation utilities for UI elements
export const DOM = {
    show: (id) => { const el = document.getElementById(id); if(el) el.classList.remove('hidden'); },
    hide: (id) => { const el = document.getElementById(id); if(el) el.classList.add('hidden'); },
    hideAll: () => { DOM.hide('start-screen'); DOM.hide('class-select-screen'); DOM.hide('game-over-screen'); DOM.hide('ui-layer'); },
    glitch: () => { const ui = document.getElementById('ui-layer'); ui.classList.add('glitch-active'); setTimeout(()=>ui.classList.remove('glitch-active'), 200); }
};
