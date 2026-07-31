import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { rpgExplodeFx, rpgFireKick, rpgFireShake } from '../src/combat/rpgFeel.js';

test('RPG feel constants stay softer than legacy punch', () => {
    const f = BALANCE.WEAPONS.rpg.feel;
    assert.ok(f.fireKick < 8);
    assert.ok(f.fireShake < 12);
    assert.ok(f.explodeShake < 15);
    assert.ok(f.explodeTrauma < 0.5);
    assert.ok(f.shootToneVol < 0.3);
    assert.ok(f.boomNoiseVol < 0.5);
});

test('RPG fire kick and shake scale for dual L2', () => {
    const f = BALANCE.WEAPONS.rpg.feel;
    assert.equal(rpgFireKick(1), f.fireKick);
    assert.equal(rpgFireKick(2), f.fireKick * 1.5);
    assert.equal(rpgFireShake(1), f.fireShake);
    assert.equal(rpgFireShake(2), f.fireShake * 1.5);
});

test('RPG explode FX is softer for bots and capped for big blasts', () => {
    const f = BALANCE.WEAPONS.rpg.feel;
    assert.deepEqual(rpgExplodeFx({}), { shake: f.explodeShake, trauma: f.explodeTrauma });
    assert.deepEqual(
        rpgExplodeFx({ isBotSource: true }),
        { shake: f.explodeShakeBot, trauma: f.explodeTrauma * 0.5 },
    );
    assert.deepEqual(
        rpgExplodeFx({ isBotSource: true, isBigExplosion: true }),
        { shake: f.explodeShake, trauma: f.explodeTrauma },
    );
});
