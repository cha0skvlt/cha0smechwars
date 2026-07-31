import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import {
    applyDamage,
    isHostile,
    resolveOutgoingDamage,
    rpgSplashDamage,
    weaponDamage,
} from '../src/combat/damage.js';

test('one DU removes one shield DU', () => {
    const target = { hp: 10, shield: 3 };

    const result = applyDamage(target, 1);

    assert.deepEqual(result, { shieldDamage: 1, hpDamage: 0 });
    assert.deepEqual(target, { hp: 10, shield: 2 });
});

test('damage remainder crosses from shield to hp one-to-one', () => {
    const target = { hp: 10, shield: 2 };

    const result = applyDamage(target, 5);

    assert.deepEqual(result, { shieldDamage: 2, hpDamage: 3 });
    assert.deepEqual(target, { hp: 7, shield: 0 });
});

test('an unshielded durability target loses one hp per DU', () => {
    const target = { hp: 6 };

    const result = applyDamage(target, 4);

    assert.deepEqual(result, { shieldDamage: 0, hpDamage: 4 });
    assert.deepEqual(target, { hp: 2 });
});

test('the same DU input produces the same result for every damageable shape', () => {
    const mech = { hp: 8, shield: 2 };
    const enemy = { hp: 8, shield: 2 };
    const environment = { hp: 8, shield: 2 };

    const results = [mech, enemy, environment].map(target => applyDamage(target, 3));

    assert.deepEqual(results, [
        { shieldDamage: 2, hpDamage: 1 },
        { shieldDamage: 2, hpDamage: 1 },
        { shieldDamage: 2, hpDamage: 1 },
    ]);
    assert.deepEqual([mech, enemy, environment], [
        { hp: 7, shield: 0 },
        { hp: 7, shield: 0 },
        { hp: 7, shield: 0 },
    ]);
});

test('bullet damage scales from the canonical weapon level', () => {
    assert.equal(weaponDamage('pistol', 1), 1);
    assert.equal(weaponDamage('pistol', 3), 3);
    assert.equal(weaponDamage('rpg', 2), 6);
});

test('quad comes from the source and affects every hostile target', () => {
    const player = { faction: 'player', isHumanPlayer: true, quad: 10, critChance: 0 };
    const enemy = { faction: 'enemy' };
    const rival = { faction: 'rival', quad: 10 };
    const friendly = { faction: 'player' };

    assert.equal(resolveOutgoingDamage(player, enemy, 3).amount, 12);
    assert.equal(resolveOutgoingDamage(player, rival, 3).amount, 12);
    assert.equal(resolveOutgoingDamage(rival, player, 3).amount, 12);
    assert.equal(resolveOutgoingDamage(player, friendly, 3).amount, 3);
});

test('crit perk applies to every upgraded mech against hostile targets', () => {
    const player = { faction: 'player', isHumanPlayer: true, critChance: 1, quad: 0 };
    const rival = { faction: 'rival', isHumanPlayer: false, critChance: 1, quad: 0 };
    const enemy = { faction: 'enemy' };
    const friendly = { faction: 'player' };

    assert.deepEqual(resolveOutgoingDamage(player, enemy, 2, () => 0), {
        amount: 4, isCrit: true, isQuad: false, hostile: true,
    });
    assert.equal(resolveOutgoingDamage(player, friendly, 2, () => 0).isCrit, false);
    assert.equal(resolveOutgoingDamage(rival, enemy, 2, () => 0).isCrit, true);
});

test('factions prevent friendly fire and keep all hostile pairs symmetric', () => {
    const player = { faction: 'player' };
    const ally = { faction: 'player' };
    const rival = { faction: 'rival' };
    const enemy = { faction: 'enemy' };

    assert.equal(isHostile(player, ally), false);
    assert.equal(isHostile(ally, player), false);
    assert.equal(isHostile(player, rival), true);
    assert.equal(isHostile(rival, player), true);
    assert.equal(isHostile(ally, enemy), true);
    assert.equal(isHostile(enemy, ally), true);
    assert.equal(isHostile(rival, rival), false);
});

test('contact, dash, landing, and EMP preserve their canonical base DU', () => {
    const enemy = { faction: 'enemy' };
    const player = { faction: 'player', isHumanPlayer: true, critChance: 0, quad: 0 };
    const rival = { faction: 'rival', isHumanPlayer: false, critChance: 0, quad: 0 };

    assert.equal(resolveOutgoingDamage(enemy, player, BALANCE.DAMAGE.contact).amount, 1);
    assert.equal(resolveOutgoingDamage(player, rival, BALANCE.DAMAGE.dash).amount, 3);
    assert.equal(resolveOutgoingDamage(rival, player, BALANCE.DAMAGE.dash).amount, 3);
    assert.equal(resolveOutgoingDamage(player, enemy, BALANCE.DAMAGE.emp).amount, 3);
});

test('RPG splash uses canonical close, mid, and far zones', () => {
    const splash = BALANCE.WEAPONS.rpg.splash;

    assert.equal(rpgSplashDamage(splash.rClose), splash.close);
    assert.equal(rpgSplashDamage(splash.rMid), splash.mid);
    assert.equal(rpgSplashDamage(splash.rMid + 1), splash.far);
    assert.equal(rpgSplashDamage(splash.rBase + 1), 0);
});

test('mech shield and HP iframes remain canonical', () => {
    assert.equal(BALANCE.IFRAMES.shieldHit, 20);
    assert.equal(BALANCE.IFRAMES.hpHit, 30);
});
