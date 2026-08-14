import { BALANCE } from '../config/balance.js';
import { Game } from '../game/Game.js';
import { Cosmetics } from '../core/Cosmetics.js';
import { xpForNextLevel } from '../progression/progression.js';
import { classCatalog, lanceCatalog, priceFor } from '../progression/tacticalUpgrades.js';
import { renderVisual } from '../render/PixelRenderer.js';

// @meta:Hub - Lance hub (composition + tactical/cosmetic shop), contract briefing, and the
// in-mission lance strip. Pure DOM rendering + click wiring; all state lives on Game (v8).

const THEME_CLASSES = ['hud-theme-ember', 'hud-theme-toxic', 'hud-theme-magenta', 'hud-theme-blood'];
const COSMETIC_DOTS = { hudDefault: '#00eaff', hudEmber: '#ff7b1a', hudToxic: '#9dff1a', hudMagenta: '#ff2ad1', hudBlood: '#ff2222' };

let selection = null; // in-progress lance composition edits while the hub is open
let lastMissionResult = null;
let activeShopTab = 'tactical';

function el(id) { return document.getElementById(id); }

const MISSION_RESULT_LABELS = {
    win: 'CONTRACT COMPLETE',
    raceLoss: 'TARGET LOST TO RIVAL LANCE',
    wipe: 'LANCE WIPED OUT',
};

function renderMissionResult() {
    const box = el('hub-mission-result');
    if(!box) return;
    if(!lastMissionResult) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.classList.remove('hidden');
    const outcome = lastMissionResult.outcome;
    const isLoss = outcome !== 'win';
    box.classList.toggle('loss', isLoss);
    const label = MISSION_RESULT_LABELS[outcome] || MISSION_RESULT_LABELS.raceLoss;
    // Spell out the share so a partial/zero credit never reads as a bug - e.g. a wipe crediting
    // 0 CE and a race-loss crediting 50% are both working as intended, just very different rules.
    const share = outcome === 'win' ? 1 : (outcome === 'raceLoss' ? BALANCE.CE.raceLossShare : BALANCE.CE.wipeShare);
    const sharePct = Math.round(share * 100);
    box.innerHTML = `${label} (${sharePct}% CE SHARE) — MISSION CE ${lastMissionResult.missionCE} — CREDITED <span class="text-highlight">${lastMissionResult.credited} CE</span> TO WALLET`;
}

function renderWallet() {
    const walletEl = el('hub-ce-wallet');
    if(walletEl) walletEl.textContent = Game.ceWallet;
    const streakEl = el('hub-streak');
    if(!streakEl) return;
    if(Game.winStreak > 0) {
        const pct = Math.round(Math.min(BALANCE.STREAK.discountMax, Game.winStreak * BALANCE.STREAK.discountStep) * 100);
        streakEl.textContent = `WIN STREAK ×${Game.winStreak} — PRICES -${pct}%`;
    } else if(Game.lossStreak > 0) {
        const pct = Math.round(Math.min(BALANCE.STREAK.surchargeMax, Game.lossStreak * BALANCE.STREAK.surchargeStep) * 100);
        streakEl.textContent = `LOSS STREAK ×${Game.lossStreak} — PRICES +${pct}%`;
    } else {
        streakEl.textContent = 'NO STREAK';
    }
}

// Canon numbers only (GAME_SYS.md §1 / balance.js MECHS) - bar fill is each stat relative to the
// highest value across the 3 chassis, so the bars stay visually comparable as balance.js changes.
const STAT_KEYS = { hp: 'hp', spd: 'spd', shield: 'shield' };
const STAT_MAX = Object.fromEntries(Object.entries(STAT_KEYS).map(([stat, key]) => (
    [stat, Math.max(...Object.values(BALANCE.MECHS).map(m => m[key]))]
)));

function renderClassCards() {
    document.querySelectorAll('#hub-class-cards .hub-mini-card').forEach(card => {
        const cls = card.dataset.class;
        card.classList.toggle('selected', selection.includes(cls));
        card.onclick = () => {
            const idx = selection.findIndex(s => s === null);
            if(idx === -1) return;
            selection[idx] = cls;
            renderHub();
        };
        const mech = BALANCE.MECHS[cls];
        if(!mech) return;
        card.querySelectorAll('.stat-row[data-stat]').forEach(row => {
            const stat = row.dataset.stat;
            const key = STAT_KEYS[stat];
            const value = mech[key];
            if(value === undefined) return;
            const fill = row.querySelector('.stat-fill');
            const label = row.querySelector('.stat-value');
            if(fill) fill.style.width = Math.round((value / STAT_MAX[stat]) * 100) + '%';
            if(label) label.textContent = Number.isInteger(value) ? value : value.toFixed(1);
        });
    });
}

function renderSlots() {
    const box = el('hub-slots');
    if(!box) return;
    box.innerHTML = '';
    for(let i=0; i<BALANCE.LANCE.size; i++) {
        const cls = selection[i];
        const slotDiv = document.createElement('div');
        slotDiv.className = 'hub-slot' + (cls ? ' filled' : '');
        if(cls) {
            const owned = Game.lanceSlotUpgrades[i] || new Set();
            const names = [...owned].map(id => classCatalog(cls)[id]?.title).filter(Boolean);
            slotDiv.innerHTML = `<div class="hub-slot-class">SLOT ${i+1} — ${cls.toUpperCase()}</div><div class="hub-slot-upgrades">${names.join('<br>') || 'NO UPGRADES YET'}</div>`;
        } else {
            slotDiv.textContent = `SLOT ${i+1} — EMPTY`;
        }
        slotDiv.onclick = () => {
            if(!selection[i]) return;
            selection[i] = null;
            renderHub();
        };
        box.appendChild(slotDiv);
    }
    const deployBtn = el('hub-deploy-btn');
    if(deployBtn) deployBtn.disabled = selection.some(s => !s);
}

// Items that share a `flag` + carry a `value` (e.g. turretRocket/turretLaser both set
// turretVariant) are mutually exclusive - only the most-recently-(re)selected one is active,
// since tacticalUpgrades.js applies owned ids in order and the last one wins.
function variantGroupIds(catalog, entry) {
    if(entry.value === undefined) return null;
    return Object.keys(catalog).filter(otherId => catalog[otherId].flag === entry.flag && catalog[otherId].value !== undefined);
}

function isActiveInGroup(ownedSet, catalog, id, entry) {
    const group = variantGroupIds(catalog, entry);
    if(!group) return true;
    const groupIds = new Set(group);
    // applyTacticalUpgrade() applies owned ids in Set *insertion* order and the last one wins -
    // mirror that exactly here, not catalog-definition order, or the UI would lie about which
    // variant is actually active (and the re-select button would look like it does nothing).
    let lastInGroup = null;
    for(const ownedId of ownedSet) {
        if(groupIds.has(ownedId)) lastInGroup = ownedId;
    }
    return lastInGroup === id;
}

function shopItemNode(mechClass, id, entry, state) {
    // state: 'available' | 'owned' | 'active' | 'reselectable'
    const price = priceFor(mechClass, id, Game.winStreak, Game.lossStreak);
    const afford = Game.ceWallet >= price;
    const item = document.createElement('div');
    const ownedLike = state === 'owned' || state === 'active' || state === 'reselectable';
    item.className = 'shop-item' + (ownedLike ? ' owned' : (afford ? '' : ' unaffordable'));
    if(state === 'reselectable') item.classList.add('reselectable');
    const costLabel = state === 'active' ? 'ACTIVE' : (ownedLike ? 'OWNED — SELECT' : price + ' CE');
    item.innerHTML = `<div class="shop-item-info"><div class="shop-item-title">${entry.title}</div><div class="shop-item-tag">${entry.tag}</div></div><div class="shop-item-cost">${costLabel}</div>`;
    return item;
}

function renderTacticalShop() {
    const panel = el('hub-tab-tactical');
    if(!panel) return;
    panel.innerHTML = '';
    let anySlotFilled = false;

    selection.forEach((cls, slot) => {
        if(!cls) return;
        anySlotFilled = true;
        const group = document.createElement('div');
        group.className = 'shop-slot-group';
        const title = document.createElement('div');
        title.className = 'shop-slot-group-title';
        title.textContent = `SLOT ${slot+1} — ${cls.toUpperCase()}`;
        group.appendChild(title);
        const catalog = classCatalog(cls);
        if(!Game.lanceSlotUpgrades[slot]) Game.lanceSlotUpgrades[slot] = new Set();
        const ownedSet = Game.lanceSlotUpgrades[slot];
        Object.entries(catalog).forEach(([id, entry]) => {
            const owned = ownedSet.has(id);
            let state = 'available';
            if(owned) state = isActiveInGroup(ownedSet, catalog, id, entry) ? 'active' : 'reselectable';
            const item = shopItemNode(cls, id, entry, state);
            if(state === 'available') item.onclick = () => {
                const price = priceFor(cls, id, Game.winStreak, Game.lossStreak);
                if(Game.ceWallet < price) return;
                Game.ceWallet -= price;
                ownedSet.add(id);
                renderHub();
            };
            else if(state === 'reselectable') item.onclick = () => {
                // Free re-select within an owned mutually-exclusive group (e.g. turret barrel type) -
                // move it to the end of the owned set so applyLoadout() picks it as the active one.
                ownedSet.delete(id); ownedSet.add(id);
                renderHub();
            };
            group.appendChild(item);
        });
        panel.appendChild(group);
    });

    const lanceGroup = document.createElement('div');
    lanceGroup.className = 'shop-slot-group';
    const lanceTitle = document.createElement('div');
    lanceTitle.className = 'shop-slot-group-title';
    lanceTitle.textContent = 'LANCE — SHARED TACTIC';
    lanceGroup.appendChild(lanceTitle);
    const lanceCat = lanceCatalog();
    Object.entries(lanceCat).forEach(([id, entry]) => {
        const owned = Game.lanceSharedUpgrades.has(id);
        let state = 'available';
        if(owned) state = isActiveInGroup(Game.lanceSharedUpgrades, lanceCat, id, entry) ? 'active' : 'reselectable';
        const item = shopItemNode('lance', id, entry, state);
        if(state === 'available') item.onclick = () => {
            const price = priceFor('lance', id, Game.winStreak, Game.lossStreak);
            if(Game.ceWallet < price) return;
            Game.ceWallet -= price;
            Game.lanceSharedUpgrades.add(id);
            renderHub();
        };
        else if(state === 'reselectable') item.onclick = () => {
            Game.lanceSharedUpgrades.delete(id); Game.lanceSharedUpgrades.add(id);
            renderHub();
        };
        lanceGroup.appendChild(item);
    });
    panel.appendChild(lanceGroup);

    if(!anySlotFilled) {
        const hint = document.createElement('div');
        hint.className = 'shop-item-tag';
        hint.textContent = 'Fill lance slots with chassis to unlock class-specific upgrades.';
        panel.prepend(hint);
    }
}

function renderCosmeticShop() {
    const panel = el('hub-tab-cosmetic');
    if(!panel) return;
    panel.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'cosmetic-grid';
    Object.entries(BALANCE.COSMETICS.hudThemes).forEach(([id, entry]) => {
        const owned = entry.cost === 0 || Game.cosmeticsOwned.has(id);
        const active = Game.activeCosmetic === id;
        const swatch = document.createElement('div');
        swatch.className = 'cosmetic-swatch' + (active ? ' active' : '') + (!owned ? ' locked' : '');
        swatch.innerHTML = `<div class="cosmetic-swatch-dot" style="background:${COSMETIC_DOTS[id] || '#fff'}"></div>${entry.title}` +
            (owned ? '' : `<div class="cosmetic-swatch-cost">${entry.cost} CE</div>`);
        swatch.onclick = () => {
            if(!owned) {
                if(Game.ceWallet < entry.cost) return;
                Game.ceWallet -= entry.cost;
                Game.cosmeticsOwned.add(id);
            }
            Game.activeCosmetic = id;
            applyCosmetic(id);
            Cosmetics.save(Game.cosmeticsOwned, Game.activeCosmetic);
            renderHub();
        };
        grid.appendChild(swatch);
    });
    panel.appendChild(grid);
}

function renderTabs() {
    const tacticalBtn = el('hub-tab-btn-tactical');
    const cosmeticBtn = el('hub-tab-btn-cosmetic');
    const tacticalPanel = el('hub-tab-tactical');
    const cosmeticPanel = el('hub-tab-cosmetic');
    if(!tacticalBtn || !cosmeticBtn || !tacticalPanel || !cosmeticPanel) return;
    tacticalBtn.classList.toggle('active', activeShopTab === 'tactical');
    cosmeticBtn.classList.toggle('active', activeShopTab === 'cosmetic');
    tacticalPanel.classList.toggle('hidden', activeShopTab !== 'tactical');
    cosmeticPanel.classList.toggle('hidden', activeShopTab !== 'cosmetic');
    tacticalBtn.onclick = () => { activeShopTab = 'tactical'; renderTabs(); };
    cosmeticBtn.onclick = () => { activeShopTab = 'cosmetic'; renderTabs(); };
}

// Shop panel (right column) always reaches down to the same bottom edge as the DEPLOY button
// (left column) instead of an arbitrary vh guess - "use all the depth down to DEPLOY's bottom
// pixels". The left column's height is stable (always 3 chassis cards + 3 slots + the button,
// regardless of which classes are picked - see .fit-scale jitter fix), so match to it directly
// rather than re-measuring content that varies with the shop list length.
let shopHeightObserver = null;
let shopHeightScheduled = false;
function syncShopPanelHeight() {
    const screen = el('lance-hub-screen');
    const leftCol = screen && screen.querySelector('.hub-column-lance');
    const shopCol = screen && screen.querySelector('.hub-column-shop');
    const panels = shopCol ? shopCol.querySelectorAll('.hub-tab-panel') : null;
    if(!leftCol || !panels || !panels.length) return;
    // Below the stacked-columns breakpoint (see @media max-width:900px) DEPLOY sits above the
    // shop instead of beside it - matching heights there would be meaningless, let the panel size
    // to its own content (CSS fallback height) instead.
    if(!window.matchMedia('(min-width: 901px)').matches) {
        panels.forEach(p => { if(p.style.height) p.style.height = ''; });
        return;
    }
    const spaceAbovePanel = panels[0].offsetTop; // tab buttons + margin, local to shopCol
    const height = Math.max(120, leftCol.offsetHeight - spaceAbovePanel);
    const px = height + 'px';
    // Skip no-op writes - even an identical value re-set inside a ResizeObserver callback can
    // count as a mutation the browser has to re-check, which is what triggers Chrome's benign
    // "ResizeObserver loop completed with undelivered notifications" diagnostic.
    panels.forEach(p => { if(p.style.height !== px) p.style.height = px; });
}
// The observer callback only schedules work for the next frame - never mutates synchronously
// from inside the callback itself - for the same reentrancy reason as fitScale.js.
function scheduleSyncShopPanelHeight() {
    if(shopHeightScheduled) return;
    shopHeightScheduled = true;
    requestAnimationFrame(() => { shopHeightScheduled = false; syncShopPanelHeight(); });
}

function renderHub(missionResult) {
    if(missionResult !== undefined) {
        lastMissionResult = missionResult;
        selection = Game.lanceComposition.slice();
    }
    if(!selection) selection = Game.lanceComposition.slice();

    renderMissionResult();
    renderWallet();
    renderClassCards();
    renderSlots();
    renderTacticalShop();
    renderCosmeticShop();
    renderTabs();

    const deployBtn = el('hub-deploy-btn');
    if(deployBtn) deployBtn.onclick = () => {
        if(selection.some(s => !s)) return;
        Game.confirmLanceComposition(selection);
    };

    syncShopPanelHeight();
    if(!shopHeightObserver) {
        const leftCol = document.querySelector('#lance-hub-screen .hub-column-lance');
        if(leftCol) {
            shopHeightObserver = new ResizeObserver(scheduleSyncShopPanelHeight);
            shopHeightObserver.observe(leftCol);
            window.addEventListener('resize', scheduleSyncShopPanelHeight);
        }
    }
}

function renderContractBriefing(data) {
    const biomeEl = el('briefing-biome');
    if(biomeEl) biomeEl.textContent = data.biome.toUpperCase();
    const nameEl = el('briefing-company-name');
    if(nameEl) nameEl.textContent = data.companyName;
    const killsEl = el('briefing-rival-kills');
    if(killsEl) killsEl.textContent = data.rivalMechKills;

    const cardsBox = el('briefing-rival-cards');
    if(cardsBox) {
        cardsBox.innerHTML = '';
        data.loadout.forEach(entry => {
            const catalog = classCatalog(entry.class);
            const names = entry.upgrades.map(id => catalog[id]?.title).filter(Boolean);
            const card = document.createElement('div');
            card.className = 'rival-card';
            card.innerHTML = `<canvas class="rival-card-icon" width="64" height="64"></canvas>` +
                `<div class="rival-card-class">${entry.class.toUpperCase()}</div>` + (
                names.length
                    ? names.map(n => `<div class="rival-card-upgrade">${n}</div>`).join('')
                    : '<div class="rival-card-empty">STOCK LOADOUT</div>'
            );
            cardsBox.appendChild(card);
            // Same chassis silhouette as the player's Lance Hub chassis cards (sprite.rival.<class>
            // shares the sprite.player.<class> pixel mask - only the palette differs, red vs cyan).
            const iconCtx = card.querySelector('.rival-card-icon').getContext('2d');
            iconCtx.imageSmoothingEnabled = false;
            renderVisual(`sprite.rival.${entry.class}`, { x: 0, y: 0, width: 64, height: 64, context: iconCtx });
        });
    }

    const sharedEl = el('briefing-rival-shared');
    if(sharedEl) {
        const catalog = lanceCatalog();
        const names = (data.sharedUpgrades || []).map(id => catalog[id]?.title).filter(Boolean);
        sharedEl.textContent = names.length ? `LANCE TACTIC: ${names.join(', ')}` : '';
    }

    const deployBtn = el('briefing-deploy-btn');
    if(deployBtn) deployBtn.onclick = () => Game.deployMission();
}

function updateLanceHud(playerLance, activeSlot) {
    const box = el('lance-strip');
    if(!box || !playerLance) return;
    if(box.children.length !== playerLance.length) {
        box.innerHTML = playerLance.map(() => (
            '<div class="lance-mini-row"><div class="lance-mini"><canvas class="lance-mini-icon" width="28" height="28"></canvas>' +
            '<div class="lance-mini-info"><div class="lance-mini-armor"></div>' +
            '<div class="lance-mini-hp"></div>' +
            '<div class="lance-mini-xp-row"><div class="lance-mini-xp-track"><div class="lance-mini-xp-fill"></div></div>' +
            '<span class="lance-mini-xp-value"></span></div></div></div>' +
            '<div class="lance-mini-kills"></div></div>'
        )).join('');
        // Same chassis silhouette as the Lance Hub/briefing cards (sprite.player.<class>) - a
        // mech's class never changes mid-mission, so this only needs to run when nodes are (re)built,
        // not every frame like the rest of this function.
        for(let i=0; i<playerLance.length; i++) {
            const canvas = box.children[i]?.querySelector('.lance-mini-icon');
            if(!canvas) continue;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            renderVisual(`sprite.player.${playerLance[i].type}`, { x: 0, y: 0, width: 28, height: 28, context: ctx });
        }
    }
    for(let i=0; i<playerLance.length; i++) {
        const mech = playerLance[i];
        const row = box.children[i];
        const node = row && row.querySelector('.lance-mini');
        if(!node) continue;
        node.classList.toggle('active', i === activeSlot);
        node.classList.toggle('dead', mech.hp <= 0);
        node.querySelector('.lance-mini-armor').textContent = mech.hp <= 0 ? 'KIA' : `${mech.type.slice(0,3).toUpperCase()} LV${mech.level}`;
        node.querySelector('.lance-mini-hp').textContent = mech.hp <= 0 ? '' : `${Math.ceil(mech.hp)}/${mech.maxHp} HP`;
        const nextXp = xpForNextLevel(mech.level);
        const pct = mech.hp <= 0 ? 0 : Math.min(100, (mech.xp / nextXp) * 100);
        node.querySelector('.lance-mini-xp-fill').style.width = pct + '%';
        node.querySelector('.lance-mini-xp-value').textContent = mech.hp <= 0 ? '' : `${mech.xp}/${nextXp}`;

        // WWII-nose-art kill markers: one skull per enemy mech THIS mech personally destroyed,
        // to the right of its own plate. Only touch the DOM when the count actually changed.
        const kills = mech.mechKills || 0;
        const killsBox = row.querySelector('.lance-mini-kills');
        if(killsBox && Number(killsBox.dataset.kills) !== kills) {
            killsBox.dataset.kills = kills;
            killsBox.innerHTML = '<span class="lance-mini-skull">💀</span>'.repeat(kills);
        }
    }
}

function applyCosmetic(id) {
    const container = document.getElementById('game-container');
    if(!container) return;
    THEME_CLASSES.forEach(c => container.classList.remove(c));
    const entry = BALANCE.COSMETICS.hudThemes[id];
    if(entry && entry.cssClass) container.classList.add(entry.cssClass);
}

export const Hub = {
    renderHub,
    renderContractBriefing,
    updateLanceHud,
    applyCosmetic,
};
