import { BALANCE } from '../config/balance.js';

const HOSTILE_FACTIONS = {
    player: new Set(['rival', 'enemy']),
    rival: new Set(['player', 'enemy']),
    enemy: new Set(['player', 'rival']),
};

function assertDamageAmount(amount) {
    if(!Number.isFinite(amount) || amount < 0) {
        throw new TypeError('Damage amount must be a non-negative finite DU value');
    }
}

export function weaponDamage(weapon, level=1) {
    const config = BALANCE.WEAPONS[weapon] || BALANCE.WEAPONS.pistol;
    if(!Number.isFinite(level) || level < 1) {
        throw new TypeError('Weapon level must be a positive finite value');
    }
    return config.damage * level;
}

export function isHostile(source, target) {
    if(!source || !target || source === target) return false;
    const hostile = HOSTILE_FACTIONS[source.faction];
    return !!hostile && hostile.has(target.faction);
}

export function resolveOutgoingDamage(source, target, baseDamage, random=Math.random) {
    assertDamageAmount(baseDamage);
    const hostile = isHostile(source, target);
    const isQuad = hostile && Number.isFinite(source.quad) && source.quad > 0;
    const critChance = Number.isFinite(source?.critChance) ? source.critChance : 0;
    const isCrit = hostile && critChance > 0 && random() < critChance;
    const amount = baseDamage
        * (isQuad ? BALANCE.QUAD.mult : 1)
        * (isCrit ? BALANCE.CRIT.mult : 1);
    return { amount, isCrit, isQuad, hostile };
}

export function rpgSplashDamage(distance, radius=BALANCE.WEAPONS.rpg.splash.rBase) {
    if(!Number.isFinite(distance) || distance < 0 || !Number.isFinite(radius) || radius < 0) {
        throw new TypeError('RPG splash distance and radius must be non-negative finite values');
    }
    const splash = BALANCE.WEAPONS.rpg.splash;
    if(distance <= splash.rClose) return splash.close;
    if(distance <= splash.rMid) return splash.mid;
    if(distance <= radius) return splash.far;
    return 0;
}

export function applyDamage(target, amount) {
    if(!target || !Number.isFinite(target.hp) || target.hp < 0) {
        throw new TypeError('Damage target must have non-negative finite hp');
    }
    assertDamageAmount(amount);

    const hasShield = Object.hasOwn(target, 'shield');
    const shield = hasShield ? target.shield : 0;
    if(!Number.isFinite(shield) || shield < 0) {
        throw new TypeError('Damage target shield must be a non-negative finite DU value');
    }

    const shieldDamage = Math.min(shield, amount);
    if(hasShield) target.shield -= shieldDamage;

    const hpDamage = Math.min(target.hp, amount - shieldDamage);
    target.hp -= hpDamage;

    return { shieldDamage, hpDamage };
}
