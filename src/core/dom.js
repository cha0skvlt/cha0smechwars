// @meta:DOM - DOM manipulation utilities for UI elements
export const DOM = {
    show: (id) => { const el = document.getElementById(id); if(el) el.classList.remove('hidden'); },
    hide: (id) => { const el = document.getElementById(id); if(el) el.classList.add('hidden'); },
    hideAll: () => { DOM.hide('start-screen'); DOM.hide('class-select-screen'); DOM.hide('game-over-screen'); DOM.hide('ui-layer'); },
    glitch: () => { const ui = document.getElementById('ui-layer'); ui.classList.add('glitch-active'); setTimeout(()=>ui.classList.remove('glitch-active'), 200); },
    updateProgression: (level, xp, nextXp) => {
        const levelEl = document.getElementById('player-level');
        const valueEl = document.getElementById('xp-value');
        const fillEl = document.getElementById('xp-fill');
        if(levelEl) levelEl.textContent = `LEVEL ${level}`;
        if(valueEl) valueEl.textContent = `${xp} / ${nextXp} XP`;
        if(fillEl) fillEl.style.width = `${Math.min(100, xp / nextXp * 100)}%`;
    },
    showUpgradeChoices: (choices) => {
        const cards = document.querySelectorAll('[id^="upgrade-choice-"]');
        const hues = ['hue-crit', 'hue-shield', 'hue-hp', 'hue-fire', 'hue-speed', 'hue-fuel', 'hue-ui'];
        cards.forEach((card, i) => {
            const choice = choices[i];
            if(!choice) {
                card.classList.add('hidden');
                return;
            }
            card.classList.remove('hidden', 'rare', ...hues);
            const isRare = choice.rarity === 'rare';
            if(isRare) card.classList.add('rare');
            else if(choice.hue) card.classList.add(`hue-${choice.hue}`);
            const tag = card.querySelector('.upgrade-tag');
            if(tag) tag.textContent = choice.tag || choice.description || choice.title || '';
        });
        DOM.show('level-up-overlay');
    },
    hideUpgradeChoices: () => DOM.hide('level-up-overlay'),
};
