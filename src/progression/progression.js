import { BALANCE } from '../config/balance.js';

export function initializeProgression(actor) {
    actor.level = 1;
    actor.xp = 0;
    actor.perks = {};
    actor.critChance = BALANCE.CRIT.chance;
    actor.shieldRegenRate = BALANCE.SHIELD.regenRate;
    actor.fireRateMult = 1;
    actor.companionCapacity = 0;
    return actor;
}

export function xpForNextLevel(level) {
    return BALANCE.PROGRESSION.baseXp + (level - 1) * BALANCE.PROGRESSION.xpStep;
}

export function killReward(maxHp) {
    if(!Number.isFinite(maxHp) || maxHp < 0) throw new TypeError('Enemy max HP must be a non-negative number');
    return Math.ceil(maxHp);
}

/** Score/XP only for the human player or player-owned modules. Bot/rival kills never credit. */
export function isPlayerKillCredit(attacker, player) {
    if(!attacker || !player) return false;
    const owner = progressionOwner(attacker);
    return owner === player || (
        owner?.isHumanPlayer === true
        && owner?.faction === 'player'
    );
}

/** Resolve deployables (turrets, etc.) to the mech that owns their progression. */
export function progressionOwner(attacker) {
    if(!attacker) return null;
    let owner = attacker;
    const seen = new Set();
    while(
        owner?.ownsProgression !== true
        && owner?.owner
        && owner.owner !== owner
        && !seen.has(owner.owner)
    ) {
        seen.add(owner);
        owner = owner.owner;
    }
    return owner;
}

export function addXp(player, amount) {
    if(!Number.isFinite(amount) || amount < 0) throw new TypeError('XP amount must be a non-negative number');

    player.xp += amount;
    let levelsGained = 0;
    while(player.xp >= xpForNextLevel(player.level)) {
        player.xp -= xpForNextLevel(player.level);
        player.level++;
        levelsGained++;
    }
    return levelsGained;
}

function isEffectAvailable(player, effect) {
    if(effect.action === 'fullHeal') return true;
    if(effect.max != null) return player[effect.stat] < effect.max;
    if(effect.min != null) return player[effect.stat] > effect.min;
    return true;
}

export function isUpgradeAvailable(player, upgradeId) {
    const upgrade = BALANCE.UPGRADES[upgradeId];
    if(!upgrade) return false;
    return upgrade.effects.some(effect => isEffectAvailable(player, effect));
}

export function rollUpgradeChoices(player, rng=Math.random, audience=player?.isHumanPlayer ? 'human' : 'ai') {
    const pool = Object.entries(BALANCE.UPGRADES)
        .filter(([id, upgrade]) => (
            isUpgradeAvailable(player, id)
            && (!upgrade.audience || upgrade.audience === audience)
        ))
        .map(([id, upgrade]) => ({ id, ...upgrade }));
    const choices = [];

    while(choices.length < BALANCE.PROGRESSION.choiceCount && pool.length > 0) {
        const totalWeight = pool.reduce(
            (sum, upgrade) => sum + (upgrade.rarity === 'rare' ? BALANCE.PROGRESSION.rareWeight : 1),
            0,
        );
        let roll = Math.min(Math.max(rng(), 0), 1 - Number.EPSILON) * totalWeight;
        let selectedIndex = pool.length - 1;
        for(let i=0; i<pool.length; i++) {
            roll -= pool[i].rarity === 'rare' ? BALANCE.PROGRESSION.rareWeight : 1;
            if(roll < 0) {
                selectedIndex = i;
                break;
            }
        }
        choices.push(pool.splice(selectedIndex, 1)[0]);
    }

    return choices;
}

function applyEffect(player, effect) {
    if(effect.action === 'fullHeal') {
        player.hp = player.maxHp;
        player.shield = player.maxShield;
        return;
    }
    if(!isEffectAvailable(player, effect)) return;

    if(effect.stat === 'maxHp') {
        player.maxHp += effect.add;
        player.hp = Math.min(player.maxHp, player.hp + effect.add);
        return;
    }
    if(effect.stat === 'maxFuel') {
        const amount = Math.ceil(player.baseMaxFuel * effect.basePercent);
        player.maxFuel += amount;
        player.fuel = Math.min(player.maxFuel, player.fuel + amount);
        return;
    }
    if(effect.mult != null) {
        player[effect.stat] = Math.max(effect.min, player[effect.stat] * effect.mult);
        return;
    }
    if(effect.add != null) {
        const next = player[effect.stat] + effect.add;
        if(effect.max != null) player[effect.stat] = Math.min(effect.max, next);
        else if(effect.min != null) player[effect.stat] = Math.max(effect.min, next);
        else player[effect.stat] = next;
    }
}

export function applyUpgrade(player, upgradeId) {
    const upgrade = BALANCE.UPGRADES[upgradeId];
    if(!upgrade) throw new Error(`Unknown upgrade: ${upgradeId}`);

    for(const effect of upgrade.effects) applyEffect(player, effect);
    player.perks[upgradeId] = (player.perks[upgradeId] || 0) + 1;
    return upgrade;
}

/** AI mechs use the same progression but select one of three rolls automatically. */
export function grantAiProgress(actor, amount, rng=Math.random) {
    const levelsGained = addXp(actor, amount);
    const upgrades = [];
    for(let i=0; i<levelsGained; i++) {
        const choices = rollUpgradeChoices(actor, rng, 'ai');
        if(choices.length === 0) break;
        const index = Math.min(
            choices.length - 1,
            Math.floor(Math.min(Math.max(rng(), 0), 1 - Number.EPSILON) * choices.length),
        );
        applyUpgrade(actor, choices[index].id);
        upgrades.push(choices[index].id);
    }
    return { levelsGained, upgrades };
}
