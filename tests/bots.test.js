import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BALANCE } from '../src/config/balance.js';
import { botTargetCandidates, ownerFollowState } from '../src/entities/botTactics.js';
import { randomMechClass, randomRivalGroupSize } from '../src/entities/mechLifecycle.js';

function mech(faction, x=0, y=0) {
    return {
        faction,
        x,
        y,
        w: 32,
        h: 32,
        hp: 10,
        flying: false,
        center() { return { x: this.x + 16, y: this.y + 16 }; },
    };
}

test('ally and rival AI select only hostile factions', () => {
    const player = mech('player');
    const ally = mech('player');
    const rivalA = mech('rival');
    const rivalB = mech('rival');
    const enemy = mech('enemy');

    assert.deepEqual(botTargetCandidates(ally, [player, ally, rivalA, enemy]), [rivalA, enemy]);
    assert.deepEqual(botTargetCandidates(rivalA, [player, ally, rivalA, rivalB, enemy]), [player, ally, enemy]);
});

test('companion follow state becomes mandatory beyond the leash', () => {
    const owner = mech('player', 0, 0);
    const nearby = mech('player', Math.sqrt(BALANCE.BOTS.followDistanceSq) - 1, 0);
    const following = mech('player', Math.sqrt(BALANCE.BOTS.followDistanceSq) + 1, 0);
    const leashed = mech('player', Math.sqrt(BALANCE.BOTS.leashDistanceSq) + 1, 0);

    assert.equal(ownerFollowState(nearby, owner).shouldFollow, false);
    assert.equal(ownerFollowState(following, owner).shouldFollow, true);
    assert.equal(ownerFollowState(following, owner).mustFollow, false);
    assert.equal(ownerFollowState(leashed, owner).mustFollow, true);
    assert.ok(ownerFollowState(leashed, owner).vector.x < 0);
});

test('rival waves always contain one to three random-class mechs', () => {
    assert.equal(randomRivalGroupSize(() => 0), 1);
    assert.equal(randomRivalGroupSize(() => 0.5), 2);
    assert.equal(randomRivalGroupSize(() => 0.999999), 3);
    assert.equal(randomMechClass(() => 0), 'battle');
    assert.equal(randomMechClass(() => 0.999999), 'scout');
});

test('game runtime no longer routes combat through a bot singleton', () => {
    const source = fs.readFileSync(new URL('../src/game/Game.js', import.meta.url), 'utf8');

    assert.doesNotMatch(source, /\b(?:this|Game)\.bot\b/);
    assert.doesNotMatch(source, /if\s*\(\s*b\.(?:bot|enemy)\s*\)/);
    assert.match(source, /allies:\s*\[\],\s*rivals:\s*\[\]/);
    assert.match(source, /spawnRivalGroup/);
    assert.match(source, /spawnCompanion/);
});
