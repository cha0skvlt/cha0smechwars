import { BALANCE } from '../config/balance.js';

export function classCatalog(mechClass) {
    return BALANCE.TACTICAL_UPGRADES[mechClass] || {};
}

export function lanceCatalog() {
    return BALANCE.TACTICAL_UPGRADES.lance;
}

export function upgradeCost(mechClass, id) {
    const catalog = mechClass === 'lance' ? lanceCatalog() : classCatalog(mechClass);
    const entry = catalog[id];
    return entry ? entry.cost : Infinity;
}

/** Win streaks discount tactical upgrades, loss streaks surcharge them (never both at once). */
export function streakMultiplier(winStreak=0, lossStreak=0) {
    const s = BALANCE.STREAK;
    if(winStreak > 0) return Math.max(1 - s.discountMax, 1 - winStreak * s.discountStep);
    if(lossStreak > 0) return Math.min(1 + s.surchargeMax, 1 + lossStreak * s.surchargeStep);
    return 1;
}

export function priceFor(mechClass, id, winStreak=0, lossStreak=0) {
    const base = upgradeCost(mechClass, id);
    if(!Number.isFinite(base)) return Infinity;
    return Math.round(base * streakMultiplier(winStreak, lossStreak));
}

function applyStatEffect(mech, effect) {
    if(effect.stat === 'maxHp') {
        mech.maxHp += effect.add;
        mech.hp = Math.min(mech.maxHp, mech.hp + effect.add);
        return;
    }
    if(effect.stat === 'maxShield') {
        mech.maxShield += effect.add;
        mech.shield = Math.min(mech.maxShield, mech.shield + effect.add);
        return;
    }
    if(effect.add != null) mech[effect.stat] = (mech[effect.stat] || 0) + effect.add;
}

/** Apply one owned tactical-upgrade id onto a freshly constructed mech instance. */
export function applyTacticalUpgrade(mech, mechClass, id) {
    const catalog = mechClass === 'lance' ? lanceCatalog() : classCatalog(mechClass);
    const entry = catalog[id];
    if(!entry) return;
    if(entry.effects) for(const effect of entry.effects) applyStatEffect(mech, effect);
    if(entry.flag === 'turretVariant') { mech.turretVariant = entry.value; return; }
    if(entry.flag) mech[entry.flag] = true;
}

/** Apply every owned upgrade for a lance slot: its class-specific set plus the shared lance-wide set. */
export function applyLoadout(mech, mechClass, ownedClassIds, ownedLanceIds) {
    for(const id of ownedClassIds || []) applyTacticalUpgrade(mech, mechClass, id);
    for(const id of ownedLanceIds || []) applyTacticalUpgrade(mech, 'lance', id);
}
