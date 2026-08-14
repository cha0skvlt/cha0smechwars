import { BALANCE } from '../config/balance.js';
import { classCatalog, lanceCatalog } from './tacticalUpgrades.js';

function unitRoll(rng) {
    return Math.min(Math.max(rng(), 0), 1 - Number.EPSILON);
}

function weightedPick(entries, rng) {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    if(total <= 0) return null;
    let roll = unitRoll(rng) * total;
    for(let i=0; i<entries.length; i++) {
        roll -= entries[i].weight;
        if(roll < 0) return entries[i];
    }
    return entries[entries.length - 1];
}

// Class -> upgrade id -> purchase weight bias (flavor-appropriate picks are favored, not exclusive).
const CLASS_WEIGHTS = {
    heavy:  { improvedHeavy: 1, bastionShield: 2, seismicSlam: 1.5, juggernautMk2: 1 },
    battle: { improvedBattle: 1, turretRocket: 1.5, turretLaser: 1 },
    scout:  { improvedScout: 1, permaFlight: 1.5 },
};
const LANCE_WEIGHT = 0.6; // relative chance per roll to spend on the shared lance branch instead

/**
 * Spend the rival's persistent CE budget on the same TACTICAL_UPGRADES catalog the player shops
 * from, weighted by class metadata. Never spends more than the budget or the per-mech cap.
 * Pure function: returns the loadout and unspent remainder, does not mutate BALANCE.
 */
export function purchaseRivalLoadout(composition, budget, rng=Math.random) {
    const maxPerMech = BALANCE.TACTICAL_UPGRADES.maxPerMech;
    const loadout = composition.map(mechClass => ({ class: mechClass, upgrades: [] }));
    const sharedUpgrades = [];
    let remaining = Math.max(0, budget);

    let purchasedSomething = true;
    while(purchasedSomething && remaining > 0) {
        purchasedSomething = false;
        const candidates = [];
        loadout.forEach((slot, slotIndex) => {
            if(slot.upgrades.length >= maxPerMech) return;
            const catalog = classCatalog(slot.class);
            const weights = CLASS_WEIGHTS[slot.class] || {};
            for(const id of Object.keys(catalog)) {
                if(slot.upgrades.includes(id)) continue;
                const entry = catalog[id];
                if(entry.cost > remaining) continue;
                candidates.push({ slotIndex, class: slot.class, id, cost: entry.cost, weight: weights[id] || 1 });
            }
        });
        const lanceCat = lanceCatalog();
        for(const id of Object.keys(lanceCat)) {
            if(sharedUpgrades.includes(id)) continue;
            const entry = lanceCat[id];
            if(entry.cost > remaining) continue;
            candidates.push({ slotIndex: -1, class: 'lance', id, cost: entry.cost, weight: LANCE_WEIGHT });
        }
        if(candidates.length === 0) break;
        const pick = weightedPick(candidates, rng);
        if(!pick) break;
        if(pick.slotIndex === -1) sharedUpgrades.push(pick.id);
        else loadout[pick.slotIndex].upgrades.push(pick.id);
        remaining -= pick.cost;
        purchasedSomething = true;
    }

    return { loadout, sharedUpgrades, spent: budget - remaining, remaining };
}
